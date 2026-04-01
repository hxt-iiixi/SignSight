import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
  useWindowDimensions,
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
} from "../ml/streamingRecognition";
import { STATIC_ASL_LABELS } from "../ml/labels";
import type { DetectMode } from "../ml/streamTypes";
import { useStreamingHandTracking } from "../ml/useStreamingHandTracking";

type CameraScreenVCProps = {
  onBack: () => void;
  debugEnabled?: boolean;
  showHandOverlay?: boolean;
  variant?: "translator" | "lab";
};

const ACCENT = "#BE185D";
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
  const TOP = isTablet ? 70 : 56;

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
  const [selectedLabel, setSelectedLabel] =
    useState<(typeof STATIC_ASL_LABELS)[number]>("A");
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
  const [selectedLabelSummary, setSelectedLabelSummary] =
    useState<LandmarkLabelSummary | null>(null);

  type WordLabel = (typeof WORD_LABELS)[number];
  const [selectedWord, setSelectedWord] = useState<WordLabel>("HELLO");
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

  const nextLabel = () => {
    const i = STATIC_ASL_LABELS.indexOf(selectedLabel);
    const nextIndex = i >= 0 ? (i + 1) % STATIC_ASL_LABELS.length : 0;
    setSelectedLabel(STATIC_ASL_LABELS[nextIndex]);
  };

  const nextWord = () => {
    const i = WORD_LABELS.indexOf(selectedWord);
    setSelectedWord(WORD_LABELS[(i + 1) % WORD_LABELS.length]);
  };

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
    setAvailableLandmarkModelVersions(
      Array.isArray(json.available_landmark_model_versions)
        ? json.available_landmark_model_versions
        : []
    );
    setReadyStaticLettersByMode({
      bootstrap: bootstrapReady,
      full_reviewed: fullReviewedReady,
    });
  };

  const refreshSelectedLabelSummary = async (
    nextLabel = selectedLabel,
    nextSessionId = captureSessionId,
    nextSignerId = signerId
  ) => {
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

  const trainLandmarks = async () => {
    try {
      setStatus(
        `Training landmarks (${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"})...`
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
        setActiveStaticLetters(active);
        await refreshSelectedLabelSummary();
        setStatus(
          `Training complete ✅${acc} ${json.training_mode === "bootstrap" ? "Bootstrap" : "Full reviewed"} model: ${active.length}/${STATIC_ASL_LABELS.length} active`
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
      await refreshSelectedLabelSummary();
      setStatus(`Switched active model ✅ ${versionId}`);
    } catch {
      setStatus("Version switch error");
    }
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
      const MIN_FRAMES = 8;
      if (buffersRef.current.recordingFrames.length < MIN_FRAMES) {
        setStatus(`Need at least ${MIN_FRAMES} frames to save.`);
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
  const selectedLabelIsActive = activeStaticLetters.includes(selectedLabel);
  const selectedLabelIsReady =
    readyStaticLettersByMode[landmarkTrainingMode].includes(selectedLabel);
  const activeLandmarkModelVersion = availableLandmarkModelVersions.find(
    (version) => String(version.version_id) === activeLandmarkModelVersionId
  );
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
      </View>

      <View style={[styles.topHud, { top: TOP, left: PAD, right: PAD }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={TEXT} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.h1}>{isLab ? "SignSight Lab" : "SignSight"}</Text>

        {showDebugHud ? (
          <View style={styles.chipsRow}>
            {isLab ? (
              <>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {detectMode} • {cameraPosition.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {activeLandmarkModelVersionId
                      ? `MODEL ${currentLandmarkTrainingMode === "bootstrap" ? "BOOTSTRAP" : "FULL"}`
                      : "MODEL NONE"}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {status
                      ? status
                      : debugState.hasHand
                        ? `HAND ${debugState.landmarkCount}`
                        : "HAND 0"}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>FPS {fpsCounter}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>LM {lmFps}/s</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>PRED {predictionRate}/s</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {debugState.hasHand
                      ? `HAND ${debugState.landmarkCount}`
                      : "HAND 0"}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    AGE {lastSeenAgeMs == null ? "-" : `${lastSeenAgeMs}ms`}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    FMT{" "}
                    {format
                      ? `${format.videoWidth}x${format.videoHeight}@${Math.min(
                          TARGET_CAMERA_FPS,
                          format.maxFps
                        )}`
                      : "-"}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    VIEW {Math.round(cameraLayout.width)}x{Math.round(cameraLayout.height)}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    ORIENT {orientedFrame.width}x{orientedFrame.height}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    SMOOTH {isOverlaySmoothing ? "ON" : "OFF"}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{detectMode}</Text>
                </View>
              </>
            )}
          </View>
        ) : (
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {detectMode === "LETTERS" ? "Letters" : "Words"}
                </Text>
              </View>
              {detectMode === "LETTERS" && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    Active {activeStaticLetters.length}/{STATIC_ASL_LABELS.length}
                  </Text>
                </View>
              )}
              {!!status && (
                <View style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                  {status}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {isLab ? (
        <View style={[styles.labSheetWrap, { left: PAD, right: PAD }]}>
          <View style={[styles.labSheet, { maxHeight: labSheetMaxHeight }]}>
            <ScrollView
              contentContainerStyle={styles.labSheetContent}
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

              <View style={styles.labFieldCard}>
                <View>
                  <Text style={styles.labFieldLabel}>
                    {detectMode === "WORDS" ? "Target word" : "Target label"}
                  </Text>
                  <Text style={styles.labFieldValue}>
                    {detectMode === "WORDS" ? selectedWord : selectedLabel}
                  </Text>
                  {detectMode === "LETTERS" ? (
                    <Text style={styles.labHelperText}>
                      {selectedLabelIsActive
                        ? "Active in the trained static model."
                        : selectedLabelIsReady
                          ? `Quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"}, but not active until the next train.`
                          : `Collectable now, but not quota-ready for ${landmarkTrainingMode === "bootstrap" ? "bootstrap" : "full reviewed"} yet.`}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={detectMode === "WORDS" ? nextWord : nextLabel}
                  style={styles.pillMini}
                >
                  <Text style={styles.pillMiniText}>
                    {detectMode === "WORDS" ? "Next Word" : "Next Label"}
                  </Text>
                </Pressable>
              </View>

              {detectMode === "WORDS" ? (
                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Live"
                    value={`${liveGestureFramesCount}/${GESTURE_FRAMES}`}
                  />
                  <LabSummaryPill
                    label="Recorded"
                    value={`${recordingGestureFramesCount}/${GESTURE_FRAMES}`}
                  />
                  <LabSummaryPill
                    label="State"
                    value={isRecordingGesture ? "Recording" : "Idle"}
                    tone={isRecordingGesture ? "accent" : "neutral"}
                  />
                </View>
              ) : (
                <View style={styles.labSummaryRow}>
                  <LabSummaryPill
                    label="Target"
                    value={selectedLabel}
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
                    Gesture buffer {currentWordFramesCount}/{GESTURE_FRAMES}
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
                        : `${selectedLabel} is still in collection. Keep saving samples, then approve them before training.`}
                  </Text>
                </View>
              </LabSection>
            ) : null}

            <LabSection
              title="Training"
              subtitle={
                detectMode === "WORDS"
                  ? "Model training is separate from capture so it is harder to trigger by accident."
                  : "Train a new landmark model first, then switch between saved model versions when needed."
              }
            >
              {detectMode === "LETTERS" ? (
                <View style={styles.trainingModeCard}>
                  <Text style={styles.labFieldLabel}>New model</Text>
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
                      ? "Train Bootstrap Model"
                      : "Train Full Reviewed Model"}
                  </Text>
                  <Text style={styles.labHelperTextTight}>
                    {landmarkTrainingMode === "bootstrap"
                      ? "Bootstrap mode is for solo or early internal testing with lower quotas."
                      : "Full reviewed mode uses the stricter final dataset quotas."}{" "}
                    Training creates a new model version and does not overwrite the old one.
                  </Text>
                  <Text style={styles.inputHelperText}>
                    Current trained model:{" "}
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
                        ? "Train New Bootstrap Model"
                        : "Train New Full Reviewed Model"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {detectMode === "LETTERS" && availableLandmarkModelVersions.length > 0 ? (
                <View style={styles.trainingModeCard}>
                  <Text style={styles.labFieldLabel}>Active model</Text>
                  <Text style={styles.labFieldValue}>
                    {String(
                      activeLandmarkModelVersion?.label ??
                        activeLandmarkModelVersionId ??
                        "No active model"
                    )}
                  </Text>
                  <Text style={styles.labHelperTextTight}>
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
                      : "Use a trained version for live predictions."}
                  </Text>
                  <Pressable
                    onPress={() => setShowModelVersions((value) => !value)}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnBlock,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.btnText}>
                      {showModelVersions
                        ? "Hide Saved Models"
                        : "Show Saved Models"}
                    </Text>
                  </Pressable>

                  {showModelVersions ? (
                    <View style={styles.versionList}>
                      {availableLandmarkModelVersions.map((version) => {
                        const versionId = String(version.version_id);
                        const isActive =
                          versionId === activeLandmarkModelVersionId;
                        const mode =
                          version.training_mode === "bootstrap"
                            ? "bootstrap"
                            : "full reviewed";
                        return (
                          <Pressable
                            key={versionId}
                            onPress={() => activateLandmarkModelVersion(versionId)}
                            style={({ pressed }) => [
                              styles.versionCard,
                              isActive && styles.versionCardActive,
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
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.trainingNotice}>
                <Ionicons name="alert-circle-outline" size={18} color={ACCENT} />
                <Text style={styles.trainingNoticeText}>
                  {detectMode === "WORDS"
                    ? "Train only after you have collected enough clean samples for the current target set."
                    : landmarkTrainingMode === "bootstrap"
                      ? "Bootstrap mode is temporary and should not be treated as the final shared model."
                      : "Full reviewed mode expects the stricter final dataset quotas and signer diversity."}
                </Text>
              </View>

              {detectMode === "WORDS" ? (
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
                  ? "Record or save gesture samples for the selected word."
                  : "Save single-frame landmark samples for the selected label."
              }
            >
              {detectMode === "WORDS" ? (
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
        <View style={[styles.translatorControlsWrap, { left: PAD, right: PAD }]}>
          <View style={styles.centerHud}>
            <Text style={styles.centerKicker}>{centerTitle}</Text>
            <Text style={styles.centerLabel} numberOfLines={1}>
              {displayLabel}
            </Text>

            <View style={styles.centerMetaRow}>
              <Text style={styles.centerMeta}>{Math.round(lastConf * 100)}%</Text>
              <View style={styles.dot} />
              <Text style={styles.centerMeta}>
                {detectMode === "WORDS"
                  ? `${currentWordFramesCount}/${GESTURE_FRAMES}`
                  : `Hand ${lastHandedness ?? "-"}`}
              </Text>
            </View>
          </View>

          <View style={styles.translatorControls}>
            <Pressable
              onPress={() => {
                if (isRecordingGesture) {
                  setStatus("Stop recording first.");
                  return;
                }
                setDetectMode((m) => (m === "LETTERS" ? "WORDS" : "LETTERS"));
              }}
              style={({ pressed }) => [
                styles.btn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.btnText}>
                {detectMode === "LETTERS" ? "Letters" : "Words"}
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
                {cameraPosition === "back" ? "Front Cam" : "Back Cam"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
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
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  backText: { color: TEXT, fontWeight: "900" },

  topHud: { position: "absolute" },
  h1: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginTop: 10 },

  chipsRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,249,242,0.88)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.95)",
  },
  chipText: { color: TEXT, fontWeight: "900", fontSize: 12 },
  centerHud: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 18,
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
  centerKicker: {
    color: ACCENT,
    fontWeight: "900",
    letterSpacing: 1.4,
    fontSize: 12,
  },
  centerLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 36,
    marginTop: 8,
  },
  centerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  centerMeta: { color: MUTED, fontWeight: "800" },
  dot: { width: 4, height: 4, borderRadius: 4, backgroundColor: "#D1D5DB" },

  labSheetWrap: {
    position: "absolute",
    bottom: 18,
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
    padding: 14,
    paddingBottom: 18,
  },
  translatorControlsWrap: {
    position: "absolute",
    bottom: 18,
    gap: 12,
  },
  translatorControls: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 24,
    padding: 12,
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
  panelHeader: { marginBottom: 12 },
  panelTitle: { color: TEXT, fontWeight: "900", fontSize: 14 },
  panelSub: { color: MUTED, marginTop: 4, fontWeight: "700" },
  labSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(229,231,235,0.9)",
  },
  labSectionHeader: {
    marginBottom: 10,
  },
  labSectionTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  labSectionSubtitle: {
    color: MUTED,
    marginTop: 4,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
  },
  labSectionBody: {
    gap: 10,
  },
  labFieldCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  labFieldCardAccent: {
    backgroundColor: SOFT_PINK,
    borderColor: "rgba(249,168,212,0.45)",
  },
  labFieldLabel: {
    color: MUTED,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labFieldValue: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 4,
  },
  labHelperText: {
    color: MUTED,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  labHelperTextTight: {
    color: MUTED,
    fontWeight: "700",
    lineHeight: 18,
  },
  labSummaryRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  labStatusCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  labStatusHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  labStatusPrimary: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 24,
    marginTop: 4,
  },
  labStatusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: SOFT_BLUE,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.24)",
  },
  labStatusBadgeText: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: 12,
  },
  labStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  labStatusMeta: {
    color: MUTED,
    fontWeight: "800",
    fontSize: 12,
  },
  labStatusModelText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 12,
  },
  datasetInsightCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(243,244,246,0.92)",
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  datasetInsightTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  datasetInsightText: {
    color: MUTED,
    fontWeight: "700",
    lineHeight: 18,
  },
  metadataStack: {
    gap: 10,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: MUTED,
    fontWeight: "800",
    fontSize: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputHelperText: {
    color: MUTED,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
  },
  labSummaryPill: {
    minWidth: 92,
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
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
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labSummaryValue: {
    color: TEXT,
    fontWeight: "900",
    marginTop: 4,
  },
  labSummaryValueAccent: {
    color: ACCENT,
  },

  btnRow: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,168,212,0.45)",
    backgroundColor: SOFT_PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: ACCENT, fontWeight: "900" },
  trainingModeCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  versionList: {
    gap: 8,
  },
  versionCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(249,250,251,0.92)",
    gap: 4,
  },
  versionCardActive: {
    backgroundColor: SOFT_BLUE,
    borderColor: "rgba(96,165,250,0.35)",
  },
  versionTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  trainingNotice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
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
    fontSize: 12,
  },
  diagnosticsCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },

  status: { marginTop: 12, color: TEXT, fontWeight: "800" },
  debugLine: {
    marginTop: 10,
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
  },

  wordInfoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallLabel: { color: MUTED, fontWeight: "800" },
  smallValue: { color: TEXT, fontWeight: "900" },
  smallMuted: { color: MUTED, fontWeight: "800" },

  pillMini: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: SOFT_YELLOW,
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.45)",
  },
  pillMiniText: { color: "#92400E", fontWeight: "900" },
});
