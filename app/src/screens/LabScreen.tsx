import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  type LayoutChangeEvent,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  useWindowDimensions,
  Animated,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Camera,
  type CameraDeviceFormat,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from "react-native-vision-camera";

import HandLandmarkOverlay from "../components/HandLandmarkOverlay";
import { MajorityVoteSmoother } from "../ml/smoother";
import { API_BASE } from "../config/api";
import {
  createStreamingRecognitionBuffers,
  GESTURE_FRAMES,
  processStreamingHandFrame,
  resetStreamingRecognitionState,
  saveStreamingLandmarkSample,
  saveStreamingStaticWordLandmarkSample,
} from "../ml/streamingRecognition";
import { STATIC_ASL_LABELS } from "../ml/labels";
import type { DetectMode } from "../ml/streamTypes";
import { useStreamingHandTracking } from "../ml/useStreamingHandTracking";

// Lab components
import LabLiveHeader from "../components/lab/LabLiveHeader";
import LabSessionBar from "../components/lab/LabSessionBar";
import LabTargetSelector from "../components/lab/LabTargetSelector";
import LabCaptureTab from "../components/lab/LabCaptureTab";
import LabTrainingTab from "../components/lab/LabTrainingTab";
import LabModelsTab from "../components/lab/LabModelsTab";
import LabConfigTab from "../components/lab/LabConfigTab";
import LabStatusBanner from "../components/lab/LabStatusBanner";
import LabArchiveModal from "../components/lab/LabArchiveModal";
import {
  TEXT,
  TEXT_SECONDARY,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  BG,
  BG_CARD,
  BORDER,
  RADIUS_MD,
  RADIUS_PILL,
  PAD_SM,
  PAD_MD,
  ELEVATED_SHADOW,
} from "../components/lab/shared/labColors";

// ─── Constants ──────────────────────────────────────────────────
const TARGET_CAMERA_FPS = 30;
const TARGET_VIDEO_FORMAT = { width: 640, height: 480 } as const;

const WORD_LABELS = [
  "HELLO", "THANK_YOU", "SORRY", "PLEASE", "YES", "NO",
  "HELP", "GOODBYE", "WHAT", "WHERE", "I_LOVE_YOU", "J", "Z",
] as const;

type WordLabel = (typeof WORD_LABELS)[number];
type LandmarkTrainingMode = "bootstrap" | "full_reviewed";
type LandmarkModelVersion = {
  version_id: string;
  label?: string;
  training_mode?: LandmarkTrainingMode;
  trained_at?: string;
  is_active?: boolean;
  active_static_letters?: string[];
  archived_at?: string;
  active_static_word_labels?: string[];
};
type LandmarkLabelSummary = {
  label: string;
  approved: number;
  pending: number;
  rejected: number;
  legacy: number;
  by_hand: { Left: number; Right: number };
  session_total: number;
  session_by_hand: { Left: number; Right: number };
  session_pending: number;
  session_approved: number;
  session_rejected: number;
};
type ModelRenameDrafts = Record<string, string>;
type LabTab = "capture" | "training" | "models" | "config";
type ActiveTab = LabTab | null;
type BannerTone = "success" | "error" | "info" | "recording" | "training" | "warning";

