import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Alert,
  Animated,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  Platform,
  PanResponder,
  StatusBar,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
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
import { TYPOGRAPHY } from "../config/typography";
import { SPACING } from "../config/spacing";

type CameraScreenVCProps = {
  onBack: () => void;
  debugEnabled?: boolean;
  showHandOverlay?: boolean;
  variant?: "translator" | "lab";
};

const ACCENT = "#BE185D";
const RECORDING = "#EF4444";
const BG = "#FFF9F2";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const SOFT_PINK = "#FCE7F3";
const SOFT_YELLOW = "#FEF3C7";
const SOFT_BLUE = "#DBEAFE";
const BORDER = "#E5E7EB";
const TARGET_CAMERA_FPS = 30;
const TARGET_VIDEO_FORMAT = { width: 640, height: 480 } as const;

const WORD_LABELS = [
  "HELLO",
  "THANK_YOU",
  "SORRY",
  "PLEASE",
  "YES",
  "NO",
  "HELP",
  "GOODBYE",
  "WHAT",
  "WHERE",
  "I_LOVE_YOU",
  "J",
  "Z",
] as const;

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

function createDefaultCaptureSessionId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_lab`;
}

export default function CameraScreenVC({
  onBack,
  debugEnabled = false,
  showHandOverlay = false,
  variant = "translator",
}: CameraScreenVCProps) {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const isLab = variant === "lab";
  const showDebugHud = isLab || debugEnabled;
  const showOverlay = showHandOverlay;
  const labSheetMaxHeight = Math.min(height * 0.5, 430);

  const PAD = isTablet ? 24 : isSmall ? 14 : 18;
  const statusBarInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomSafeLift = Platform.OS === "android" ? 44 : 32;
  const translatorBottomInset = Platform.OS === "android" ? 36 : 18;
  const translatorModelSheetMaxHeight = Math.round(height * 0.5);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);

  const [cameraPosition, setCameraPosition] = useState<"back" | "front">(
    "back"
  );
  const device = useCameraDevice(cameraPosition);
  const lightweightFormat = useCameraFormat(device, [
    { fps: TARGET_CAMERA_FPS },
    { videoResolution: TARGET_VIDEO_FORMAT },
    {
      videoAspectRatio:
        TARGET_VIDEO_FORMAT.width / TARGET_VIDEO_FORMAT.height,
    },
  ]);
  const fallbackFormat = useMemo<CameraDeviceFormat | undefined>(() => {
    if (!device) {
      return undefined;
    }

    return [...device.formats]
      .filter((candidate) => candidate.maxFps >= TARGET_CAMERA_FPS)
      .sort((left, right) => {
        const leftPixels = left.videoWidth * left.videoHeight;
        const rightPixels = right.videoWidth * right.videoHeight;

        if (leftPixels !== rightPixels) {
          return leftPixels - rightPixels;
        }

        return left.maxFps - right.maxFps;
      })[0];
  }, [device]);
  const format = lightweightFormat ?? fallbackFormat;

  const [fpsCounter, setFpsCounter] = useState(0);
  const framesThisSecondRef = useRef(0);
  const lastFpsTickRef = useRef(Date.now());

  const [lmFps, setLmFps] = useState(0);
  const lmThisSecondRef = useRef(0);
  const lmLastTickRef = useRef(Date.now());
  const [predictionRate, setPredictionRate] = useState(0);
  const predictionThisSecondRef = useRef(0);
  const predictionLastTickRef = useRef(Date.now());

  const [lastLabel, setLastLabel] = useState("Ready");
  const [lastConf, setLastConf] = useState(0);

  const smootherRef = useRef(new MajorityVoteSmoother(3));
  const [selectedLabel, setSelectedLabel] = useState<
    ((typeof STATIC_ASL_LABELS)[number]) | null
  >(null);
  const [signerId, setSignerId] = useState("person_01");
  const [captureSessionId, setCaptureSessionId] = useState(
    createDefaultCaptureSessionId
  );
  const [variantTagsText, setVariantTagsText] = useState("neutral");
  const [status, setStatus] = useState("");
  const [lastHandedness, setLastHandedness] = useState<string | null>(null);
  const [rawLabel, setRawLabel] = useState("?");
  const [activeStaticLetters, setActiveStaticLetters] = useState<string[]>([]);
  const [readyStaticLettersByMode, setReadyStaticLettersByMode] = useState<
    Record<LandmarkTrainingMode, string[]>
  >({
    bootstrap: [],
    full_reviewed: [],
  });
  const [landmarkTrainingMode, setLandmarkTrainingMode] =
    useState<LandmarkTrainingMode>("full_reviewed");
  const [currentLandmarkTrainingMode, setCurrentLandmarkTrainingMode] =
    useState<LandmarkTrainingMode>("full_reviewed");
  const [activeLandmarkModelVersionId, setActiveLandmarkModelVersionId] =
    useState<string | null>(null);
  const [availableLandmarkModelVersions, setAvailableLandmarkModelVersions] =
    useState<LandmarkModelVersion[]>([]);
  const [activeStaticWordLabels, setActiveStaticWordLabels] = useState<string[]>([]);
  const [staticWordLandmarkCounts, setStaticWordLandmarkCounts] = useState<
    Record<string, { approved: number; pending: number; rejected: number; legacy: number }>
  >({});
  const [selectedLabelSummary, setSelectedLabelSummary] =
    useState<LandmarkLabelSummary | null>(null);

  type WordLabel = (typeof WORD_LABELS)[number];
  const [selectedWord, setSelectedWord] = useState<WordLabel | null>(null);
  const [isRecordingGesture, setIsRecordingGesture] = useState(false);
  const [liveGestureFramesCount, setLiveGestureFramesCount] = useState(0);
  const [recordingGestureFramesCount, setRecordingGestureFramesCount] =
    useState(0);
  const [wordGraceActive, setWordGraceActive] = useState(false);
  const [lastGesturePredictionAtMs, setLastGesturePredictionAtMs] = useState<
    number | null
  >(null);
  const [detectMode, setDetectMode] = useState<DetectMode>("LETTERS");
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [isOverlaySmoothing, setIsOverlaySmoothing] = useState(false);
  const [showLabDiagnostics, setShowLabDiagnostics] = useState(false);
  const [showModelVersions, setShowModelVersions] = useState(false);
  const [showArchivedModelVersions, setShowArchivedModelVersions] = useState(false);
  const [showTargetChoices, setShowTargetChoices] = useState(false);
  const [showTranslatorModelChoices, setShowTranslatorModelChoices] = useState(false);
  const [showTranslatorMenu, setShowTranslatorMenu] = useState(false);
  const [showTranslatorModeChoices, setShowTranslatorModeChoices] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [modelRenameDrafts, setModelRenameDrafts] = useState<ModelRenameDrafts>(
    {}
  );
  const [archivedLandmarkModelVersions, setArchivedLandmarkModelVersions] =
    useState<LandmarkModelVersion[]>([]);
  const selectedWordIsStaticLandmark = selectedWord === "I_LOVE_YOU";
  const selectedStaticWordCounts = selectedWord
    ? staticWordLandmarkCounts[selectedWord] ?? null
    : null;

  const buffersRef = useRef(createStreamingRecognitionBuffers());
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const translatorSheetTranslateY = useRef(new Animated.Value(translatorModelSheetMaxHeight)).current;

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

  const { frameProcessor, latestHandFrame, debugState, isSupported } =
    useStreamingHandTracking({
      enabled: ready && !!device && !!format,
      onFrameTick,
    });

  const onCameraLayout = (event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setCameraLayout((current) => {
      if (current.width === nextWidth && current.height === nextHeight) {
        return current;
      }
      return { width: nextWidth, height: nextHeight };
    });
  };

  const refreshLabHealth = async () => {
    const res = await fetch(`${API_BASE}/health`);
    const json = await res.json();
    const versions = Array.isArray(json.available_landmark_model_versions)
      ? json.available_landmark_model_versions
      : [];
    setActiveStaticLetters(
      Array.isArray(json.active_static_letters)
        ? json.active_static_letters.map(String)
        : []
    );
    const currentMode =
      json.current_landmark_training_mode === "bootstrap"
        ? "bootstrap"
        : "full_reviewed";
    const bootstrapReady = Array.isArray(
      json.ready_static_letters_by_mode?.bootstrap
    )
      ? json.ready_static_letters_by_mode.bootstrap.map(String)
      : [];
    const fullReviewedReady = Array.isArray(
      json.ready_static_letters_by_mode?.full_reviewed
    )
      ? json.ready_static_letters_by_mode.full_reviewed.map(String)
      : Array.isArray(json.ready_static_letters)
        ? json.ready_static_letters.map(String)
        : [];
    setCurrentLandmarkTrainingMode(currentMode);
    setLandmarkTrainingMode(currentMode);
    setActiveLandmarkModelVersionId(
      typeof json.active_landmark_model_version_id === "string"
        ? json.active_landmark_model_version_id
        : null
    );
    setAvailableLandmarkModelVersions(versions);
    setArchivedLandmarkModelVersions(
      Array.isArray(json.archived_landmark_model_versions)
        ? json.archived_landmark_model_versions
        : []
    );
    setModelRenameDrafts((current) => {
      const next = { ...current };
      versions.forEach((version: LandmarkModelVersion) => {
        const versionId = String(version.version_id);
        if (!next[versionId]) {
          next[versionId] = String(version.label ?? versionId);
        }
      });
      (Array.isArray(json.archived_landmark_model_versions)
        ? json.archived_landmark_model_versions
        : []
      ).forEach((version: LandmarkModelVersion) => {
        const versionId = String(version.version_id);
        if (!next[versionId]) {
          next[versionId] = String(version.label ?? versionId);
        }
      });
      return next;
    });
    setReadyStaticLettersByMode({
      bootstrap: bootstrapReady,
      full_reviewed: fullReviewedReady,
    });
    setActiveStaticWordLabels(
      Array.isArray(json.active_static_word_labels)
        ? json.active_static_word_labels.map(String)
        : []
    );
    setStaticWordLandmarkCounts(
      typeof json.static_word_landmark_counts === "object" &&
        json.static_word_landmark_counts !== null
        ? json.static_word_landmark_counts
        : {}
    );
  };

  const refreshSelectedLabelSummary = async (
    nextLabel = selectedLabel,
    nextSessionId = captureSessionId,
    nextSignerId = signerId
  ) => {
    if (!nextLabel) {
      setSelectedLabelSummary(null);
      return;
    }
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
    if (json.ok) {
      setSelectedLabelSummary(json);
    }
  };

  const saveOneLandmarkSample = async () => {
    try {
      const normalizedSignerId = signerId.trim();
      const normalizedSessionId = captureSessionId.trim();
      const variantTags = variantTagsText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!normalizedSignerId) {
        setStatus("Signer ID is required.");
        return;
      }

      if (!normalizedSessionId) {
        setStatus("Session ID is required.");
        return;
      }

      if (!selectedLabel) {
        setStatus("Select a label first.");
        return;
      }

      setStatus(`Saving ${selectedLabel}...`);

      const result = await saveStreamingLandmarkSample(
        latestHandFrame,
        API_BASE,
        selectedLabel,
        {
          signerId: normalizedSignerId,
          captureSessionId: normalizedSessionId,
          cameraPosition,
          deviceId: `${Platform.OS}_${cameraPosition}`,
          variantTags,
        }
      );

      if (!result.ok) {
        setStatus(`Save failed: ${result.error ?? "unknown"}`);
        return;
      }

      setLastHandedness(result.handedness ?? null);
      await refreshSelectedLabelSummary();
      await refreshLabHealth();
      setStatus(
        `Saved approved ✅ ${selectedLabel} (${result.handedness ?? "?"})`
      );
    } catch {
      setStatus("Save error");
    }
  };

  const saveOneStaticWordLandmarkSample = async () => {
    try {
      const normalizedSignerId = signerId.trim();
      const normalizedSessionId = captureSessionId.trim();
      const variantTags = variantTagsText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!normalizedSignerId) {
        setStatus("Signer ID is required.");
        return;
      }

      if (!normalizedSessionId) {
        setStatus("Session ID is required.");
        return;
      }

      if (!selectedWord) {
        setStatus("Select a word first.");
        return;
      }

      if (!selectedWordIsStaticLandmark) {
        setStatus("This word uses the gesture capture flow.");
        return;
      }

      setStatus(`Saving static word landmark ${selectedWord}...`);

      const result = await saveStreamingStaticWordLandmarkSample(
        latestHandFrame,
        API_BASE,
        selectedWord,
        {
          signerId: normalizedSignerId,
          captureSessionId: normalizedSessionId,
          cameraPosition,
          deviceId: `${Platform.OS}_${cameraPosition}`,
          variantTags,
        }
      );

      if (!result.ok) {
        setStatus(`Save failed: ${result.error ?? "unknown"}`);
        return;
      }

      setLastHandedness(result.handedness ?? null);
      setStatus(
        `Saved approved static word ✅ ${selectedWord} (${result.handedness ?? "?"})`
      );
    } catch {
      setStatus("Save error");
    }
  };

  const trainLandmarks = async () => {
    try {
      setStatus(
        `Retraining from saved dataset (${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"})...`
      );
      const res = await fetch(`${API_BASE}/train_landmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingMode: landmarkTrainingMode }),
      });
      const json = await res.json();
      if (json.ok) {
        const acc =
          typeof json.accuracy === "number"
            ? ` (acc ${Math.round(json.accuracy * 100)}%)`
            : "";
        const active = Array.isArray(json.active_static_letters)
          ? json.active_static_letters
          : [];
        setReadyStaticLettersByMode((current) => ({
          ...current,
          [landmarkTrainingMode]: Array.isArray(json.ready_static_letters)
            ? json.ready_static_letters.map(String)
            : [],
        }));
        setCurrentLandmarkTrainingMode(
          json.training_mode === "bootstrap" ? "bootstrap" : "full_reviewed"
        );
        setActiveLandmarkModelVersionId(
          typeof json.active_version_id === "string"
            ? json.active_version_id
            : null
        );
        setAvailableLandmarkModelVersions(
          Array.isArray(json.available_versions)
            ? json.available_versions
            : []
        );
        setModelRenameDrafts((current) => {
          const next = { ...current };
          (Array.isArray(json.available_versions) ? json.available_versions : []).forEach(
            (version: LandmarkModelVersion) => {
              const versionId = String(version.version_id);
              next[versionId] = String(version.label ?? versionId);
            }
          );
          return next;
        });
        setActiveStaticLetters(active);
        await refreshSelectedLabelSummary();
        setStatus(
          `New model version created ✅${acc} ${json.training_mode === "bootstrap" ? "Bootstrap" : "Full reviewed"}: ${active.length}/${STATIC_ASL_LABELS.length} active`
        );
        return;
      }

      const firstDeficit =
        Array.isArray(json.deficits) && json.deficits.length > 0
          ? ` ${json.deficits[0]}`
          : "";
      setStatus(`Training blocked ❌ ${json.error ?? "unknown"}${firstDeficit}`);
    } catch {
      setStatus("Training error");
    }
  };

  const activateLandmarkModelVersion = async (versionId: string) => {
    try {
      setStatus("Switching landmark model version...");
      const res = await fetch(`${API_BASE}/activate_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus(`Version switch failed: ${json.error ?? "unknown"}`);
        return;
      }

      const active = Array.isArray(json.active_static_letters)
        ? json.active_static_letters.map(String)
        : [];
      setActiveStaticLetters(active);
      setCurrentLandmarkTrainingMode(
        json.training_mode === "bootstrap" ? "bootstrap" : "full_reviewed"
      );
      setLandmarkTrainingMode(
        json.training_mode === "bootstrap" ? "bootstrap" : "full_reviewed"
      );
      setActiveLandmarkModelVersionId(
        typeof json.active_version_id === "string"
          ? json.active_version_id
          : versionId
      );
      setAvailableLandmarkModelVersions(
        Array.isArray(json.available_versions)
          ? json.available_versions
          : []
      );
      setModelRenameDrafts((current) => {
        const next = { ...current };
        (Array.isArray(json.available_versions) ? json.available_versions : []).forEach(
          (version: LandmarkModelVersion) => {
            const versionId = String(version.version_id);
            next[versionId] = String(version.label ?? versionId);
          }
        );
        return next;
      });
      await refreshSelectedLabelSummary();
      setStatus(`Switched active model ✅ ${versionId}`);
    } catch {
      setStatus("Version switch error");
    }
  };

  const renameLandmarkModelVersion = async (versionId: string) => {
    try {
      const nextLabel = (modelRenameDrafts[versionId] ?? "").trim();
      if (!nextLabel) {
        setStatus("Model name cannot be empty.");
        return;
      }
      setStatus(`Renaming model ${versionId}...`);
      const res = await fetch(`${API_BASE}/rename_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, label: nextLabel }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus(`Rename failed: ${json.error ?? "unknown"}`);
        return;
      }
      const versions = Array.isArray(json.available_versions)
        ? json.available_versions
        : [];
      setAvailableLandmarkModelVersions(versions);
      setModelRenameDrafts((current) => {
        const next = { ...current, [versionId]: nextLabel };
        versions.forEach((version: LandmarkModelVersion) => {
          const id = String(version.version_id);
          next[id] = String(version.label ?? id);
        });
        return next;
      });
      await refreshLabHealth();
      setStatus(`Model renamed ✅ ${nextLabel}`);
    } catch {
      setStatus("Rename error");
    }
  };

  const archiveLandmarkModelVersion = async (versionId: string) => {
    try {
      setStatus(`Archiving model ${versionId}...`);
      const res = await fetch(`${API_BASE}/archive_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus(`Archive failed: ${json.error ?? "unknown"}`);
        return;
      }
      const versions = Array.isArray(json.available_versions)
        ? json.available_versions
        : [];
      const archived = Array.isArray(json.archived_versions)
        ? json.archived_versions
        : [];
      setAvailableLandmarkModelVersions(versions);
      setArchivedLandmarkModelVersions(archived);
      setModelRenameDrafts((current) => {
        const next = { ...current };
        [...versions, ...archived].forEach((version: LandmarkModelVersion) => {
          const id = String(version.version_id);
          next[id] = String(version.label ?? id);
        });
        return next;
      });
      await refreshLabHealth();
      setStatus(`Model archived ✅ ${versionId}`);
    } catch {
      setStatus("Archive error");
    }
  };

  const confirmArchiveLandmarkModelVersion = (versionId: string) => {
    Alert.alert(
      "Archive model?",
      "This will remove the model from active versions and move it to archived models. You can still view it later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => {
            void archiveLandmarkModelVersion(versionId);
          },
        },
      ]
    );
  };

  const toggleGestureRecording = () => {
    setIsRecordingGesture((prev) => {
      const next = !prev;

      if (next) {
      setStatus("Recording gesture… hold steady");
        buffersRef.current.recordingFrames = [];
        setRecordingGestureFramesCount(0);
      } else {
        setStatus(
          `Recording stopped (${buffersRef.current.recordingFrames.length}/${GESTURE_FRAMES})`
        );
      }

      return next;
    });
  };

  const saveGestureSample = async () => {
    try {
      if (selectedWord === "I_LOVE_YOU") {
        setStatus(
          "I_LOVE_YOU is a static landmark word. It is recognized live from landmarks and is not saved as a gesture."
        );
        return;
      }

      const MIN_FRAMES = 8;
      if (buffersRef.current.recordingFrames.length < MIN_FRAMES) {
        setStatus(`Need at least ${MIN_FRAMES} frames to save.`);
        return;
      }

      if (!selectedWord) {
        setStatus("Select a word first.");
        return;
      }

      setStatus(`Saving gesture ${selectedWord}...`);

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
        setStatus(`Save gesture failed: ${json.error ?? "unknown"}`);
        return;
      }

      setStatus(
        `Saved ✅ ${selectedWord} (${buffersRef.current.recordingFrames.length} frames)`
      );
    } catch {
      setStatus("Save gesture error");
    }
  };

  const trainGestures = async () => {
    try {
      setStatus("Training gestures...");

      const res = await fetch(`${API_BASE}/train_gestures`, { method: "POST" });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        setStatus(`HTTP ${res.status}: ${text.slice(0, 120)}`);
        return;
      }

      if (!json) {
        setStatus(`Server returned non-JSON: ${text.slice(0, 120)}`);
        return;
      }

      if (json.ok === false) {
        setStatus(`Training failed ❌ ${json.error ?? ""}`.trim());
        return;
      }

      const acc =
        typeof json.accuracy === "number"
          ? ` (acc ${Math.round(json.accuracy * 100)}%)`
          : "";
      setStatus(`Gesture training complete ✅${acc}`);
    } catch (e: any) {
      setStatus(`Gesture training error: ${e?.message ?? String(e)}`);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const ok = await requestPermission();
        if (!ok) return;
      }
      setReady(true);
    })();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    resetStreamingRecognitionState(buffersRef, smootherRef, {
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf,
      setLastGesturePredictionAtMs,
      setLastLabel,
      setRawLabel,
    });
    setIsRecordingGesture(false);
  }, [detectMode]);

  useEffect(() => {
    if (!latestHandFrame) return;

    if (latestHandFrame.hasHand && latestHandFrame.landmarks?.length === 21) {
      onLandmarkTick();
    }

    void processStreamingHandFrame(latestHandFrame, {
      apiBase: API_BASE,
      buffersRef,
      detectMode,
      isMountedRef,
      isProcessingRef,
      isRecordingGesture,
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf,
      setLastGesturePredictionAtMs,
      setLastHandedness,
      setLastLabel,
      setRawLabel,
      smootherRef,
      onPredictionAttempt,
    });
  }, [latestHandFrame, detectMode, isRecordingGesture]);

  useEffect(() => {
    if (!ready || isSupported) {
      return;
    }

    setStatus(
      "Streaming hand tracking requires an Android development build with the native hand tracker module."
    );
  }, [ready, isSupported]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await refreshLabHealth();
        if (!cancelled) {
          await refreshSelectedLabelSummary();
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLab || detectMode !== "LETTERS") {
      return;
    }
    void refreshSelectedLabelSummary();
  }, [isLab, detectMode, selectedLabel, captureSessionId, signerId]);

  useEffect(() => {
    setShowTargetChoices(false);
  }, [detectMode]);

  const orientedFrame = useMemo(() => {
    if (!format) {
      return { width: 0, height: 0 };
    }

    const previewIsPortrait = cameraLayout.height >= cameraLayout.width;
    const formatIsPortrait = format.videoHeight >= format.videoWidth;

    if (previewIsPortrait !== formatIsPortrait) {
      return {
        width: format.videoHeight,
        height: format.videoWidth,
      };
    }

    return {
      width: format.videoWidth,
      height: format.videoHeight,
    };
  }, [cameraLayout.height, cameraLayout.width, format]);

  const openTranslatorModelSheet = () => {
    setShowTranslatorMenu(false);
    setShowTranslatorModelChoices(true);
    translatorSheetTranslateY.setValue(translatorModelSheetMaxHeight);
    Animated.spring(translatorSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.9,
    }).start();
  };

  const closeTranslatorModelSheet = () => {
    Animated.timing(translatorSheetTranslateY, {
      toValue: translatorModelSheetMaxHeight,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowTranslatorModelChoices(false);
      }
    });
  };

  const translatorSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy > 6,
        onPanResponderMove: (_, gestureState) => {
          translatorSheetTranslateY.setValue(
            Math.max(0, Math.min(translatorModelSheetMaxHeight, gestureState.dy))
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > translatorModelSheetMaxHeight * 0.22) {
            closeTranslatorModelSheet();
            return;
          }
          Animated.spring(translatorSheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 220,
            mass: 0.9,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translatorSheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 220,
            mass: 0.9,
          }).start();
        },
      }),
    [translatorModelSheetMaxHeight, translatorSheetTranslateY]
  );

  if (!device || !format) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Loading camera…</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required</Text>
      </View>
    );
  }

  const centerTitle = detectMode === "LETTERS" ? "LETTER" : "WORD";
  const displayLabel = lastLabel;
  const selectedLabelIsActive = selectedLabel
    ? activeStaticLetters.includes(selectedLabel)
    : false;
  const selectedLabelIsReady =
    selectedLabel
      ? readyStaticLettersByMode[landmarkTrainingMode].includes(selectedLabel)
      : false;
  const activeLandmarkModelVersion = availableLandmarkModelVersions.find(
    (version) => String(version.version_id) === activeLandmarkModelVersionId
  );
  const currentTargetChoices =
    detectMode === "WORDS" ? WORD_LABELS : STATIC_ASL_LABELS;
  const selectedTargetValue =
    detectMode === "WORDS" ? selectedWord : selectedLabel;
  const currentWordFramesCount = isRecordingGesture
    ? recordingGestureFramesCount
    : liveGestureFramesCount;
  const lastSeenAgeMs =
    debugState.lastValidTimestampMs == null
      ? null
      : Math.max(0, Date.now() - debugState.lastValidTimestampMs);
  const lastGesturePredictionAgeMs =
    lastGesturePredictionAtMs == null
      ? null
      : Math.max(0, Date.now() - lastGesturePredictionAtMs);
  const translatorTopStrongHeight = Math.max(30, statusBarInset + 8);
  const translatorTopMidHeight = 52;
  const translatorTopFadeHeight =
    translatorTopStrongHeight + translatorTopMidHeight + 14;
  const translatorTopBarTop = translatorTopStrongHeight + 2;

  return (
    <View style={styles.container}>
      <View style={styles.cameraSurface} onLayout={onCameraLayout}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={true}
          photo={false}
          video={false}
          audio={false}
          torch={torchEnabled ? "on" : "off"}
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
            showOverlay &&
            !!latestHandFrame?.hasHand &&
            (latestHandFrame?.landmarks?.length ?? 0) === 21
          }
        />
        <View style={[styles.translatorTopFade, { height: translatorTopFadeHeight }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="translatorTopFadeGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.8} />
                <Stop offset="0.35" stopColor="#000000" stopOpacity={0.30} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#translatorTopFadeGradient)"
            />
          </Svg>
        </View>

        <View style={[styles.translatorTopBar, { top: translatorTopBarTop }]}>
          <View style={styles.translatorTopBarContent}>
            <View style={styles.translatorTopBarLeft}>
              <Pressable onPress={onBack} style={styles.topBarIconButton}>
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!device?.hasTorch) {
                    return;
                  }
                  setTorchEnabled((value) => !value);
                }}
                style={({ pressed }) => [
                  styles.topBarIconButton,
                  !device?.hasTorch && styles.topBarIconButtonDisabled,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons
                  name={torchEnabled ? "flash" : "flash-off"}
                  size={18}
                  color={torchEnabled ? "#FDE68A" : "#FFFFFF"}
                />
              </Pressable>
            </View>

            <Text style={styles.translatorTopTitle}>SignSight</Text>

            <View style={styles.translatorTopBarRight}>
              <Pressable
                onPress={() => {
                  setShowTranslatorMenu((value) => !value);
                  setShowTranslatorModeChoices(false);
                }}
                style={({ pressed }) => [
                  styles.topBarIconButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {!isLab && showTranslatorMenu ? (
          <View style={[styles.translatorMenuWrap, { top: translatorTopBarTop + 50 }]}>
            <View style={styles.translatorMenuCard}>
              <Pressable
                onPress={openTranslatorModelSheet}
                style={({ pressed }) => [
                  styles.translatorMenuItem,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={styles.translatorMenuItemLeft}>
                  <Ionicons name="layers-outline" size={18} color={TEXT} />
                  <Text style={styles.translatorMenuItemTitle}>Model</Text>
                </View>
                <Text style={styles.translatorMenuItemMeta} numberOfLines={1}>
                  {String(
                    activeLandmarkModelVersion?.label ??
                      activeLandmarkModelVersionId ??
                      "Choose"
                  )}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setShowTranslatorModeChoices((value) => !value)
                }
                style={({ pressed }) => [
                  styles.translatorMenuItem,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={styles.translatorMenuItemLeft}>
                  <Ionicons
                    name={
                      detectMode === "LETTERS"
                        ? "text-outline"
                        : "chatbubble-ellipses-outline"
                    }
                    size={18}
                    color={TEXT}
                  />
                  <Text style={styles.translatorMenuItemTitle}>Mode</Text>
                </View>
                <View style={styles.translatorMenuItemRight}>
                  <Text style={styles.translatorMenuItemMeta}>
                    {detectMode === "LETTERS" ? "Letters" : "Words"}
                  </Text>
                  <Ionicons
                    name={showTranslatorModeChoices ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={MUTED}
                  />
                </View>
              </Pressable>

              {showTranslatorModeChoices ? (
                <View style={styles.translatorModeChoices}>
                  {(["LETTERS", "WORDS"] as const).map((mode) => {
                    const isActive = detectMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => {
                          if (isRecordingGesture) {
                            setStatus("Stop recording first.");
                            return;
                          }
                          setDetectMode(mode);
                          setShowTranslatorModeChoices(false);
                          setShowTranslatorMenu(false);
                        }}
                        style={({ pressed }) => [
                          styles.translatorModeChoice,
                          isActive && styles.translatorModeChoiceActive,
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.translatorModeChoiceText,
                            isActive && styles.translatorModeChoiceTextActive,
                          ]}
                        >
                          {mode === "LETTERS" ? "Letters" : "Words"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {isLab ? (
        <View
          style={[
            styles.labSheetWrap,
            { left: PAD, right: PAD, bottom: bottomSafeLift },
          ]}
        >
          <View style={[styles.labSheet, { maxHeight: labSheetMaxHeight }]}>
            <ScrollView
              contentContainerStyle={[
                styles.labSheetContent,
                { paddingBottom: 18 },
              ]}
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Developer Lab</Text>
              <Text style={styles.panelSub}>
                {detectMode} • {cameraPosition.toUpperCase()}
              </Text>
            </View>

            <LabSection
              title="Session"
              subtitle="Choose the recognition flow and active camera."
            >
              <View style={styles.btnRow}>
                <Pressable
                  onPress={() => {
                    if (isRecordingGesture) {
                      setStatus("Stop recording first.");
                      return;
                    }
                    setDetectMode((m) => {
                      const next = m === "LETTERS" ? "WORDS" : "LETTERS";
                      if (next === "LETTERS") {
                        setIsRecordingGesture(false);
                        clearRecordBuffer();
                        clearPredictBuffer();
                      }
                      return next;
                    });
                  }}
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnText}>
                    Mode: {detectMode === "LETTERS" ? "Letters" : "Words"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setCameraPosition((p) => (p === "back" ? "front" : "back"))
                  }
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnText}>
                    Camera: {cameraPosition.toUpperCase()}
                  </Text>
                </Pressable>
              </View>

              {detectMode === "LETTERS" &&
              availableLandmarkModelVersions.length > 0 ? (
                <View style={styles.modelPickerCard}>
                  <Text style={styles.labFieldLabel}>Model</Text>
                  <Pressable
                    onPress={() => setShowModelVersions((value) => !value)}
                    style={({ pressed }) => [
                      styles.modelPickerTrigger,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <View style={styles.modelPickerTriggerTextWrap}>
                      <Text style={styles.modelPickerPrimary} numberOfLines={1}>
                        {String(
                          activeLandmarkModelVersion?.label ??
                            activeLandmarkModelVersionId ??
                            "No active model"
                        )}
                      </Text>
                      <Text style={styles.modelPickerMeta} numberOfLines={1}>
                        {activeLandmarkModelVersion
                          ? `${
                              activeLandmarkModelVersion.training_mode ===
                              "bootstrap"
                                ? "Bootstrap"
                                : "Full reviewed"
                            } • ${
                              Array.isArray(
                                activeLandmarkModelVersion.active_static_letters
                              )
                                ? `${activeLandmarkModelVersion.active_static_letters.length} active letters`
                                : "unknown classes"
                            }`
                          : "Choose the serving static model"}
                      </Text>
                    </View>
                    <Ionicons
                      name={showModelVersions ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={TEXT}
                    />
                  </Pressable>

                  {showModelVersions ? (
                    <View style={styles.modelDropdownList}>
                      {availableLandmarkModelVersions.map((version) => {
                        const versionId = String(version.version_id);
                        const isActive =
                          versionId === activeLandmarkModelVersionId;
                        const mode =
                          version.training_mode === "bootstrap"
                            ? "bootstrap"
                            : "full reviewed";
                        return (
                          <View
                            key={versionId}
                            style={[
                              styles.versionCard,
                              isActive && styles.versionCardActive,
                            ]}
                          >
                            <Pressable
                              onPress={() =>
                                activateLandmarkModelVersion(versionId)
                              }
                              style={({ pressed }) => [
                                styles.modelDropdownSelect,
                                pressed && { opacity: 0.88 },
                              ]}
                            >
                              <Text style={styles.versionTitle}>
                                {String(version.label ?? versionId)}
                              </Text>
                              <Text style={styles.inputHelperText}>
                                {mode} •{" "}
                                {Array.isArray(version.active_static_letters)
                                  ? `${version.active_static_letters.length} active letters`
                                  : "unknown classes"}
                              </Text>
                              {version.trained_at ? (
                                <Text style={styles.inputHelperText}>
                                  {version.trained_at}
                                </Text>
                              ) : null}
                              <Text style={styles.inputHelperText}>
                                {isActive
                                  ? "Currently serving"
                                  : "Tap to switch active model"}
                              </Text>
                            </Pressable>
                            <View style={styles.renameRow}>
                              <TextInput
                                value={
                                  modelRenameDrafts[versionId] ??
                                  String(version.label ?? versionId)
                                }
                                onChangeText={(text) =>
                                  setModelRenameDrafts((current) => ({
                                    ...current,
                                    [versionId]: text,
                                  }))
                                }
                                placeholder="Rename model version"
                                placeholderTextColor={MUTED}
                                style={[styles.input, styles.renameInput]}
                              />
                              <Pressable
                                onPress={() =>
                                  renameLandmarkModelVersion(versionId)
                                }
                                style={({ pressed }) => [
                                  styles.btn,
                                  styles.renameButton,
                                  pressed && { opacity: 0.85 },
                                ]}
                              >
                                <Text style={styles.btnText}>Rename</Text>
                              </Pressable>
                              {!isActive ? (
                                <Pressable
                                  onPress={() =>
                                    confirmArchiveLandmarkModelVersion(versionId)
                                  }
                                  style={({ pressed }) => [
                                    styles.btn,
                                    styles.renameButton,
                                    styles.archiveButton,
                                    pressed && { opacity: 0.85 },
                                  ]}
                                >
                                  <Text style={styles.btnText}>Archive</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {detectMode === "LETTERS" &&
              archivedLandmarkModelVersions.length > 0 ? (
                <View style={styles.modelPickerCard}>
                  <Text style={styles.labFieldLabel}>Archived Models</Text>
                  <Pressable
                    onPress={() => setShowArchivedModelVersions((value) => !value)}
                    style={({ pressed }) => [
                      styles.modelPickerTrigger,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <View style={styles.modelPickerTriggerTextWrap}>
                      <Text style={styles.modelPickerPrimary} numberOfLines={1}>
                        {archivedLandmarkModelVersions.length} archived models
                      </Text>
                      <Text style={styles.modelPickerMeta} numberOfLines={1}>
                        View model versions that were archived instead of deleted
                      </Text>
                    </View>
                    <Ionicons
                      name={showArchivedModelVersions ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={TEXT}
                    />
                  </Pressable>

                  {showArchivedModelVersions ? (
                    <View style={styles.modelDropdownList}>
                      {archivedLandmarkModelVersions.map((version) => {
                        const versionId = String(version.version_id);
                        const mode =
                          version.training_mode === "bootstrap"
                            ? "bootstrap"
                            : "full reviewed";
                        return (
                          <View key={versionId} style={styles.versionCard}>
                            <Text style={styles.versionTitle}>
                              {String(version.label ?? versionId)}
                            </Text>
                            <Text style={styles.inputHelperText}>
                              {mode} •{" "}
                              {Array.isArray(version.active_static_letters)
                                ? `${version.active_static_letters.length} active letters`
                                : "unknown classes"}
                            </Text>
                            {version.trained_at ? (
                              <Text style={styles.inputHelperText}>
                                Trained: {version.trained_at}
                              </Text>
                            ) : null}
                            {version.archived_at ? (
                              <Text style={styles.inputHelperText}>
                                Archived: {version.archived_at}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.targetPickerCard}>
                <Text style={styles.labFieldLabel}>
                  {detectMode === "WORDS" ? "Select word" : "Select label"}
                </Text>
                <Pressable
                  onPress={() => setShowTargetChoices((value) => !value)}
                  style={({ pressed }) => [
                    styles.targetPickerTrigger,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <View style={styles.targetPickerTriggerTextWrap}>
                    <Text style={styles.targetPickerPrimary} numberOfLines={1}>
                      {selectedTargetValue ?? "N/A"}
                    </Text>
                    <Text style={styles.targetPickerMeta} numberOfLines={2}>
                      {detectMode === "WORDS"
                        ? selectedWordIsStaticLandmark
                          ? "Choose which static word landmark target to save and train."
                          : "Choose which gesture label to record and save."
                        : selectedLabel
                          ? selectedLabelIsActive
                            ? "Active in the serving static model."
                            : selectedLabelIsReady
                              ? `Quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"}, but not active until the next train.`
                              : `Collectable now, but not quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"} yet.`
                          : "Choose which static letter label to collect and save."}
                    </Text>
                  </View>
                  <Ionicons
                    name={showTargetChoices ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={TEXT}
                  />
                </Pressable>

                {showTargetChoices ? (
                  <View style={styles.targetDropdownList}>
                    <ScrollView
                      style={styles.targetChoicesScroll}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <Pressable
                        onPress={() => {
                          if (detectMode === "WORDS") {
                            setSelectedWord(null);
                          } else {
                            setSelectedLabel(null);
                            setSelectedLabelSummary(null);
                          }
                          setShowTargetChoices(false);
                        }}
                        style={({ pressed }) => [
                          styles.targetChoiceCard,
                          !selectedTargetValue && styles.targetChoiceCardActive,
                          pressed && { opacity: 0.88 },
                        ]}
                      >
                        <Text style={styles.targetChoiceTitle}>N/A</Text>
                        <Text style={styles.inputHelperText}>
                          No target selected yet.
                        </Text>
                      </Pressable>

                      {currentTargetChoices.map((choice) => {
                        const isSelected = selectedTargetValue === choice;
                        return (
                          <Pressable
                            key={choice}
                            onPress={() => {
                              if (detectMode === "WORDS") {
                                setSelectedWord(choice as WordLabel);
                              } else {
                                setSelectedLabel(
                                  choice as (typeof STATIC_ASL_LABELS)[number]
                                );
                              }
                              setShowTargetChoices(false);
                            }}
                            style={({ pressed }) => [
                              styles.targetChoiceCard,
                              isSelected && styles.targetChoiceCardActive,
                              pressed && { opacity: 0.88 },
                            ]}
                          >
                            <Text style={styles.targetChoiceTitle}>{choice}</Text>
                            <Text style={styles.inputHelperText}>
                              {detectMode === "WORDS"
                                ? choice === "I_LOVE_YOU"
                                  ? "Static landmark word"
                                  : "Gesture label"
                                : activeStaticLetters.includes(
                                      choice as (typeof STATIC_ASL_LABELS)[number]
                                    )
                                  ? "Active in serving model"
                                  : readyStaticLettersByMode[
                                        landmarkTrainingMode
                                      ].includes(
                                        choice as (typeof STATIC_ASL_LABELS)[number]
                                      )
                                    ? "Quota-ready for next retrain"
                                    : "Still in collection"}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View style={styles.labFieldCard}>
                <View>
                  <Text style={styles.labFieldLabel}>
                    {detectMode === "WORDS" ? "Target word" : "Target label"}
                  </Text>
                  <Text style={styles.labFieldValue}>
                    {detectMode === "WORDS"
                      ? selectedWord ?? "N/A"
                      : selectedLabel ?? "N/A"}
                  </Text>
                  {detectMode === "LETTERS" ? (
                    <Text style={styles.labHelperText}>
                      {selectedLabel
                        ? selectedLabelIsActive
                        ? "Active in the trained static model."
                        : selectedLabelIsReady
                          ? `Quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"}, but not active until the next train.`
                          : `Collectable now, but not quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"} yet.`
                        : "No target selected yet."}
                    </Text>
                  ) : (
                    <Text style={styles.labHelperText}>
                      {selectedWord
                        ? selectedWordIsStaticLandmark
                          ? activeStaticWordLabels.includes(selectedWord)
                            ? "Active in the serving landmark model."
                            : "Selected static landmark word target."
                          : "Selected gesture target for recording and saving."
                        : "No target selected yet."}
                    </Text>
                  )}
                </View>
              </View>

              {detectMode === "WORDS" ? (
                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Live"
                    value={`${liveGestureFramesCount}/${GESTURE_FRAMES}`}
                  />
                  <LabSummaryPill
                    label={selectedWordIsStaticLandmark ? "Capture" : "Recorded"}
                    value={
                      selectedWordIsStaticLandmark
                        ? "Single frame"
                        : `${recordingGestureFramesCount}/${GESTURE_FRAMES}`
                    }
                  />
                  <LabSummaryPill
                    label="State"
                    value={
                      selectedWordIsStaticLandmark
                        ? "Static word"
                        : isRecordingGesture
                          ? "Recording"
                          : "Idle"
                    }
                    tone={
                      selectedWordIsStaticLandmark || isRecordingGesture
                        ? "accent"
                        : "neutral"
                    }
                  />
                </View>
              ) : (
                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Target"
                    value={selectedLabel ?? "N/A"}
                  />
                  <LabSummaryPill
                    label="Session"
                    value={captureSessionId}
                  />
                  <LabSummaryPill
                    label="Save"
                    value="Pending review"
                    tone="accent"
                  />
                </View>
              )}
            </LabSection>

            <LabSection
              title="Live Status"
              subtitle="Compact operator feedback for the current hand and prediction."
            >
              <View style={styles.labStatusCard}>
                <View style={styles.labStatusHeader}>
                  <View>
                    <Text style={styles.labFieldLabel}>Filtered prediction</Text>
                    <Text style={styles.labStatusPrimary} numberOfLines={1}>
                      {displayLabel}
                    </Text>
                  </View>
                  <View style={styles.labStatusBadge}>
                    <Text style={styles.labStatusBadgeText}>
                      {Math.round(lastConf * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.labStatusRow}>
                  <Text style={styles.labStatusMeta}>
                    Raw {rawLabel} • Hand {lastHandedness ?? "-"}
                  </Text>
                  <Text style={styles.labStatusMeta}>
                    {debugState.hasHand ? "Hand detected" : "No hand"}
                  </Text>
                </View>

                {detectMode === "LETTERS" ? (
                  <Text style={styles.labStatusModelText}>
                    Serving{" "}
                    {activeLandmarkModelVersion?.label ??
                      activeLandmarkModelVersionId ??
                      "no saved model"}{" "}
                    •{" "}
                    {currentLandmarkTrainingMode === "bootstrap"
                      ? "bootstrap"
                      : "full reviewed"}
                  </Text>
                ) : (
                  <Text style={styles.labStatusModelText}>
                    {selectedWordIsStaticLandmark
                      ? `Landmark model ${
                          activeLandmarkModelVersion?.label ??
                          activeLandmarkModelVersionId ??
                          "not trained"
                        } • ${activeStaticWordLabels.length} active static words`
                      : `Gesture buffer ${currentWordFramesCount}/${GESTURE_FRAMES}`}
                  </Text>
                )}
              </View>
            </LabSection>

            {detectMode === "LETTERS" ? (
              <LabSection
                title="Dataset Status"
                subtitle="Current target counts, save policy, and session progress."
              >
                <View style={styles.trainingModeCard}>
                  <Text style={styles.labFieldLabel}>Save policy</Text>
                  <Text style={styles.labFieldValue}>New samples save as approved</Text>
                  <Text style={styles.labHelperTextTight}>
                    Developer Lab captures are approved immediately, so they count toward training as soon as they are saved.
                  </Text>
                </View>

                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Approved"
                    value={String(selectedLabelSummary?.approved ?? 0)}
                  />
                  <LabSummaryPill
                    label="Pending"
                    value={String(selectedLabelSummary?.pending ?? 0)}
                  />
                  <LabSummaryPill
                    label="This Session"
                    value={String(selectedLabelSummary?.session_total ?? 0)}
                    tone="accent"
                  />
                </View>

                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Left"
                    value={String(selectedLabelSummary?.by_hand.Left ?? 0)}
                  />
                  <LabSummaryPill
                    label="Right"
                    value={String(selectedLabelSummary?.by_hand.Right ?? 0)}
                  />
                  <LabSummaryPill
                    label="Session Pending"
                    value={String(selectedLabelSummary?.session_pending ?? 0)}
                  />
                </View>

                <View style={styles.datasetInsightCard}>
                  <Text style={styles.datasetInsightTitle}>Current target</Text>
                  <Text style={styles.datasetInsightText}>
                    {selectedLabelIsActive
                      ? `${selectedLabel} is already active in the serving static model.`
                      : selectedLabelIsReady
                        ? `${selectedLabel} is quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"} and will join the next trained model.`
                        : `${selectedLabel} is still in collection. Keep saving approved samples until it reaches quota for the next retrain.`}
                  </Text>
                </View>
              </LabSection>
            ) : null}

            {detectMode === "WORDS" && selectedWordIsStaticLandmark ? (
              <LabSection
                title="Static Word Dataset"
                subtitle="Current dataset and model status for this landmark-based word."
              >
                <View style={styles.trainingModeCard}>
                  <Text style={styles.labFieldLabel}>Save policy</Text>
                  <Text style={styles.labFieldValue}>New samples save as approved</Text>
                  <Text style={styles.labHelperTextTight}>
                    I_LOVE_YOU is stored in the static word landmark dataset and counts toward the next static-word retrain immediately.
                  </Text>
                </View>

                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Approved"
                    value={String(selectedStaticWordCounts?.approved ?? 0)}
                  />
                  <LabSummaryPill
                    label="Pending"
                    value={String(selectedStaticWordCounts?.pending ?? 0)}
                  />
                  <LabSummaryPill
                    label="Model"
                    value={activeStaticWordLabels.includes("I_LOVE_YOU") ? "Active" : "Rule fallback"}
                    tone="accent"
                  />
                </View>

                <View style={styles.datasetInsightCard}>
                  <Text style={styles.datasetInsightTitle}>Training status</Text>
                  <Text style={styles.datasetInsightText}>
                    {activeStaticWordLabels.includes("I_LOVE_YOU")
                      ? "I_LOVE_YOU is active in the serving landmark model."
                      : "I_LOVE_YOU stays rule-based until you retrain the main landmark model with the saved word landmark dataset included."}
                  </Text>
                </View>
              </LabSection>
            ) : null}

            <LabSection
              title="Training"
              subtitle={
                detectMode === "WORDS"
                  ? "Model training is separate from capture so it is harder to trigger by accident."
                  : "Retrain from the saved landmark dataset, create a new model version, then switch the active model when you are ready."
              }
            >
              {detectMode === "LETTERS" || (detectMode === "WORDS" && selectedWordIsStaticLandmark) ? (
                <View style={styles.trainingModeCard}>
                  <Text style={styles.labFieldLabel}>Retrain from saved dataset</Text>
                  <View style={styles.btnRow}>
                    <Pressable
                      onPress={() => setLandmarkTrainingMode("bootstrap")}
                      style={({ pressed }) => [
                        styles.btn,
                        landmarkTrainingMode === "bootstrap" && styles.btnAccent,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          landmarkTrainingMode === "bootstrap" &&
                            styles.btnTextDark,
                        ]}
                      >
                        Bootstrap
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setLandmarkTrainingMode("full_reviewed")}
                      style={({ pressed }) => [
                        styles.btn,
                        landmarkTrainingMode === "full_reviewed" &&
                          styles.btnAccent,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          landmarkTrainingMode === "full_reviewed" &&
                            styles.btnTextDark,
                        ]}
                      >
                        Full Reviewed
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.labFieldValue}>
                    {landmarkTrainingMode === "bootstrap"
                      ? "Retrain Bootstrap Model"
                      : "Retrain Full Reviewed Model"}
                  </Text>
                  <Text style={styles.labHelperTextTight}>
                    {landmarkTrainingMode === "bootstrap"
                      ? "Bootstrap mode is for solo or early internal testing with lower quotas."
                      : "Full reviewed mode uses the stricter final dataset quotas."}{" "}
                    Retraining uses the saved approved landmark dataset
                    {selectedWordIsStaticLandmark
                      ? ", including approved static word landmarks,"
                      : ""}{" "}
                    and creates a new model version without overwriting the old one.
                  </Text>
                  <Text style={styles.inputHelperText}>
                    Current serving mode:{" "}
                    {currentLandmarkTrainingMode === "bootstrap"
                      ? "bootstrap"
                      : "full reviewed"}
                    .
                  </Text>
                  {activeLandmarkModelVersionId ? (
                    <Text style={styles.inputHelperText}>
                      Active version: {activeLandmarkModelVersionId}
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={trainLandmarks}
                    style={({ pressed }) => [
                      styles.btnPrimary,
                      styles.btnBlock,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {landmarkTrainingMode === "bootstrap"
                        ? "Create New Bootstrap Model Version"
                        : "Create New Full Reviewed Model Version"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.trainingNotice}>
                <Ionicons name="alert-circle-outline" size={18} color={ACCENT} />
                <Text style={styles.trainingNoticeText}>
                  {detectMode === "WORDS"
                    ? selectedWordIsStaticLandmark
                      ? "Static word landmarks are learned through the main landmark retrain, not a separate model."
                      : "Train only after you have collected enough clean samples for the current target set."
                    : landmarkTrainingMode === "bootstrap"
                      ? "Bootstrap mode is temporary and should not be treated as the final shared model."
                      : "Full reviewed mode expects the stricter final dataset quotas and signer diversity."}
                </Text>
              </View>

              {detectMode === "WORDS" && selectedWordIsStaticLandmark ? (
                <Pressable
                  onPress={trainLandmarks}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    styles.btnBlock,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>
                    {landmarkTrainingMode === "bootstrap"
                      ? "Create New Bootstrap Landmark Model Version"
                      : "Create New Full Reviewed Landmark Model Version"}
                  </Text>
                </Pressable>
              ) : null}

              {detectMode === "WORDS" && !selectedWordIsStaticLandmark ? (
                <Pressable
                  onPress={trainGestures}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    styles.btnBlock,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>Train Gesture Model</Text>
                </Pressable>
              ) : null}
            </LabSection>

            <LabSection
              title="Capture"
              subtitle={
                detectMode === "WORDS"
                  ? selectedWordIsStaticLandmark
                    ? "Save a single landmark sample for the selected static word."
                    : "Record or save gesture samples for the selected word."
                  : "Save single-frame landmark samples for the selected label."
              }
            >
              {detectMode === "WORDS" ? (
                selectedWordIsStaticLandmark ? (
                  <>
                    <View style={styles.labFieldCard}>
                      <View>
                        <Text style={styles.labFieldLabel}>Static word capture</Text>
                        <Text style={styles.labFieldValue}>Single landmark sample</Text>
                        <Text style={styles.labHelperText}>
                          I_LOVE_YOU uses the word landmark dataset, then joins the main landmark model on the next retrain.
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={saveOneStaticWordLandmarkSample}
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        styles.btnBlock,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={styles.btnPrimaryText}>Save Static Word Landmark</Text>
                    </Pressable>
                  </>
                ) : (
                <>
                  <View
                    style={[
                      styles.labFieldCard,
                      isRecordingGesture && styles.labFieldCardAccent,
                    ]}
                  >
                    <View>
                      <Text style={styles.labFieldLabel}>Recording</Text>
                      <Text style={styles.labFieldValue}>
                        {isRecordingGesture
                          ? "Gesture capture is active"
                          : "Ready to record"}
                      </Text>
                      <Text style={styles.labHelperText}>
                        {isRecordingGesture
                          ? "Move through the full gesture, then stop recording before saving."
                          : "Start recording to collect a fresh gesture sequence."}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.btnRow}>
                    <Pressable
                      onPress={toggleGestureRecording}
                      style={({ pressed }) => [
                        styles.btn,
                        pressed && { opacity: 0.85 },
                        isRecordingGesture && styles.btnAccent,
                      ]}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          isRecordingGesture && styles.btnTextDark,
                        ]}
                      >
                        {isRecordingGesture ? "Stop Recording" : "Start Recording"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={saveGestureSample}
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={styles.btnPrimaryText}>Save Gesture Sample</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => {
                      clearRecordBuffer();
                      clearPredictBuffer();
                      setStatus("Cleared frames.");
                    }}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnBlock,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.btnText}>Clear Live and Recorded Frames</Text>
                  </Pressable>
                </>
                )
              ) : (
                <>
                  <View style={styles.labFieldCard}>
                    <View>
                      <Text style={styles.labFieldLabel}>Sample capture</Text>
                      <Text style={styles.labFieldValue}>Single landmark sample</Text>
                      <Text style={styles.labHelperText}>
                        Save the current hand landmarks to the selected letter label.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={saveOneLandmarkSample}
                    style={({ pressed }) => [
                      styles.btnPrimary,
                      styles.btnBlock,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnPrimaryText}>Save Landmark Sample</Text>
                  </Pressable>
                </>
              )}
            </LabSection>

            {detectMode === "LETTERS" ? (
              <LabSection
                title="Capture Setup"
                subtitle="These fields are only needed when you save new static samples."
              >
                <View style={styles.metadataStack}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Signer ID</Text>
                    <TextInput
                      value={signerId}
                      onChangeText={setSignerId}
                      style={styles.input}
                      placeholder="person_01"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Capture Session ID</Text>
                    <TextInput
                      value={captureSessionId}
                      onChangeText={setCaptureSessionId}
                      style={styles.input}
                      placeholder="2026-04-01_lab"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Variant Tags</Text>
                    <TextInput
                      value={variantTagsText}
                      onChangeText={setVariantTagsText}
                      style={styles.input}
                      placeholder="neutral, slight_rotation"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.inputHelperText}>
                      New static samples from Developer Lab save as approved and are included in training immediately.
                    </Text>
                  </View>
                </View>
              </LabSection>
            ) : null}

            <LabSection
              title="Diagnostics"
              subtitle="Show raw output and secondary metrics only when you need them."
            >
              <Pressable
                onPress={() => setShowLabDiagnostics((value) => !value)}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnBlock,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.btnText}>
                  {showLabDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
                </Text>
              </Pressable>

              {showLabDiagnostics ? (
                <View style={styles.diagnosticsCard}>
                  <Text style={styles.debugLine}>
                    Raw: {rawLabel} • Hand: {lastHandedness ?? "-"}
                  </Text>
                  <Text style={styles.debugLine}>
                    FPS: {fpsCounter} • LM: {lmFps}/s • PRED: {predictionRate}/s
                  </Text>
                  <Text style={styles.debugLine}>
                    Grace: {wordGraceActive ? "ON" : "OFF"} • Smoothing:{" "}
                    {isOverlaySmoothing ? "ON" : "OFF"}
                  </Text>
                  <Text style={styles.debugLine}>
                    Gesture Pred Age:{" "}
                    {lastGesturePredictionAgeMs == null
                      ? "-"
                      : `${lastGesturePredictionAgeMs}ms`}
                  </Text>
                  <Text style={styles.debugLine}>
                    Last Hand Age: {lastSeenAgeMs == null ? "-" : `${lastSeenAgeMs}ms`}
                  </Text>
                </View>
              ) : null}
            </LabSection>

            {!!status && <Text style={styles.status}>{status}</Text>}
            </ScrollView>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.translatorOutputWrap,
            { bottom: bottomSafeLift + translatorBottomInset },
          ]}
        >
          <View style={styles.translatorOutputCard}>
            <View style={styles.translatorOutputTextWrap}>
              <Text style={styles.translatorOutputLabel} numberOfLines={1}>
                {displayLabel}
              </Text>
              <Text style={styles.translatorOutputConfidence}>
                {Math.round(lastConf * 100)}% confidence
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setCameraPosition((p) => (p === "back" ? "front" : "back"))
              }
              style={({ pressed }) => [
                styles.translatorFlipButton,
                pressed && { opacity: 0.78 },
              ]}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>
      )}

      {!isLab ? (
        <Modal
          visible={showTranslatorModelChoices}
          animationType="fade"
          transparent
          onRequestClose={() => setShowTranslatorModelChoices(false)}
        >
          <View style={styles.modelPickerBackdrop}>
            <SafeAreaView style={styles.modelPickerSafeArea}>
              <Pressable
                style={styles.modelPickerBackdropPressable}
                onPress={closeTranslatorModelSheet}
              />
              <Animated.View
                style={[
                  styles.modelPickerContainer,
                  {
                    maxHeight: translatorModelSheetMaxHeight,
                    transform: [{ translateY: translatorSheetTranslateY }],
                  },
                ]}
              >
                <View {...translatorSheetPanResponder.panHandlers}>
                  <View style={styles.modelPickerHandle} />
                </View>
                <View style={styles.modelPickerHeader}>
                  <View style={styles.modelPickerHeaderText}>
                    <Text style={styles.modelPickerEyebrow}>Model</Text>
                    <Text style={styles.modelPickerTitle}>Choose translation model</Text>
                    <Text style={styles.modelPickerSubtitle}>
                      Pick which saved SignSight model powers live translation.
                    </Text>
                  </View>
                  <Pressable
                    onPress={closeTranslatorModelSheet}
                    style={({ pressed }) => [
                      styles.modelPickerCloseButton,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={TEXT} />
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={styles.modelPickerList}
                  showsVerticalScrollIndicator={false}
                >
                  {availableLandmarkModelVersions.length === 0 ? (
                    <View style={styles.modelPickerEmptyState}>
                      <Ionicons name="cube-outline" size={28} color={MUTED} />
                      <Text style={styles.modelPickerEmptyTitle}>No saved models</Text>
                      <Text style={styles.modelPickerEmptyText}>
                        Train a landmark model in Developer Lab first.
                      </Text>
                    </View>
                  ) : (
                    availableLandmarkModelVersions.map((version) => {
                      const versionId = String(version.version_id);
                      const isActive = versionId === activeLandmarkModelVersionId;
                      return (
                        <Pressable
                          key={versionId}
                          onPress={() => {
                            if (!isActive) {
                              void activateLandmarkModelVersion(versionId);
                            }
                            closeTranslatorModelSheet();
                          }}
                          style={({ pressed }) => [
                            styles.modelPickerCard,
                            isActive && styles.modelPickerCardActive,
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <View style={styles.modelPickerCardMain}>
                            <View style={styles.modelPickerCardTitleRow}>
                              <Text style={styles.modelPickerCardTitle} numberOfLines={1}>
                                {String(version.label ?? versionId)}
                              </Text>
                              {isActive ? (
                                <View style={styles.modelPickerLiveBadge}>
                                  <View style={styles.modelPickerLiveDot} />
                                  <Text style={styles.modelPickerLiveText}>LIVE</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.modelPickerCardMeta} numberOfLines={1}>
                              {version.training_mode === "bootstrap"
                                ? "Bootstrap"
                                : "Full reviewed"}
                              {Array.isArray(version.active_static_letters)
                                ? ` · ${version.active_static_letters.length} letters`
                                : ""}
                            </Text>
                          </View>
                          {isActive ? (
                            <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
                          ) : (
                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </Animated.View>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function LabSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.labSection}>
      <View style={styles.labSectionHeader}>
        <Text style={styles.labSectionTitle}>{title}</Text>
        <Text style={styles.labSectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.labSectionBody}>{children}</View>
    </View>
  );
}

function LabSummaryPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <View
      style={[
        styles.labSummaryPill,
        tone === "accent" && styles.labSummaryPillAccent,
      ]}
    >
      <Text style={styles.labSummaryLabel}>{label}</Text>
      <Text
        style={[
          styles.labSummaryValue,
          tone === "accent" && styles.labSummaryValueAccent,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  cameraSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
  },
  text: { color: TEXT, fontWeight: "800" },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_XXS,
    paddingVertical: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_XS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  backText: { color: TEXT, fontWeight: "900" },

  topHud: { position: "absolute" },
  h1: { color: "#FFFFFF", fontSize: TYPOGRAPHY.TEXT_LG, fontWeight: "900", marginTop: SPACING.SPACE_XS },

  chipsRow: { flexDirection: "row", gap: SPACING.SPACE_XS, marginTop: SPACING.SPACE_XS, flexWrap: "wrap" },
  chip: {
    paddingVertical: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_XS,
    borderRadius: 999,
    backgroundColor: "rgba(255,249,242,0.88)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.95)",
  },
  chipText: { color: TEXT, fontWeight: "900", fontSize: TYPOGRAPHY.TEXT_XS },
  centerHud: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 28,
    paddingVertical: SPACING.SPACE_LG,
    paddingHorizontal: SPACING.SPACE_LG,
    backgroundColor: "rgba(255,255,255,0.90)",
    borderWidth: 1,
    borderColor: BORDER,
    ...Platform.select({
      android: { elevation: 5 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  predictionWrap: {
    flex: 1,
    gap: 2,
  },
  predictionLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_3XL,
    letterSpacing: -0.2,
  },
  rawMeta: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  confidenceIndicator: {
    alignItems: "flex-end",
    gap: 0,
  },
  confidenceText: {
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_LG,
    lineHeight: 22,
  },
  confidenceMetaText: {
    color: MUTED,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    letterSpacing: 0.5,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  modelText: {
    color: MUTED,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  translatorTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
  },
  translatorTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  translatorTopBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.SPACE_MD,
    minHeight: 44,
    position: "relative",
  },
  translatorTopBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
    minWidth: 92,
    zIndex: 10,
  },
  translatorTopBarRight: {
    minWidth: 44,
    alignItems: "flex-end",
    zIndex: 10,
  },
  topBarIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarIconButtonDisabled: {
    opacity: 0.4,
  },
  translatorTopTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlignVertical: "center",
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_LG,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    ...Platform.select({
      ios: {
        lineHeight: 44,
      },
      android: {
        textAlignVertical: "center",
      },
    }),
  },
  translatorMenuWrap: {
    position: "absolute",
    right: SPACING.SPACE_MD,
    zIndex: 25,
  },
  translatorMenuCard: {
    minWidth: 220,
    borderRadius: 22,
    backgroundColor: "rgba(255,249,242,0.98)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.96)",
    padding: SPACING.SPACE_SM,
    gap: SPACING.SPACE_XXS,
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  translatorMenuItem: {
    borderRadius: 16,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },
  translatorMenuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_XS,
    minWidth: 0,
    flex: 1,
  },
  translatorMenuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_XXS,
  },
  translatorMenuItemTitle: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  translatorMenuItemMeta: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    maxWidth: 104,
  },
  translatorModeChoices: {
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
    paddingTop: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_XXS,
  },
  translatorModeChoice: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.92)",
  },
  translatorModeChoiceActive: {
    backgroundColor: SOFT_PINK,
    borderColor: "rgba(190,24,93,0.18)",
  },
  translatorModeChoiceText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  translatorModeChoiceTextActive: {
    color: ACCENT,
  },
  translatorOutputWrap: {
    position: "absolute",
    left: SPACING.SPACE_MD,
    right: SPACING.SPACE_MD,
    zIndex: 15,
  },
  translatorOutputCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_MD,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    borderRadius: 24,
    backgroundColor: "rgba(17,24,39,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  translatorOutputTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  translatorOutputLabel: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_2XL,
    letterSpacing: 0.1,
  },
  translatorOutputConfidence: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    marginTop: 4,
  },
  translatorFlipButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  modelPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(31,41,55,0.20)",
    justifyContent: "flex-end",
  },
  modelPickerSafeArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modelPickerBackdropPressable: {
    flex: 1,
  },
  modelPickerContainer: {
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: SPACING.SPACE_XS,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  modelPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.SPACE_MD,
    paddingTop: SPACING.SPACE_MD,
    paddingBottom: SPACING.SPACE_SM,
    gap: SPACING.SPACE_SM,
  },
  modelPickerHeaderText: {
    flex: 1,
  },
  modelPickerHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151,109,78,0.28)",
    marginTop: SPACING.SPACE_XS,
    marginBottom: SPACING.SPACE_SM,
  },
  modelPickerEyebrow: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_SM,
    marginBottom: 2,
  },
  modelPickerTitle: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_LG,
  },
  modelPickerSubtitle: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    marginTop: SPACING.SPACE_XXS,
  },
  modelPickerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modelPickerList: {
    padding: SPACING.SPACE_MD,
    gap: SPACING.SPACE_SM,
    paddingBottom: SPACING.SPACE_2XL,
  },
  modelPickerEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.SPACE_2XL,
    gap: SPACING.SPACE_XS,
  },
  modelPickerEmptyTitle: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_MD,
  },
  modelPickerEmptyText: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_SM,
    textAlign: "center",
  },
  modelPickerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
    padding: SPACING.SPACE_MD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  modelPickerCardActive: {
    borderColor: "rgba(230,110,25,0.30)",
    backgroundColor: "rgba(255,243,224,0.85)",
  },
  modelPickerCardMain: {
    flex: 1,
    minWidth: 0,
  },
  modelPickerCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_XS,
  },
  modelPickerCardTitle: {
    flex: 1,
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  modelPickerCardMeta: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    marginTop: SPACING.SPACE_XXS,
  },
  modelPickerLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.SPACE_XS,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.18)",
  },
  modelPickerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#16A34A",
  },
  modelPickerLiveText: {
    color: "#15803D",
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    letterSpacing: 0.4,
  },

  // --- MODERN MINIMAL HUD ---
  minimalHeader: {
    paddingTop: 52,
    paddingHorizontal: SPACING.SPACE_MD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  minimalBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  minimalHeaderStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_XS,
  },
  minimalBrandLabel: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_MD,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  unifiedBottomPanel: {
    position: "absolute",
    left: SPACING.SPACE_SM,
    right: SPACING.SPACE_SM,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  panelTop: {
    padding: SPACING.SPACE_SM,
    paddingHorizontal: SPACING.SPACE_MD,
  },
  panelBottom: {
    padding: SPACING.SPACE_XS,
    backgroundColor: "rgba(249,250,251,0.5)",
    borderTopWidth: 1,
    borderTopColor: "rgba(229,231,235,0.5)",
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: SPACING.SPACE_XS,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionBtnText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },

  labSheetWrap: {
    position: "absolute",
  },
  labSheet: {
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: "48%",
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  labSheetContent: {
    padding: SPACING.SPACE_MD,
  },
  translatorControlsWrap: {
    position: "absolute",
    gap: SPACING.SPACE_SM,
  },
  translatorControls: {
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
    borderRadius: 24,
    padding: SPACING.SPACE_SM,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: BORDER,
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  panelHeader: { marginBottom: SPACING.SPACE_SM },
  panelTitle: { color: TEXT, fontWeight: "900", fontSize: TYPOGRAPHY.TEXT_SM },
  panelSub: { color: MUTED, marginTop: SPACING.SPACE_XXS, fontWeight: "700" },
  labSection: {
    marginTop: SPACING.SPACE_SM,
    paddingTop: SPACING.SPACE_SM,
    borderTopWidth: 1,
    borderTopColor: "rgba(229,231,235,0.9)",
  },
  labSectionHeader: {
    marginBottom: SPACING.SPACE_XS,
  },
  labSectionTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
    letterSpacing: 0.3,
  },
  labSectionSubtitle: {
    color: MUTED,
    marginTop: SPACING.SPACE_XXS,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  labSectionBody: {
    gap: SPACING.SPACE_XS,
  },
  labFieldCard: {
    padding: SPACING.SPACE_MD,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },
  labFieldCardAccent: {
    backgroundColor: SOFT_PINK,
    borderColor: "rgba(249,168,212,0.45)",
  },
  labFieldLabel: {
    color: MUTED,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labFieldValue: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_LG,
    marginTop: SPACING.SPACE_XXS,
  },
  labHelperText: {
    color: MUTED,
    fontWeight: "700",
    marginTop: SPACING.SPACE_XXS,
    lineHeight: 18,
    maxWidth: 280,
  },
  labHelperTextTight: {
    color: MUTED,
    fontWeight: "700",
    lineHeight: 18,
  },
  dashboardLinks: {
    marginTop: SPACING.SPACE_XXS,
    flexDirection: "row",
    gap: SPACING.SPACE_SM,
  },
  labSummaryRow: {
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
    flexWrap: "wrap",
  },
  labStatusCard: {
    padding: SPACING.SPACE_MD,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: BORDER,
    gap: SPACING.SPACE_XS,
  },
  labStatusHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },
  labStatusPrimary: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_2XL,
    marginTop: SPACING.SPACE_XXS,
  },
  labStatusBadge: {
    paddingVertical: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_XS,
    borderRadius: 999,
    backgroundColor: SOFT_BLUE,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.24)",
  },
  labStatusBadgeText: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  labStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
    flexWrap: "wrap",
  },
  labStatusMeta: {
    color: MUTED,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  labStatusModelText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  datasetInsightCard: {
    padding: SPACING.SPACE_MD,
    borderRadius: 18,
    backgroundColor: "rgba(243,244,246,0.92)",
    borderWidth: 1,
    borderColor: BORDER,
    gap: SPACING.SPACE_XXS,
  },
  datasetInsightTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  datasetInsightText: {
    color: MUTED,
    fontWeight: "700",
    lineHeight: 18,
  },
  metadataStack: {
    gap: SPACING.SPACE_XS,
  },
  inputGroup: {
    gap: SPACING.SPACE_XXS,
  },
  inputLabel: {
    color: MUTED,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    color: TEXT,
    fontWeight: "800",
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_XS,
  },
  inputHelperText: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    lineHeight: 16,
  },
  renameRow: {
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
    alignItems: "center",
  },
  renameInput: {
    flex: 1,
  },
  renameButton: {
    flex: 0,
    minWidth: 92,
  },
  archiveButton: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  labSummaryPill: {
    minWidth: 92,
    flexGrow: 1,
    paddingVertical: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_XS,
    borderRadius: 16,
    backgroundColor: "rgba(243,244,246,0.92)",
    borderWidth: 1,
    borderColor: BORDER,
  },
  labSummaryPillAccent: {
    backgroundColor: SOFT_PINK,
    borderColor: "rgba(249,168,212,0.45)",
  },
  labSummaryLabel: {
    color: MUTED,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labSummaryValue: {
    color: TEXT,
    fontWeight: "900",
    marginTop: SPACING.SPACE_XXS,
  },
  labSummaryValueAccent: {
    color: ACCENT,
  },

  btnRow: { flexDirection: "row", gap: SPACING.SPACE_XS },
  btn: {
    flex: 1,
    paddingVertical: SPACING.SPACE_SM,
    paddingHorizontal: SPACING.SPACE_SM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  btnBlock: {
    width: "100%",
  },
  btnText: { color: TEXT, fontWeight: "900" },

  btnAccent: {
    backgroundColor: SOFT_PINK,
    borderColor: "rgba(249,168,212,0.45)",
  },
  btnTextDark: { color: ACCENT },

  btnPrimary: {
    flex: 1,
    paddingVertical: SPACING.SPACE_SM,
    borderRadius: 16,
    borderColor: "rgba(249,168,212,0.45)",
    backgroundColor: SOFT_PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: ACCENT, fontWeight: "900" },
  trainingModeCard: {
    padding: SPACING.SPACE_MD,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    gap: SPACING.SPACE_XS,
  },
  modelPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
    paddingHorizontal: SPACING.SPACE_SM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(249,250,251,0.92)",
  },
  modelPickerTriggerTextWrap: {
    flex: 1,
    gap: SPACING.SPACE_XXS,
  },
  modelPickerPrimary: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  modelPickerMeta: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    lineHeight: 16,
  },
  modelDropdownList: {
    gap: SPACING.SPACE_XS,
  },
  modelDropdownSelect: {
    gap: SPACING.SPACE_XXS,
  },
  targetPickerCard: {
    padding: SPACING.SPACE_MD,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    gap: SPACING.SPACE_XS,
  },
  targetPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
    paddingHorizontal: SPACING.SPACE_SM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(249,250,251,0.92)",
  },
  targetPickerTriggerTextWrap: {
    flex: 1,
    gap: SPACING.SPACE_XXS,
  },
  targetPickerPrimary: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  targetPickerMeta: {
    color: MUTED,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    lineHeight: 16,
  },
  targetDropdownList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(249,250,251,0.96)",
    overflow: "hidden",
  },
  targetChoicesScroll: {
    maxHeight: 220,
  },
  targetChoiceCard: {
    padding: SPACING.SPACE_SM,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(229,231,235,0.9)",
    gap: SPACING.SPACE_XXS,
  },
  targetChoiceCardActive: {
    backgroundColor: SOFT_BLUE,
  },
  targetChoiceTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  versionList: {
    gap: SPACING.SPACE_XS,
  },
  versionCard: {
    padding: SPACING.SPACE_SM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(249,250,251,0.92)",
    gap: SPACING.SPACE_XXS,
  },
  versionCardActive: {
    backgroundColor: SOFT_BLUE,
    borderColor: "rgba(96,165,250,0.35)",
  },
  versionTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  trainingNotice: {
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
    padding: SPACING.SPACE_SM,
    borderRadius: 16,
    backgroundColor: "rgba(252,231,243,0.72)",
    borderWidth: 1,
    borderColor: "rgba(249,168,212,0.35)",
    alignItems: "flex-start",
  },
  trainingNoticeText: {
    flex: 1,
    color: ACCENT,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  diagnosticsCard: {
    padding: SPACING.SPACE_SM,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: BORDER,
    gap: SPACING.SPACE_XXS,
  },

  status: { marginTop: SPACING.SPACE_SM, color: TEXT, fontWeight: "800" },
  debugLine: {
    marginTop: SPACING.SPACE_XS,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "700",
  },

  wordInfoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.SPACE_XS },
  smallLabel: { color: MUTED, fontWeight: "800" },
  smallValue: { color: TEXT, fontWeight: "900" },
  smallMuted: { color: MUTED, fontWeight: "800" },

  pillMini: {
    paddingVertical: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_SM,
    borderRadius: 999,
    backgroundColor: SOFT_YELLOW,
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.45)",
  },
  pillMiniText: { color: "#92400E", fontWeight: "900" },
});
