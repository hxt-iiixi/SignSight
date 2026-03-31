import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
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

import { MajorityVoteSmoother } from "../ml/smoother";
import { API_BASE } from "../config/api";
import {
  createStreamingRecognitionBuffers,
  GESTURE_FRAMES,
  processStreamingHandFrame,
  resetStreamingRecognitionState,
  saveStreamingLandmarkSample,
} from "../ml/streamingRecognition";
import type { DetectMode } from "../ml/streamTypes";
import { useStreamingHandTracking } from "../ml/useStreamingHandTracking";
type UiMode = "ADVANCED" | "SIMPLE";

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

export default function CameraScreenVC({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;

  const [uiMode, setUiMode] = useState<UiMode>("ADVANCED");

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
  const [isDatasetMode, setIsDatasetMode] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("A");
  const [status, setStatus] = useState("");
  const [lastHandedness, setLastHandedness] = useState<string | null>(null);
  const [rawLabel, setRawLabel] = useState("?");

  type WordLabel = (typeof WORD_LABELS)[number];
  const [selectedWord, setSelectedWord] = useState<WordLabel>("HELLO");
  const [isRecordingGesture, setIsRecordingGesture] = useState(false);
  const [gestureFramesCount, setGestureFramesCount] = useState(0);
  const [detectMode, setDetectMode] = useState<DetectMode>("LETTERS");

  const [showControls, setShowControls] = useState(true);

  const buffersRef = useRef(createStreamingRecognitionBuffers());
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  const clearRecordBuffer = () => {
    buffersRef.current.recordFrames = [];
    setGestureFramesCount(0);
  };

  const clearPredictBuffer = () => {
    buffersRef.current.predictFrames = [];
    buffersRef.current.lastGestureAtMs = 0;
    setGestureFramesCount(0);
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
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const i = letters.indexOf(selectedLabel);
    setSelectedLabel(letters[(i + 1) % letters.length]);
  };

  const nextWord = () => {
    const i = WORD_LABELS.indexOf(selectedWord);
    setSelectedWord(WORD_LABELS[(i + 1) % WORD_LABELS.length]);
  };

  const saveOneLandmarkSample = async () => {
    try {
      setStatus(`Saving ${selectedLabel}...`);

      const result = await saveStreamingLandmarkSample(
        latestHandFrame,
        API_BASE,
        selectedLabel
      );

      if (!result.ok) {
        setStatus(`Save failed: ${result.error ?? "unknown"}`);
        return;
      }

      setLastHandedness(result.handedness ?? null);
      setStatus(`Saved ✅ ${selectedLabel} (${result.handedness ?? "?"})`);
    } catch {
      setStatus("Save error");
    }
  };

  const trainLandmarks = async () => {
    try {
      setStatus("Training landmarks...");
      const res = await fetch(`${API_BASE}/train_landmarks`, { method: "POST" });
      const json = await res.json();
      setStatus(json.ok ? "Training complete ✅" : "Training failed ❌");
    } catch {
      setStatus("Training error");
    }
  };

  const toggleGestureRecording = () => {
    setIsRecordingGesture((prev) => {
      const next = !prev;

      if (next) {
        setStatus("Recording gesture… hold steady");
        buffersRef.current.recordFrames = [];
        setGestureFramesCount(0);
      } else {
        setStatus(
          `Recording stopped (${buffersRef.current.recordFrames.length}/${GESTURE_FRAMES})`
        );
      }

      return next;
    });
  };

  const saveGestureSample = async () => {
    try {
      const MIN_FRAMES = 8;
      if (buffersRef.current.recordFrames.length < MIN_FRAMES) {
        setStatus(`Need at least ${MIN_FRAMES} frames to save.`);
        return;
      }

      setStatus(`Saving gesture ${selectedWord}...`);

      const res = await fetch(`${API_BASE}/upload_gesture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: selectedWord,
          frames: buffersRef.current.recordFrames.map((f) => f.landmarks),
          handedness: lastHandedness ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setStatus(`Save gesture failed: ${json.error ?? "unknown"}`);
        return;
      }

      setStatus(
        `Saved ✅ ${selectedWord} (${buffersRef.current.recordFrames.length} frames)`
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
      setGestureFramesCount,
      setLastConf,
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
      setGestureFramesCount,
      setLastConf,
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
  const lastSeenAgeMs =
    debugState.lastValidTimestampMs == null
      ? null
      : Math.max(0, Date.now() - debugState.lastValidTimestampMs);

  return (
    <View style={styles.container}>
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
        pixelFormat="rgb"
      />

      <View
        pointerEvents="none"
        style={[
          styles.centerHudWrap,
          {
            paddingHorizontal: PAD,
            top: showControls ? "36%" : "48%",
          },
        ]}
      >
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
                ? `${gestureFramesCount}/${GESTURE_FRAMES}`
                : `Hand ${lastHandedness ?? "-"}`}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.topHud, { top: TOP, left: PAD, right: PAD }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={TEXT} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setUiMode((prev) => (prev === "ADVANCED" ? "SIMPLE" : "ADVANCED"))
          }
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.85 },
            { marginTop: 8, alignSelf: "flex-start" },
          ]}
        >
          <Text style={styles.backText}>
            {uiMode === "ADVANCED" ? "Simple UI" : "Advanced UI"}
          </Text>
        </Pressable>

        <Text style={styles.h1}>SignSight (MediaPipe)</Text>

        {uiMode === "ADVANCED" ? (
          <View style={styles.chipsRow}>
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
              <Text style={styles.chipText}>{detectMode}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{detectMode}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.toggleWrap, { left: PAD, right: PAD }]}>
        <Pressable
          onPress={() => setShowControls((v) => !v)}
          style={({ pressed }) => [
            styles.toggleBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Text style={styles.toggleText}>
            {showControls ? "Hide Controls" : "Show Controls"}
          </Text>
        </Pressable>
      </View>

      {showControls && (
        <View style={[styles.panelWrap, { left: PAD, right: PAD }]}>
          <View style={styles.panel}>
            {uiMode === "ADVANCED" ? (
              <>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Controls</Text>
                  <Text style={styles.panelSub}>
                    {isDatasetMode ? "DATASET" : "PREDICT"} •{" "}
                    {cameraPosition.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.btnRow}>
                  <Pressable
                    onPress={() => {
                      if (isDatasetMode) return;
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
                      isDatasetMode && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.btnText}>Mode: {detectMode}</Text>
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
                      Switch: {cameraPosition.toUpperCase()}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() =>
                    setIsDatasetMode((v) => {
                      const next = !v;
                      if (next) {
                        setDetectMode("LETTERS");
                        setIsRecordingGesture(false);
                        clearRecordBuffer();
                        clearPredictBuffer();
                      }
                      return next;
                    })
                  }
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && { opacity: 0.85 },
                    isDatasetMode && styles.btnAccent,
                    { marginTop: 10 },
                  ]}
                >
                  <Text
                    style={[styles.btnText, isDatasetMode && styles.btnTextDark]}
                  >
                    {isDatasetMode ? "Dataset ON" : "Dataset OFF"}
                  </Text>
                </Pressable>

                {detectMode === "WORDS" && !isDatasetMode && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View style={styles.wordInfoRow}>
                      <Text style={styles.smallLabel}>Selected:</Text>
                      <Text style={styles.smallValue}>{selectedWord}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.smallMuted}>
                        Frames {gestureFramesCount}/{GESTURE_FRAMES}
                      </Text>
                    </View>

                    <View style={styles.btnRow}>
                      <Pressable
                        onPress={nextWord}
                        style={({ pressed }) => [
                          styles.btn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.btnText}>Next Word</Text>
                      </Pressable>

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
                          {isRecordingGesture
                            ? "Stop Recording"
                            : "Start Recording"}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.btnRow}>
                      <Pressable
                        onPress={saveGestureSample}
                        style={({ pressed }) => [
                          styles.btnPrimary,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.btnPrimaryText}>Save Gesture</Text>
                      </Pressable>

                      <Pressable
                        onPress={trainGestures}
                        style={({ pressed }) => [
                          styles.btnPrimary,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.btnPrimaryText}>Train Gestures</Text>
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
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.btnText}>Clear Frames</Text>
                    </Pressable>
                  </View>
                )}

                {detectMode === "LETTERS" && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View style={styles.wordInfoRow}>
                      <Text style={styles.smallLabel}>Label:</Text>
                      <Text style={styles.smallValue}>{selectedLabel}</Text>
                      <View style={{ flex: 1 }} />
                      <Pressable onPress={nextLabel} style={styles.pillMini}>
                        <Text style={styles.pillMiniText}>Next</Text>
                      </Pressable>
                    </View>

                    <View style={styles.btnRow}>
                      <Pressable
                        onPress={saveOneLandmarkSample}
                        style={({ pressed }) => [
                          styles.btnPrimary,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.btnPrimaryText}>Save Sample</Text>
                      </Pressable>

                      <Pressable
                        onPress={trainLandmarks}
                        style={({ pressed }) => [
                          styles.btnPrimary,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.btnPrimaryText}>Train</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {!!status && <Text style={styles.status}>{status}</Text>}

                <Text style={styles.debugLine}>
                  Raw: {rawLabel} • Hand: {lastHandedness ?? "-"}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Quick Controls</Text>
                  <Text style={styles.panelSub}>User mode</Text>
                </View>

                <View style={styles.btnRow}>
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
                    <Text style={styles.btnText}>Mode: {detectMode}</Text>
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
                      Switch: {cameraPosition.toUpperCase()}
                    </Text>
                  </Pressable>
                </View>

                {detectMode === "WORDS" && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View style={styles.wordInfoRow}>
                      <Text style={styles.smallLabel}>Selected:</Text>
                      <Text style={styles.smallValue}>{selectedWord}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.smallMuted}>
                        {gestureFramesCount}/{GESTURE_FRAMES}
                      </Text>
                    </View>

                    <View style={styles.btnRow}>
                      <Pressable
                        onPress={nextWord}
                        style={({ pressed }) => [
                          styles.btn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.btnText}>Next Word</Text>
                      </Pressable>

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
                          {isRecordingGesture
                            ? "Stop Recording"
                            : "Start Recording"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
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

  centerHudWrap: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
  },
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

  toggleWrap: { position: "absolute", bottom: 18 },
  toggleBtn: {
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(252,231,243,0.94)",
    borderWidth: 1,
    borderColor: "rgba(249,168,212,0.45)",
  },
  toggleText: { color: ACCENT, fontWeight: "900" },

  panelWrap: { position: "absolute", bottom: 70 },
  panel: {
    borderRadius: 28,
    padding: 14,
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