function createDefaultCaptureSessionId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_lab`;
}

// ─── Props ──────────────────────────────────────────────────────
type LabScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  showHandOverlay: boolean;
};

export default function LabScreen({
  onBack,
  debugEnabled,
  showHandOverlay,
}: LabScreenProps) {
  const { height } = useWindowDimensions();
  const statusBarInset =
    Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  // ─── Camera ─────────────────────────────────────────────────
  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<"back" | "front">("back");
  const device = useCameraDevice(cameraPosition);
  const lightweightFormat = useCameraFormat(device, [
    { fps: TARGET_CAMERA_FPS },
    { videoResolution: TARGET_VIDEO_FORMAT },
    { videoAspectRatio: TARGET_VIDEO_FORMAT.width / TARGET_VIDEO_FORMAT.height },
  ]);
  const fallbackFormat = useMemo<CameraDeviceFormat | undefined>(() => {
    if (!device) return undefined;
    return [...device.formats]
      .filter((c) => c.maxFps >= TARGET_CAMERA_FPS)
      .sort((a, b) => {
        const ap = a.videoWidth * a.videoHeight;
        const bp = b.videoWidth * b.videoHeight;
        return ap !== bp ? ap - bp : a.maxFps - b.maxFps;
      })[0];
  }, [device]);
  const format = lightweightFormat ?? fallbackFormat;
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });

  // ─── FPS / Rate counters ────────────────────────────────────
  const [fpsCounter, setFpsCounter] = useState(0);
  const framesThisSecondRef = useRef(0);
  const lastFpsTickRef = useRef(Date.now());
  const [lmFps, setLmFps] = useState(0);
  const lmThisSecondRef = useRef(0);
  const lmLastTickRef = useRef(Date.now());
  const [predictionRate, setPredictionRate] = useState(0);
  const predictionThisSecondRef = useRef(0);
  const predictionLastTickRef = useRef(Date.now());

  // ─── Recognition state ──────────────────────────────────────
  const [lastLabel, setLastLabel] = useState("Ready");
  const [lastConf, setLastConf] = useState(0);
  const [rawLabel, setRawLabel] = useState("?");
  const [lastHandedness, setLastHandedness] = useState<string | null>(null);
  const smootherRef = useRef(new MajorityVoteSmoother(3));
  const [detectMode, setDetectMode] = useState<DetectMode>("LETTERS");

  // ─── Target state ───────────────────────────────────────────
  const [selectedLabel, setSelectedLabel] = useState<
    ((typeof STATIC_ASL_LABELS)[number]) | null
  >(null);
  const [selectedWord, setSelectedWord] = useState<WordLabel | null>(null);
  const [showTargetSelector, setShowTargetSelector] = useState(false);

  // ─── Gesture recording ──────────────────────────────────────
  const [isRecordingGesture, setIsRecordingGesture] = useState(false);
  const [liveGestureFramesCount, setLiveGestureFramesCount] = useState(0);
  const [recordingGestureFramesCount, setRecordingGestureFramesCount] = useState(0);
  const [wordGraceActive, setWordGraceActive] = useState(false);
  const [lastGesturePredictionAtMs, setLastGesturePredictionAtMs] = useState<number | null>(null);
  const [isOverlaySmoothing, setIsOverlaySmoothing] = useState(false);

  // ─── Metadata ───────────────────────────────────────────────
  const [signerId, setSignerId] = useState("person_01");
  const [captureSessionId, setCaptureSessionId] = useState(createDefaultCaptureSessionId);
  const [variantTagsText, setVariantTagsText] = useState("neutral");

  // ─── Model & training state ─────────────────────────────────
  const [activeStaticLetters, setActiveStaticLetters] = useState<string[]>([]);
  const [readyStaticLettersByMode, setReadyStaticLettersByMode] = useState<
    Record<LandmarkTrainingMode, string[]>
  >({ bootstrap: [], full_reviewed: [] });
  const [landmarkTrainingMode, setLandmarkTrainingMode] = useState<LandmarkTrainingMode>("full_reviewed");
  const [currentLandmarkTrainingMode, setCurrentLandmarkTrainingMode] = useState<LandmarkTrainingMode>("full_reviewed");
  const [activeLandmarkModelVersionId, setActiveLandmarkModelVersionId] = useState<string | null>(null);
  const [availableLandmarkModelVersions, setAvailableLandmarkModelVersions] = useState<LandmarkModelVersion[]>([]);
  const [archivedLandmarkModelVersions, setArchivedLandmarkModelVersions] = useState<LandmarkModelVersion[]>([]);
  const [activeStaticWordLabels, setActiveStaticWordLabels] = useState<string[]>([]);
  const [staticWordLandmarkCounts, setStaticWordLandmarkCounts] = useState<
    Record<string, { approved: number; pending: number; rejected: number; legacy: number }>
  >({});
  const [selectedLabelSummary, setSelectedLabelSummary] = useState<LandmarkLabelSummary | null>(null);
  const [modelRenameDrafts, setModelRenameDrafts] = useState<ModelRenameDrafts>({});

  // ─── UI state ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>("capture");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelVisible = isPanelOpen && activeTab !== null;
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<BannerTone>("info");
  const [statusVisible, setStatusVisible] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState("");

  const selectedWordIsStaticLandmark = selectedWord === "I_LOVE_YOU";
  const selectedStaticWordCounts = selectedWord
    ? staticWordLandmarkCounts[selectedWord] ?? null
    : null;

  // ─── Streaming recognition ─────────────────────────────────
  const buffersRef = useRef(createStreamingRecognitionBuffers());
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  const clearRecordBuffer = () => {
    buffersRef.current.recordingFrames = [];
    setRecordingGestureFramesCount(0);
  };
  const clearPredictBuffer = () => {
    buffersRef.current.liveWordFrames = [];
    buffersRef.current.lastWordPredictionAtMs = 0;
    buffersRef.current.lastWordHandAtMs = 0;
    buffersRef.current.wordNoHandSinceMs = 0;
    setLiveGestureFramesCount(0);
    setWordGraceActive(false);
    setLastGesturePredictionAtMs(null);
  };

  // ─── Status banner helper ──────────────────────────────────
  const showStatus = useCallback(
    (message: string, tone: BannerTone = "info", autoHideMs = 4000) => {
      setStatusMessage(message);
      setStatusTone(tone);
      setStatusVisible(true);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (autoHideMs > 0) {
        statusTimerRef.current = setTimeout(() => setStatusVisible(false), autoHideMs);
      }
    },
    []
  );
  const hideStatus = useCallback(() => setStatusVisible(false), []);

  // ─── Rate tick callbacks ────────────────────────────────────
  const onFrameTick = () => {
    framesThisSecondRef.current += 1;
    const now = Date.now();
    if (now - lastFpsTickRef.current >= 1000) {
      setFpsCounter(framesThisSecondRef.current);
      framesThisSecondRef.current = 0;
      lastFpsTickRef.current = now;
    }
  };
  const onLandmarkTick = () => {
    lmThisSecondRef.current += 1;
    const now = Date.now();
    if (now - lmLastTickRef.current >= 1000) {
      setLmFps(lmThisSecondRef.current);
      lmThisSecondRef.current = 0;
      lmLastTickRef.current = now;
    }
  };
  const onPredictionAttempt = () => {
    predictionThisSecondRef.current += 1;
    const now = Date.now();
    if (now - predictionLastTickRef.current >= 1000) {
      setPredictionRate(predictionThisSecondRef.current);
      predictionThisSecondRef.current = 0;
      predictionLastTickRef.current = now;
    }
  };

  // ─── Hand tracking hook ─────────────────────────────────────
  const { frameProcessor, latestHandFrame, debugState, isSupported } =
    useStreamingHandTracking({ enabled: ready && !!device && !!format, onFrameTick });

  const onCameraLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setCameraLayout((c) => (c.width === w && c.height === h ? c : { width: w, height: h }));
  };

  const orientedFrame = useMemo(() => {
    if (!format) return { width: 0, height: 0 };
    const previewIsPortrait = cameraLayout.height >= cameraLayout.width;
    const formatIsPortrait = format.videoHeight >= format.videoWidth;
    if (previewIsPortrait !== formatIsPortrait) {
      return { width: format.videoHeight, height: format.videoWidth };
    }
    return { width: format.videoWidth, height: format.videoHeight };
  }, [cameraLayout.height, cameraLayout.width, format]);

  // ─── API: Refresh health ────────────────────────────────────
  const refreshLabHealth = async () => {
    const res = await fetch(`${API_BASE}/health`);
    const json = await res.json();
    const versions = Array.isArray(json.available_landmark_model_versions)
      ? json.available_landmark_model_versions : [];
    setActiveStaticLetters(
      Array.isArray(json.active_static_letters) ? json.active_static_letters.map(String) : []
    );
    const currentMode = json.current_landmark_training_mode === "bootstrap" ? "bootstrap" : "full_reviewed";
    const bootstrapReady = Array.isArray(json.ready_static_letters_by_mode?.bootstrap)
      ? json.ready_static_letters_by_mode.bootstrap.map(String) : [];
    const fullReviewedReady = Array.isArray(json.ready_static_letters_by_mode?.full_reviewed)
      ? json.ready_static_letters_by_mode.full_reviewed.map(String)
      : Array.isArray(json.ready_static_letters) ? json.ready_static_letters.map(String) : [];
    setCurrentLandmarkTrainingMode(currentMode);
    setLandmarkTrainingMode(currentMode);
    setActiveLandmarkModelVersionId(
      typeof json.active_landmark_model_version_id === "string" ? json.active_landmark_model_version_id : null
    );
    setAvailableLandmarkModelVersions(versions);
    setArchivedLandmarkModelVersions(
      Array.isArray(json.archived_landmark_model_versions) ? json.archived_landmark_model_versions : []
    );
    setModelRenameDrafts((current) => {
      const next = { ...current };
      [...versions, ...(Array.isArray(json.archived_landmark_model_versions) ? json.archived_landmark_model_versions : [])].forEach(
        (v: LandmarkModelVersion) => {
          const id = String(v.version_id);
          if (!next[id]) next[id] = String(v.label ?? id);
        }
      );
      return next;
    });
    setReadyStaticLettersByMode({ bootstrap: bootstrapReady, full_reviewed: fullReviewedReady });
    setActiveStaticWordLabels(
      Array.isArray(json.active_static_word_labels) ? json.active_static_word_labels.map(String) : []
    );
    setStaticWordLandmarkCounts(
      typeof json.static_word_landmark_counts === "object" && json.static_word_landmark_counts !== null
        ? json.static_word_landmark_counts : {}
    );
  };

  // ─── API: Label summary ─────────────────────────────────────
  const refreshSelectedLabelSummary = async (
    nextLabel = selectedLabel,
    nextSessionId = captureSessionId,
    nextSignerId = signerId
  ) => {
    if (!nextLabel) { setSelectedLabelSummary(null); return; }
    const res = await fetch(`${API_BASE}/landmark_label_summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: nextLabel,
        captureSessionId: nextSessionId.trim() || null,
        signerId: nextSignerId.trim() || null,
      }),
    });
    const json = await res.json();
    if (json.ok) setSelectedLabelSummary(json);
  };

  // ─── API: Save landmark ─────────────────────────────────────
  const saveOneLandmarkSample = async () => {
    try {
      const nSignerId = signerId.trim();
      const nSessionId = captureSessionId.trim();
      const variantTags = variantTagsText.split(",").map((v) => v.trim()).filter(Boolean);
      if (!nSignerId) { showStatus("Signer ID is required.", "warning"); return; }
      if (!nSessionId) { showStatus("Session ID is required.", "warning"); return; }
      if (!selectedLabel) { showStatus("Select a label first.", "warning"); return; }
      showStatus(`Saving ${selectedLabel}...`, "info", 0);
      const result = await saveStreamingLandmarkSample(latestHandFrame, API_BASE, selectedLabel, {
        signerId: nSignerId, captureSessionId: nSessionId, cameraPosition,
        deviceId: `${Platform.OS}_${cameraPosition}`, variantTags,
      });
      if (!result.ok) { showStatus(`Save failed: ${result.error ?? "unknown"}`, "error"); return; }
      setLastHandedness(result.handedness ?? null);
      await refreshSelectedLabelSummary();
      await refreshLabHealth();
      showStatus(`Saved ✅ ${selectedLabel} (${result.handedness ?? "?"})`, "success");
    } catch { showStatus("Save error", "error"); }
  };

  // ─── API: Save static word ──────────────────────────────────
  const saveOneStaticWordLandmarkSample = async () => {
    try {
      const nSignerId = signerId.trim();
      const nSessionId = captureSessionId.trim();
      const variantTags = variantTagsText.split(",").map((v) => v.trim()).filter(Boolean);
      if (!nSignerId) { showStatus("Signer ID is required.", "warning"); return; }
      if (!nSessionId) { showStatus("Session ID is required.", "warning"); return; }
      if (!selectedWord) { showStatus("Select a word first.", "warning"); return; }
      if (!selectedWordIsStaticLandmark) { showStatus("This word uses the gesture capture flow.", "warning"); return; }
      showStatus(`Saving static word ${selectedWord}...`, "info", 0);
      const result = await saveStreamingStaticWordLandmarkSample(latestHandFrame, API_BASE, selectedWord, {
        signerId: nSignerId, captureSessionId: nSessionId, cameraPosition,
        deviceId: `${Platform.OS}_${cameraPosition}`, variantTags,
      });
      if (!result.ok) { showStatus(`Save failed: ${result.error ?? "unknown"}`, "error"); return; }
      setLastHandedness(result.handedness ?? null);
      showStatus(`Saved ✅ static word ${selectedWord} (${result.handedness ?? "?"})`, "success");
    } catch { showStatus("Save error", "error"); }
  };

  // ─── API: Train landmarks ──────────────────────────────────
  const trainLandmarks = async () => {
    try {
      showStatus(
        `Retraining (${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"})...`,
        "training", 0
      );
      const res = await fetch(`${API_BASE}/train_landmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingMode: landmarkTrainingMode }),
      });
      const json = await res.json();
      if (json.ok) {
        const acc = typeof json.accuracy === "number" ? ` (acc ${Math.round(json.accuracy * 100)}%)` : "";
        const active = Array.isArray(json.active_static_letters) ? json.active_static_letters : [];
        setReadyStaticLettersByMode((c) => ({
          ...c,
          [landmarkTrainingMode]: Array.isArray(json.ready_static_letters) ? json.ready_static_letters.map(String) : [],
        }));
        setCurrentLandmarkTrainingMode(json.training_mode === "bootstrap" ? "bootstrap" : "full_reviewed");
        setActiveLandmarkModelVersionId(typeof json.active_version_id === "string" ? json.active_version_id : null);
        setAvailableLandmarkModelVersions(Array.isArray(json.available_versions) ? json.available_versions : []);
        setModelRenameDrafts((current) => {
          const next = { ...current };
          (Array.isArray(json.available_versions) ? json.available_versions : []).forEach(
            (v: LandmarkModelVersion) => { next[String(v.version_id)] = String(v.label ?? v.version_id); }
          );
          return next;
        });
        setActiveStaticLetters(active);
        await refreshSelectedLabelSummary();
        showStatus(
          `New model created ✅${acc} ${active.length}/${STATIC_ASL_LABELS.length} active`,
          "success"
        );
        return;
      }
      const firstDeficit = Array.isArray(json.deficits) && json.deficits.length > 0 ? ` ${json.deficits[0]}` : "";
      showStatus(`Training blocked ❌ ${json.error ?? "unknown"}${firstDeficit}`, "error", 8000);
    } catch { showStatus("Training error", "error"); }
  };

  // ─── API: Train gestures ────────────────────────────────────
  const trainGestures = async () => {
    try {
      showStatus("Training gestures...", "training", 0);
      const res = await fetch(`${API_BASE}/train_gestures`, { method: "POST" });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) { showStatus(`HTTP ${res.status}: ${text.slice(0, 120)}`, "error"); return; }
      if (!json) { showStatus(`Non-JSON response: ${text.slice(0, 120)}`, "error"); return; }
      if (json.ok === false) { showStatus(`Training failed ❌ ${json.error ?? ""}`.trim(), "error"); return; }
      const acc = typeof json.accuracy === "number" ? ` (acc ${Math.round(json.accuracy * 100)}%)` : "";
      showStatus(`Gesture training complete ✅${acc}`, "success");
    } catch (e: any) { showStatus(`Gesture training error: ${e?.message ?? String(e)}`, "error"); }
  };

  // ─── API: Activate model ────────────────────────────────────
  const activateLandmarkModelVersion = async (versionId: string) => {
    try {
      showStatus("Switching model...", "info", 0);
      const res = await fetch(`${API_BASE}/activate_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const json = await res.json();
      if (!json.ok) { showStatus(`Switch failed: ${json.error ?? "unknown"}`, "error"); return; }
      const active = Array.isArray(json.active_static_letters) ? json.active_static_letters.map(String) : [];
      setActiveStaticLetters(active);
      setCurrentLandmarkTrainingMode(json.training_mode === "bootstrap" ? "bootstrap" : "full_reviewed");
      setLandmarkTrainingMode(json.training_mode === "bootstrap" ? "bootstrap" : "full_reviewed");
      setActiveLandmarkModelVersionId(typeof json.active_version_id === "string" ? json.active_version_id : versionId);
      setAvailableLandmarkModelVersions(Array.isArray(json.available_versions) ? json.available_versions : []);
      setModelRenameDrafts((current) => {
        const next = { ...current };
        (Array.isArray(json.available_versions) ? json.available_versions : []).forEach(
          (v: LandmarkModelVersion) => { next[String(v.version_id)] = String(v.label ?? v.version_id); }
        );
        return next;
      });
      await refreshSelectedLabelSummary();
      showStatus(`Switched to ${versionId} ✅`, "success");
    } catch { showStatus("Switch error", "error"); }
  };

  // ─── API: Rename model ──────────────────────────────────────
  const renameLandmarkModelVersion = async (versionId: string) => {
    try {
      const nextLabel = (modelRenameDrafts[versionId] ?? "").trim();
      if (!nextLabel) { showStatus("Model name cannot be empty.", "warning"); return; }
      showStatus(`Renaming ${versionId}...`, "info", 0);
      const res = await fetch(`${API_BASE}/rename_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, label: nextLabel }),
      });
      const json = await res.json();
      if (!json.ok) { showStatus(`Rename failed: ${json.error ?? "unknown"}`, "error"); return; }
      const versions = Array.isArray(json.available_versions) ? json.available_versions : [];
      setAvailableLandmarkModelVersions(versions);
      setModelRenameDrafts((current) => {
        const next = { ...current, [versionId]: nextLabel };
        versions.forEach((v: LandmarkModelVersion) => { next[String(v.version_id)] = String(v.label ?? v.version_id); });
        return next;
      });
      await refreshLabHealth();
      showStatus(`Renamed ✅ ${nextLabel}`, "success");
    } catch { showStatus("Rename error", "error"); }
  };

  // ─── API: Archive model ─────────────────────────────────────
  const archiveLandmarkModelVersion = async (versionId: string) => {
    try {
      showStatus(`Archiving ${versionId}...`, "info", 0);
      const res = await fetch(`${API_BASE}/archive_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const json = await res.json();
      if (!json.ok) { showStatus(`Archive failed: ${json.error ?? "unknown"}`, "error"); return; }
      const versions = Array.isArray(json.available_versions) ? json.available_versions : [];
      const archived = Array.isArray(json.archived_versions) ? json.archived_versions : [];
      setAvailableLandmarkModelVersions(versions);
      setArchivedLandmarkModelVersions(archived);
      setModelRenameDrafts((current) => {
        const next = { ...current };
        [...versions, ...archived].forEach((v: LandmarkModelVersion) => {
          next[String(v.version_id)] = String(v.label ?? v.version_id);
        });
        return next;
      });
      await refreshLabHealth();
      showStatus(`Archived ✅ ${versionId}`, "success");
    } catch { showStatus("Archive error", "error"); }
  };

  const openArchiveConfirmation = (versionId: string) => {
    setArchiveTargetId(versionId);
    setArchiveModalVisible(true);
  };
  const confirmArchive = () => {
    setArchiveModalVisible(false);
    void archiveLandmarkModelVersion(archiveTargetId);
  };

  // ─── Gesture recording ──────────────────────────────────────
  const toggleGestureRecording = () => {
    setIsRecordingGesture((prev) => {
      const next = !prev;
      if (next) {
        showStatus("Recording gesture… hold steady", "recording", 0);
        buffersRef.current.recordingFrames = [];
        setRecordingGestureFramesCount(0);
      } else {
        showStatus(
          `Recording stopped (${buffersRef.current.recordingFrames.length}/${GESTURE_FRAMES})`,
          "info"
        );
      }
      return next;
    });
  };

  const saveGestureSample = async () => {
    try {
      if (selectedWord === "I_LOVE_YOU") {
        showStatus("I_LOVE_YOU is a static landmark word, not a gesture.", "warning");
        return;
      }
      const MIN_FRAMES = 8;
      if (buffersRef.current.recordingFrames.length < MIN_FRAMES) {
        showStatus(`Need at least ${MIN_FRAMES} frames to save.`, "warning");
        return;
      }
      if (!selectedWord) { showStatus("Select a word first.", "warning"); return; }
      showStatus(`Saving gesture ${selectedWord}...`, "info", 0);
      const res = await fetch(`${API_BASE}/upload_gesture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: selectedWord,
          frames: buffersRef.current.recordingFrames.map((f) => f.landmarks),
          handedness: lastHandedness ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        showStatus(`Save gesture failed: ${json.error ?? "unknown"}`, "error");
        return;
      }
      showStatus(
        `Saved ✅ ${selectedWord} (${buffersRef.current.recordingFrames.length} frames)`,
        "success"
      );
    } catch { showStatus("Save gesture error", "error"); }
  };

  // ─── Mode toggle ────────────────────────────────────────────
  const handleToggleMode = () => {
    if (isRecordingGesture) { showStatus("Stop recording first.", "warning"); return; }
    setDetectMode((m) => {
      const next = m === "LETTERS" ? "WORDS" : "LETTERS";
      if (next === "LETTERS") {
        setIsRecordingGesture(false);
        clearRecordBuffer();
        clearPredictBuffer();
      }
      return next;
    });
  };

  // ─── Target selection ───────────────────────────────────────
  const handleSelectTarget = (value: string | null) => {
    if (detectMode === "WORDS") {
      setSelectedWord(value as WordLabel | null);
    } else {
      setSelectedLabel(value as (typeof STATIC_ASL_LABELS)[number] | null);
      if (!value) setSelectedLabelSummary(null);
    }
    setShowTargetSelector(false);
  };

  const targetChoices = useMemo(() => {
    if (detectMode === "WORDS") {
      return WORD_LABELS.map((w) => ({
        value: w,
        isActive: activeStaticWordLabels.includes(w),
        isReady: false,
        isStaticWord: w === "I_LOVE_YOU",
        isGesture: w !== "I_LOVE_YOU",
      }));
    }
    return STATIC_ASL_LABELS.map((l) => ({
      value: l,
      isActive: activeStaticLetters.includes(l),
      isReady: readyStaticLettersByMode[landmarkTrainingMode].includes(l),
      isStaticWord: false,
      isGesture: false,
    }));
  }, [detectMode, activeStaticLetters, activeStaticWordLabels, readyStaticLettersByMode, landmarkTrainingMode]);

  // ─── Derived values ─────────────────────────────────────────
  const selectedLabelIsActive = selectedLabel ? activeStaticLetters.includes(selectedLabel) : false;
  const selectedLabelIsReady = selectedLabel
    ? readyStaticLettersByMode[landmarkTrainingMode].includes(selectedLabel) : false;
  const activeLandmarkModelVersion = availableLandmarkModelVersions.find(
    (v) => String(v.version_id) === activeLandmarkModelVersionId
  );
  const selectedTargetValue = detectMode === "WORDS" ? selectedWord : selectedLabel;
  const currentWordFramesCount = isRecordingGesture ? recordingGestureFramesCount : liveGestureFramesCount;
  const lastSeenAgeMs = debugState.lastValidTimestampMs == null
    ? null : Math.max(0, Date.now() - debugState.lastValidTimestampMs);
  const lastGesturePredictionAgeMs = lastGesturePredictionAtMs == null
    ? null : Math.max(0, Date.now() - lastGesturePredictionAtMs);
  const archiveVersion = availableLandmarkModelVersions.find(
    (v) => String(v.version_id) === archiveTargetId
  );

  // ─── Effects ────────────────────────────────────────────────
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    (async () => {
      if (!hasPermission) { const ok = await requestPermission(); if (!ok) return; }
      setReady(true);
    })();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    resetStreamingRecognitionState(buffersRef, smootherRef, {
      setLiveGestureFramesCount, setRecordingGestureFramesCount,
      setWordGraceActive, setLastConf, setLastGesturePredictionAtMs,
      setLastLabel, setRawLabel,
    });
    setIsRecordingGesture(false);
    setShowTargetSelector(false);
  }, [detectMode]);

  useEffect(() => {
    if (!latestHandFrame) return;
    if (latestHandFrame.hasHand && latestHandFrame.landmarks?.length === 21) onLandmarkTick();
    void processStreamingHandFrame(latestHandFrame, {
      apiBase: API_BASE, buffersRef, detectMode, isMountedRef, isProcessingRef,
      isRecordingGesture, setLiveGestureFramesCount, setRecordingGestureFramesCount,
      setWordGraceActive, setLastConf, setLastGesturePredictionAtMs,
      setLastHandedness, setLastLabel, setRawLabel, smootherRef, onPredictionAttempt,
    });
  }, [latestHandFrame, detectMode, isRecordingGesture]);

  useEffect(() => {
    if (ready && !isSupported) {
      showStatus(
        "Streaming hand tracking requires an Android development build with the native hand tracker module.",
        "warning", 0
      );
    }
  }, [ready, isSupported, showStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshLabHealth();
        if (!cancelled) await refreshSelectedLabelSummary();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (detectMode !== "LETTERS") return;
    void refreshSelectedLabelSummary();
  }, [detectMode, selectedLabel, captureSessionId, signerId]);

  // ─── Bottom nav items & Panel Setup ─────────────────────────
  const NAV_ITEMS: { key: LabTab; label: string; icon: string }[] = [
    { key: "capture", label: "Capture", icon: "camera-outline" },
    { key: "training", label: "Training", icon: "flash-outline" },
    { key: "models", label: "Models", icon: "cube-outline" },
    { key: "config", label: "Config", icon: "settings-outline" },
  ];

  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;
  const panelMaxHeight = Math.round(height * 0.35);
  const totalClosedY = panelMaxHeight;
  const panY = useRef(new Animated.Value(panelMaxHeight)).current;
  const contentOpacity = panY.interpolate({
    inputRange: [0, panelMaxHeight],
    outputRange: [1, 0],
  });

  const togglePanel = () => {
    if (isPanelOpen) {
      Animated.timing(panY, {
        toValue: totalClosedY,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsPanelOpen(false);
      });
    } else {
      setIsPanelOpen(true);
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  // No interpolation needed — panY IS the translateY directly

  const handleNavPress = (key: LabTab) => {
    setActiveTab(key);
  };

  // ─── Loading / permission states ────────────────────────────
  if (!device || !format) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Loading camera…</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Camera permission required</Text>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Fullscreen camera */}
      <View style={[styles.cameraSurface, StyleSheet.absoluteFillObject]} onLayout={onCameraLayout}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={true}
          photo={false}
          video={false}
          audio={false}
          frameProcessor={frameProcessor}
          isMirrored={cameraPosition === "front"}
          resizeMode="cover"
          pixelFormat="rgb"
        />
        <HandLandmarkOverlay
          landmarks={latestHandFrame?.hasHand ? latestHandFrame.landmarks : null}
          landmarkTimestampMs={latestHandFrame?.timestampMs ?? null}
          cameraPosition={cameraPosition}
          previewWidth={cameraLayout.width}
          previewHeight={cameraLayout.height}
          frameWidth={orientedFrame.width}
          frameHeight={orientedFrame.height}
          onSmoothingChange={setIsOverlaySmoothing}
          visible={
            showHandOverlay &&
            !!latestHandFrame?.hasHand &&
            (latestHandFrame?.landmarks?.length ?? 0) === 21
          }
        />
      </View>

      {/* ─── Top overlays (over camera) ─────────────────────── */}
      <View style={[styles.topOverlays, { paddingTop: statusBarInset + 16 }]}>
        {/* Back + title */}
        <View style={styles.cameraOverlay}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={16} color={TEXT} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.cameraTitle}>SignSight Lab</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Floating HUD Wrapper */}
        <View style={styles.topHudContainer}>
          {/* Live recognition header */}
          <LabLiveHeader
            detectMode={detectMode}
            cameraPosition={cameraPosition}
            displayLabel={lastLabel}
            confidence={lastConf}
            rawLabel={rawLabel}
            handedness={lastHandedness}
            hasHand={debugState.hasHand}
            landmarkCount={debugState.landmarkCount}
            activeModelLabel={activeLandmarkModelVersion?.label ?? null}
            trainingMode={currentLandmarkTrainingMode}
            activeLetterCount={activeStaticLetters.length}
            totalLetterCount={STATIC_ASL_LABELS.length}
            gestureFramesCount={currentWordFramesCount}
            gestureFramesTotal={GESTURE_FRAMES}
            isRecording={isRecordingGesture}
            wordGraceActive={wordGraceActive}
            isStaticWord={selectedWordIsStaticLandmark}
            activeStaticWordCount={activeStaticWordLabels.length}
          />

          {/* Session bar */}
          <LabSessionBar
            detectMode={detectMode}
            cameraPosition={cameraPosition}
            selectedTarget={selectedTargetValue}
            targetIsActive={
              detectMode === "WORDS"
                ? selectedWord ? activeStaticWordLabels.includes(selectedWord) : false
                : selectedLabelIsActive
            }
            targetIsReady={selectedLabelIsReady}
            isStaticWord={detectMode === "WORDS" && selectedWordIsStaticLandmark}
            isGesture={detectMode === "WORDS" && !selectedWordIsStaticLandmark && !!selectedWord}
            isRecordingGesture={isRecordingGesture}
            onToggleMode={handleToggleMode}
            onToggleCamera={() => setCameraPosition((p) => (p === "back" ? "front" : "back"))}
            onOpenTargetSelector={() => setShowTargetSelector(true)}
          />
        </View>
      </View>

      {/* ─── Bottom: panel + nav bar (over camera) ──────────── */}
      <View style={styles.bottomStack} pointerEvents="box-none">

        {/* ─── Quick Save bar (Floating HUD) ─── */}
        {selectedTargetValue != null && (() => {
          const isGesture = detectMode === "WORDS" && !selectedWordIsStaticLandmark && !!selectedWord;
          const isStaticWord = detectMode === "WORDS" && selectedWordIsStaticLandmark;
          const isLetters = detectMode === "LETTERS";

          return (
            <View style={styles.quickSaveBar}>
              {/* Target chip */}
              <View style={styles.quickSaveTarget}>
                <Ionicons name="radio-button-on" size={10} color={ACCENT} />
                <Text style={styles.quickSaveTargetText} numberOfLines={1}>
                  {selectedTargetValue}
                </Text>
              </View>

              {/* Gesture: record/stop + save */}
              {isGesture && (
                <>
                  <Pressable
                    onPress={toggleGestureRecording}
                    style={({ pressed }) => [
                      styles.quickSaveSecondary,
                      isRecordingGesture && styles.quickSaveRecording,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name={isRecordingGesture ? "stop-circle" : "radio-button-on"}
                      size={16}
                      color={isRecordingGesture ? "#DC2626" : ACCENT}
                    />
                    <Text style={[
                      styles.quickSaveSecondaryText,
                      isRecordingGesture && { color: "#DC2626" },
                    ]}>
                      {isRecordingGesture ? "Stop" : "Record"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveGestureSample}
                    style={({ pressed }) => [
                      styles.quickSaveBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={styles.quickSaveBtnText}>Save</Text>
                  </Pressable>
                </>
              )}

              {/* Static word: save */}
              {isStaticWord && (
                <Pressable
                  onPress={saveOneStaticWordLandmarkSample}
                  style={({ pressed }) => [
                    styles.quickSaveBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="save-outline" size={16} color="#fff" />
                  <Text style={styles.quickSaveBtnText}>Save Sample</Text>
                </Pressable>
              )}

              {/* Letters: save landmark */}
              {isLetters && (
                <Pressable
                  onPress={saveOneLandmarkSample}
                  style={({ pressed }) => [
                    styles.quickSaveBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="save-outline" size={16} color="#fff" />
                  <Text style={styles.quickSaveBtnText}>Save Sample</Text>
                </Pressable>
              )}
            </View>
          );
        })()}

        {/* ─── Unified Bottom Sheet ─── */}
        <Animated.View style={[styles.bottomSheet, { paddingBottom: bottomNavPadding, transform: [{ translateY: panY }] }]}>
          {/* Toggle Header */}
          <Pressable 
            style={({ pressed }) => [styles.panelHeader, pressed && { opacity: 0.7 }]} 
            onPress={togglePanel}
          >
            <Ionicons 
              name={isPanelOpen ? "chevron-down" : "chevron-up"} 
              size={24} 
              color="rgba(0,0,0,0.3)" 
            />
          </Pressable>

          {/* Navigation Bar (Tabs on top of content) */}
          <View style={styles.bottomNavBar}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleNavPress(item.key)}
                  style={({ pressed }) => [
                    styles.navItem,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={isActive ? ACCENT : "#976D4E"}
                  />
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Hideable Content Panel — fixed-height clip box + opacity fade for artifact-free collapse */}
          {activeTab != null && (
            <Animated.View 
              pointerEvents={isPanelOpen ? 'auto' : 'none'}
              style={[styles.contentPanel, { height: panelMaxHeight, opacity: contentOpacity }]}
            >
              {activeTab === "capture" && (
                <LabCaptureTab
                  detectMode={detectMode}
                  selectedLabel={selectedLabel}
                  selectedLabelIsActive={selectedLabelIsActive}
                  selectedLabelIsReady={selectedLabelIsReady}
                  labelSummary={selectedLabelSummary}
                  trainingMode={landmarkTrainingMode}
                  onSaveLandmark={saveOneLandmarkSample}
                  selectedWord={selectedWord}
                  selectedWordIsStaticLandmark={selectedWordIsStaticLandmark}
                  staticWordCounts={selectedStaticWordCounts}
                  activeStaticWordLabels={activeStaticWordLabels}
                  isRecordingGesture={isRecordingGesture}
                  recordingGestureFramesCount={recordingGestureFramesCount}
                  liveGestureFramesCount={liveGestureFramesCount}
                  gestureFramesTotal={GESTURE_FRAMES}
                  onToggleRecording={toggleGestureRecording}
                  onSaveGesture={saveGestureSample}
                  onSaveStaticWord={saveOneStaticWordLandmarkSample}
                  onClearFrames={() => {
                    clearRecordBuffer();
                    clearPredictBuffer();
                    showStatus("Cleared frames.", "info");
                  }}
                />
              )}
              {activeTab === "training" && (
                <LabTrainingTab
                  detectMode={detectMode}
                  landmarkTrainingMode={landmarkTrainingMode}
                  currentServingMode={currentLandmarkTrainingMode}
                  activeModelVersionId={activeLandmarkModelVersionId}
                  activeModelLabel={activeLandmarkModelVersion?.label ?? null}
                  activeLetterCount={activeStaticLetters.length}
                  totalLetterCount={STATIC_ASL_LABELS.length}
                  readyLettersByMode={readyStaticLettersByMode}
                  selectedWordIsStaticLandmark={selectedWordIsStaticLandmark}
                  onSetTrainingMode={setLandmarkTrainingMode}
                  onTrainLandmarks={trainLandmarks}
                  onTrainGestures={trainGestures}
                />
              )}
              {activeTab === "models" && (
                <LabModelsTab
                  activeModelVersionId={activeLandmarkModelVersionId}
                  availableVersions={availableLandmarkModelVersions}
                  archivedVersions={archivedLandmarkModelVersions}
                  renameDrafts={modelRenameDrafts}
                  onActivate={activateLandmarkModelVersion}
                  onRename={renameLandmarkModelVersion}
                  onArchive={openArchiveConfirmation}
                  onRenameDraftChange={(id, text) =>
                    setModelRenameDrafts((c) => ({ ...c, [id]: text }))
                  }
                />
              )}
              {activeTab === "config" && (
                <LabConfigTab
                  signerId={signerId}
                  captureSessionId={captureSessionId}
                  variantTagsText={variantTagsText}
                  onSignerIdChange={setSignerId}
                  onCaptureSessionIdChange={setCaptureSessionId}
                  onVariantTagsChange={setVariantTagsText}
                  rawLabel={rawLabel}
                  handedness={lastHandedness}
                  fpsCounter={fpsCounter}
                  lmFps={lmFps}
                  predictionRate={predictionRate}
                  wordGraceActive={wordGraceActive}
                  isOverlaySmoothing={isOverlaySmoothing}
                  gesturePredictionAgeMs={lastGesturePredictionAgeMs}
                  lastHandAgeMs={lastSeenAgeMs}
                  isSupported={isSupported}
                />
              )}
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {/* Status banner */}
      <LabStatusBanner
        message={statusMessage}
        tone={statusTone}
        visible={statusVisible}
        onDismiss={hideStatus}
      />

      {/* Target selector modal */}
      <LabTargetSelector
        visible={showTargetSelector}
        detectMode={detectMode}
        choices={targetChoices}
        selectedValue={selectedTargetValue}
        onSelect={handleSelectTarget}
        onClose={() => setShowTargetSelector(false)}
      />

      {/* Archive confirmation modal */}
      <LabArchiveModal
        visible={archiveModalVisible}
        versionId={archiveTargetId}
        versionLabel={
          archiveVersion
            ? String(archiveVersion.label ?? archiveTargetId)
            : archiveTargetId
        }
        trainingMode={
          archiveVersion?.training_mode === "bootstrap"
            ? "Bootstrap"
            : "Full reviewed"
        }
        activeLetterCount={
          Array.isArray(archiveVersion?.active_static_letters)
            ? archiveVersion!.active_static_letters!.length
            : 0
        }
        trainedAt={archiveVersion?.trained_at ?? null}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveModalVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
  },
  centerText: {
    color: TEXT,
    fontWeight: "800",
  },
  // Camera (fullscreen)
  cameraSurface: {
    flex: 1,
  },
  // Top overlays
  topOverlays: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraOverlay: {
    paddingHorizontal: PAD_MD,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.9)",
  },
  backText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topHudContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    overflow: "hidden",
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  // Bottom stack (holds quick save bar + bottom sheet)
  bottomStack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    gap: 12,
  },
  // Unified Bottom Sheet
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
      },
    }),
  },
  // Content panel (hideable area inside bottomSheet)
  contentPanel: {
    paddingBottom: 8,
    overflow: "hidden",
    // Max height is applied inline via animation
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16, // more generous touch area
    paddingBottom: 10,
    height: 40,
  },
  panelDragHandle: {
    display: 'none',
  },
  // Navigation Bar (Tabs) inside the bottom sheet
  bottomNavBar: {
    flexDirection: "row",
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 18,
    justifyContent: "space-around",
    // No borders or shadow here since it's part of the unified bottomSheet
  },
  navItem: {
    alignItems: "center",
    gap: 3,
    flex: 1,
    paddingTop: 4,
    paddingBottom: 8,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#976D4E",
  },
  navLabelActive: {
    color: ACCENT,
    fontWeight: "800",
  },
  // Quick Save bar (Floating Pill)
  quickSaveBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  quickSaveTarget: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  quickSaveTargetText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
    flexShrink: 1,
  },
  quickSaveSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_LIGHT,
  },
  quickSaveRecording: {
    borderColor: "rgba(220,38,38,0.30)",
    backgroundColor: "#FEE2E2",
  },
  quickSaveSecondaryText: {
    color: ACCENT,
    fontWeight: "800",
    fontSize: 13,
  },
  quickSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  quickSaveBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
});
