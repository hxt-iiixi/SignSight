import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from "react-native-vision-camera";

import { useFrameProcessor } from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";

import { MajorityVoteSmoother } from "../ml/smoother";
import {
  HandLandmarksWebView,
  type HandWebViewHandle,
} from "../ml/handLandmarksWebView";
import { HAND_WEBVIEW_HTML } from "../ml/handWebviewHtml";

type DetectMode = "LETTERS" | "WORDS";

const API_BASE = "http://192.168.1.7:8000"; // ✅ your IP here
const ACCENT = "#BE185D";
const BG = "#FFF9F2";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const SOFT_PINK = "#FCE7F3";
const SOFT_YELLOW = "#FEF3C7";
const SOFT_BLUE = "#DBEAFE";
const BORDER = "#E5E7EB";
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

const LETTER_MOTION_FRAMES = 10;
const LETTER_MOTION_INTERVAL_MS = 140;


export default function CameraScreenVC({ onBack }: { onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;

  const PAD = isTablet ? 24 : isSmall ? 14 : 18;
  const TOP = isTablet ? 70 : 56;

  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);

  const cameraRef = useRef<Camera>(null);
  const webRef = useRef<HandWebViewHandle>(null);
  const letterMotionBufRef = useRef<any[]>([]);
  const lastLetterMotionAtRef = useRef(0);
  const [cameraPosition, setCameraPosition] = useState<"back" | "front">(
    "back"
  );
  const device = useCameraDevice(cameraPosition);
  const format = useCameraFormat(device, [{ fps: 30 }]);

  const [fpsCounter, setFpsCounter] = useState(0);
  const framesThisSecondRef = useRef(0);
  const lastFpsTickRef = useRef(Date.now());

  const [lmFps, setLmFps] = useState(0);
  const lmThisSecondRef = useRef(0);
  const lmLastTickRef = useRef(Date.now());

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

  // ✅ NEW: show/hide controls panel
  const [showControls, setShowControls] = useState(true);

  const recordBufRef = useRef<any[]>([]);
  const predictBufRef = useRef<any[]>([]);

  // ✅ faster “no clear word” -> stable display

  const clearLetterMotionBuffer = () => {
    letterMotionBufRef.current = [];
    lastLetterMotionAtRef.current = 0;
  };

  const clearRecordBuffer = () => {
    recordBufRef.current = [];
    setGestureFramesCount(0);
  };

  const clearPredictBuffer = () => {
    predictBufRef.current = [];
    lastGestureAtRef.current = 0;
    setGestureFramesCount(0);
  };

  // gesture sliding window
 const GESTURE_FRAMES = 8;
  const lastGestureAtRef = useRef(0);

  // ~7 predictions per second
  const WORD_PREDICT_INTERVAL_MS = 90;

  // require a bit more buildup before predicting
  const MIN_PREDICT_FRAMES = 3;

  const gestureStrideRef = useRef(0);

  // ---- tick counters (JS thread) ----
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

  // ---- frame processor (worklet) ----
  const onFrameTickJS = useMemo(() => Worklets.createRunOnJS(onFrameTick), []);
  const frameProcessor = useFrameProcessor(() => {
    "worklet";
    onFrameTickJS();
  }, []);

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

      if (!cameraRef.current || !webRef.current) {
        setStatus("Camera/WebView not ready");
        return;
      }

      const snap = await cameraRef.current.takeSnapshot({ quality:40 });
      if (!snap?.path) {
        setStatus("Snapshot failed");
        return;
      }

      const uri = snap.path.startsWith("file://")
        ? snap.path
        : `file://${snap.path}`;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const hand = await webRef.current.process(base64);

      if (!hand.landmarks || hand.landmarks.length !== 21) {
        setStatus("No hand detected (cannot save)");
        return;
      }

      setLastHandedness(hand.handedness ?? null);

      const res = await fetch(`${API_BASE}/upload_landmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: selectedLabel,
          landmarks: hand.landmarks,
          handedness: hand.handedness ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setStatus(`Save failed: ${json.error ?? "unknown"}`);
        return;
      }

      setStatus(`Saved ✅ ${selectedLabel} (${hand.handedness ?? "?"})`);
    } catch (e) {
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
        recordBufRef.current = [];
        setGestureFramesCount(0);
      } else {
        setStatus(
          `Recording stopped (${recordBufRef.current.length}/${GESTURE_FRAMES})`
        );
      }

      return next;
    });
  };

  const saveGestureSample = async () => {
    try {
      const MIN_FRAMES = 8;
      if (recordBufRef.current.length < MIN_FRAMES) {
        setStatus(`Need at least ${MIN_FRAMES} frames to save.`);
        return;
      }

      setStatus(`Saving gesture ${selectedWord}...`);

      const res = await fetch(`${API_BASE}/upload_gesture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: selectedWord,
          frames: recordBufRef.current.map((f) => f.landmarks),
          handedness: lastHandedness ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setStatus(`Save gesture failed: ${json.error ?? "unknown"}`);
        return;
      }

      setStatus(`Saved ✅ ${selectedWord} (${recordBufRef.current.length} frames)`);
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

  // ---- permission ----
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
    smootherRef.current = new MajorityVoteSmoother(3);
    setRawLabel("?");
    setLastLabel("Ready");
    setLastConf(0);
    setIsRecordingGesture(false);
    setGestureFramesCount(0);
    clearLetterMotionBuffer();
  }, [detectMode]);

  // ✅ IMPORTANT: interval hook MUST be above render returns
  useEffect(() => {
    if (!ready) return;
    if (!device || !format) return;

    let mounted = true;
    let busy = false;

    const interval = setInterval(async () => {
      if (!mounted || busy) return;
      if (!cameraRef.current || !webRef.current) return;

      busy = true;

      try {
        const snap = await cameraRef.current.takeSnapshot({ quality: 55 });
        if (!snap?.path) return;

        const uri = snap.path.startsWith("file://")
          ? snap.path
          : `file://${snap.path}`;
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });

        const hand = await webRef.current.process(base64);

        if (!hand.landmarks || hand.landmarks.length !== 21) {
          smootherRef.current.push("?");
          const stable = smootherRef.current.getStableLabel();
          if (mounted) {
            setLastLabel(stable === "?" ? "No hand" : stable);
            setLastConf(0);
            setRawLabel("—");
          }
          return;
        }

        setLastHandedness(hand.handedness ?? null);
        onLandmarkTick();

        if (detectMode === "LETTERS") {
          const res = await fetch(`${API_BASE}/predict_landmarks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              landmarks: hand.landmarks,
              handedness: hand.handedness ?? null,
            }),
          });
          letterMotionBufRef.current.push({ landmarks: hand.landmarks });
          if (letterMotionBufRef.current.length > LETTER_MOTION_FRAMES) {
            letterMotionBufRef.current.shift();
          }
          const json = await res.json();
          const label = String(json.label ?? "?");
          const conf = Number(json.confidence ?? 0);
          let finalLabel = label;
          let finalConf = conf;

          // try motion recognition only when enough frames exist
          if (letterMotionBufRef.current.length >= LETTER_MOTION_FRAMES) {
            const now = Date.now();
            const baseShapeLooksMotionLike =
              label === "I" || label === "D" || label === "Z" || label === "J";

            if (baseShapeLooksMotionLike && now - lastLetterMotionAtRef.current >= LETTER_MOTION_INTERVAL_MS) {
              lastLetterMotionAtRef.current = now;

              try {
                const motionRes = await fetch(`${API_BASE}/predict_gesture`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    frames: letterMotionBufRef.current.map((f) => f.landmarks),
                    handedness: hand.handedness ?? null,
                  }),
                });

                const motionJson = await motionRes.json();
                const motionLabel = String(motionJson.label ?? "?");
                const motionConf = Number(motionJson.confidence ?? 0);

                if ((motionLabel === "J" || motionLabel === "Z") && motionConf >= 0.75) {
                  finalLabel = motionLabel;
                  finalConf = motionConf;

                  // restart motion window after successful motion-letter detection
                  clearLetterMotionBuffer();
                }
              } catch {}
            }
          }
         if (finalConf < 0.6) {
          setRawLabel("—");
          smootherRef.current.push("?");
          if (mounted) {
            setLastLabel("No clear sign");
            setLastConf(finalConf);
          }
          return;
        }

        setRawLabel(finalLabel);
        smootherRef.current.push(finalLabel);
        const stable = smootherRef.current.getStableLabel();

        if (mounted) {
          setLastLabel(stable);
          setLastConf(finalConf);
        }
        } else {
          // WORDS (GESTURES)

          // If recording: fill recordBufRef only
          if (isRecordingGesture) {
            recordBufRef.current.push({ landmarks: hand.landmarks });
            if (recordBufRef.current.length > GESTURE_FRAMES)
              recordBufRef.current.shift();

            if (mounted) {
              setGestureFramesCount(recordBufRef.current.length);
              setRawLabel(`${recordBufRef.current.length}/${GESTURE_FRAMES}`);
              setLastLabel("Recording…");
              setLastConf(0);
            }
            return;
          }

          // Not recording: fill predictBufRef only
          predictBufRef.current.push({ landmarks: hand.landmarks });
          if (predictBufRef.current.length > GESTURE_FRAMES)
            predictBufRef.current.shift();

          if (mounted) setGestureFramesCount(predictBufRef.current.length);

          if (predictBufRef.current.length < MIN_PREDICT_FRAMES) {
            if (mounted) {
              setRawLabel(`${predictBufRef.current.length}/${GESTURE_FRAMES}`);
              setLastConf(0);
            }
            return;
          }

          const now = Date.now();
          if (now - lastGestureAtRef.current < WORD_PREDICT_INTERVAL_MS) return;
          lastGestureAtRef.current = now;

          const res = await fetch(`${API_BASE}/predict_gesture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frames: predictBufRef.current.map((f) => f.landmarks),
              handedness: hand.handedness ?? null,
            }),
          });

      const json = await res.json();
      const word = String(json.label ?? "?");
      const conf = Number(json.confidence ?? 0);

      // always restart the frame window after a prediction attempt
      predictBufRef.current = [];
      lastGestureAtRef.current = 0;

      if (mounted) {
        setGestureFramesCount(0);
      }

      if (conf < 0.6) {
        if (mounted) {
          setRawLabel("…");
          setLastConf(conf);
          // keep lastLabel unchanged
        }
        return;
      }

      if (mounted) {
        setRawLabel(word);
        setLastLabel(word);
        setLastConf(conf);
      }
        }
      } catch {
      } finally {
        busy = false;
      }
    }, 45);

    return () => {1
      mounted = false;
      clearInterval(interval);
    };
  }, [ready, device, format, detectMode, isDatasetMode, isRecordingGesture]);

  // ---- safe to return conditionally ----
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

  // ✅ prettier label text for center display
  const centerTitle = detectMode === "LETTERS" ? "LETTER" : "WORD";
  const displayLabel =
    lastLabel === "No clear sign" || lastLabel === "Hold gesture…" || lastLabel === "No hand"
      ? lastLabel
      : lastLabel;

  return (
    <View style={styles.container}>
      <HandLandmarksWebView ref={webRef} html={HAND_WEBVIEW_HTML} />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={true}
        photo={true}
        video={false}
        audio={false}
        frameProcessor={frameProcessor}
        isMirrored={cameraPosition === "front"}
      />

      {/* ✅ Center Prediction HUD */}
      <View pointerEvents="none" style={[styles.centerHudWrap, { paddingHorizontal: PAD }]}>
        <View style={styles.centerHud}>
          <Text style={styles.centerKicker}>{centerTitle}</Text>
          <Text style={styles.centerLabel} numberOfLines={1}>
            {displayLabel}
          </Text>

          <View style={styles.centerMetaRow}>
            <Text style={styles.centerMeta}>
              {Math.round(lastConf * 100)}%
            </Text>
            <View style={styles.dot} />
            <Text style={styles.centerMeta}>
              {detectMode === "WORDS" ? `${gestureFramesCount}/${GESTURE_FRAMES}` : `Hand ${lastHandedness ?? "-"}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ✅ Top-left small debug chips (still nice) */}
      <View style={[styles.topHud, { top: TOP, left: PAD, right: PAD }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={TEXT} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

        <Text style={styles.h1}>SignSight (MediaPipe)</Text>

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>FPS {fpsCounter}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>LM {lmFps}/s</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{detectMode}</Text>
          </View>
        </View>
      </View>

      {/* ✅ Toggle button (always visible) */}
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

      {/* ✅ Controls panel (hide/show) */}
      {showControls && (
        <View style={[styles.panelWrap, { left: PAD, right: PAD }]}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Controls</Text>
              <Text style={styles.panelSub}>
                {isDatasetMode ? "DATASET" : "PREDICT"} • {cameraPosition.toUpperCase()}
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
                      gestureStrideRef.current = 0;
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
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
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
                    gestureStrideRef.current = 0;
                  }
                  return next;
                })
              }
              style={({ pressed }) => [
                styles.btn,
                pressed && { opacity: 0.85 },
                isDatasetMode && styles.btnAccent,
              ]}
            >
              <Text style={[styles.btnText, isDatasetMode && styles.btnTextDark]}>
                {isDatasetMode ? "Dataset ON" : "Dataset OFF"}
              </Text>
            </Pressable>

            {/* WORDS controls */}
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
                    <Text style={[styles.btnText, isRecordingGesture && styles.btnTextDark]}>
                      {isRecordingGesture ? "Stop Recording" : "Start Recording"}
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
                    gestureStrideRef.current = 0;
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

            {/* LETTERS controls */}
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
  title: { color: TEXT, fontWeight: "900", fontSize: 16 },

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
    top: "36%",
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
  centerMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
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
  debugLine: { marginTop: 10, color: MUTED, fontSize: 11, fontWeight: "700" },

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