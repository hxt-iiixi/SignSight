import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from "react-native";
import { CameraView, type CameraType, useCameraPermissions } from "expo-camera";
import * as Speech from "expo-speech";
import { SignRecognizer } from "../ml/recognizer";
import { MajorityVoteSmoother } from "../ml/smoother";
import { ASL_LABELS, type AslLabel } from "../ml/labels";
import { getClipCounts, getDatasetRoot } from "../ml/dataset";
import { WebView } from "react-native-webview";
import Svg, { Circle } from "react-native-svg";

const SERVER_URL = "http://192.168.1.7:8000";
const ACCENT = "#2EE6A6";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");

  const cameraRef = useRef<any>(null);
  const lastSpokenRef = useRef<string>("");
  const recognizerRef = useRef(new SignRecognizer());
  const smootherRef = useRef(new MajorityVoteSmoother(5));
  const inFlightRef = useRef(false);

  const [lastText, setLastText] = useState("Ready");
  const [isSaving, setIsSaving] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const pendingActionRef = useRef<"predict" | "upload" | null>(null);

  // Settings/Dataset
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatasetMode, setIsDatasetMode] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<AslLabel>("A");
  const [clipCounts, setClipCounts] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrainingLandmarks, setIsTrainingLandmarks] = useState(false);
  const [lastLandmarks, setLastLandmarks] = useState<any[] | null>(null);

  const [showHandPoints, setShowHandPoints] = useState(true);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const isLiveRunningRef = useRef(false);
  const liveTimerRef = useRef<any>(null);
  const webReadyRef = useRef(false);
  const [webReady, setWebReady] = useState(false);
  
  const refreshCounts = async () => {
    try {
      setIsLoadingCounts(true);
      setClipCounts(await getClipCounts());
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    refreshCounts();
  }, []);

 const startLiveHandTracking = () => {
    if (isLiveRunningRef.current) return;
    isLiveRunningRef.current = true;

    liveTimerRef.current = setInterval(async () => {
      try {
        if (!webReadyRef.current) return;

        const cam = cameraRef.current;
        if (!cam) return;
        if (inFlightRef.current) return;

        inFlightRef.current = true;

        const photo = await cam.takePictureAsync({
          quality: 0.15,
          skipProcessing: true,
          base64: true,
        });

        const b64 = photo?.base64;
        if (!b64) return;

        // ONLY landmarks. No predict/upload here.
        webviewRef.current?.injectJavaScript(`window.processImage("${b64}"); true;`);
      } catch (e) {
        // ignore occasional frame errors
      } finally {
        inFlightRef.current = false;
      }
    }, 180); // 180ms ~= ~5fps (adjust 120-250)
  };

  const stopLiveHandTracking = () => {
    isLiveRunningRef.current = false;
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = null;
  };

  
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const speak = (text: string) => {
    if (!text || text === "Ready") return;
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    Speech.stop();
    Speech.speak(text, { rate: 0.95 });
  };

  const flip = () => setFacing((f) => (f === "back" ? "front" : "back"));

  const trainNow = async () => {
    try {
      setIsTraining(true);
      setLastText("Training model...");
      const res = await fetch(`${SERVER_URL}/train`, { method: "POST" });
      if (!res.ok) throw new Error("Train failed");
      setLastText("Training complete ✅");
    } catch (e: any) {
      setLastText(`Train failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setIsTraining(false);
    }
  };
  const trainLandmarksNow = async () => {
    try {
      setIsTrainingLandmarks(true);
      setLastText("Training landmarks...");
      const res = await fetch(`${SERVER_URL}/train_landmarks`, { method: "POST" });
      if (!res.ok) throw new Error("Train landmarks failed");
      setLastText("Landmarks training complete ✅");
    } catch (e: any) {
      setLastText(`Train landmarks failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setIsTrainingLandmarks(false);
    }
  };

  const snapAndUpload = async (base64: string) => {
    const up = await fetch(`${SERVER_URL}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: selectedLabel, imageBase64: base64 }),
    });
    if (!up.ok) throw new Error("Upload failed");
  };

  const snapAndPredict = async (base64: string) => {
    const res = await fetch(`${SERVER_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    if (!res.ok) throw new Error("Predict failed");
    return res.json(); // { label, confidence }
  };
  
 

  const takeSnapshot = async () => {
    const cam = cameraRef.current;
    if (!cam) return;

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      setIsSaving(true);

      const photo = await cam.takePictureAsync({
        quality: 0.35,
        skipProcessing: true,
        base64: true,
      });

      const b64 = photo?.base64;
      if (!b64) return;

      // 🔥 LANDMARK PIPELINE STARTS HERE
      pendingActionRef.current = isDatasetMode ? "upload" : "predict";
      setLastText(isDatasetMode ? `Processing ${selectedLabel}...` : "Analyzing...");
     if (!webReadyRef.current) return;
      webviewRef.current?.injectJavaScript(`window.processImage("${b64}"); true;`);

      return;
    } catch (e: any) {
      setLastText(`Failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setIsSaving(false);
      inFlightRef.current = false;
    }
  };
  const onWebviewMessage = async (event) => {
    const msg = JSON.parse(event.nativeEvent.data);

    if (!msg.ok) {
      setLastText("No hand detected");
      recognizerRef.current.lastConfidence = 0;
      return;
    }

    const landmarks = msg.landmarks; // array of 21 {x,y,z}

    if (pendingActionRef.current === "upload") {
      await fetch(`${SERVER_URL}/upload_landmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: selectedLabel, landmarks }),
      });
      setLastText(`Saved landmarks ✅ ${selectedLabel}`);
      return;
    }

    // predict
    const res = await fetch(`${SERVER_URL}/predict_landmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landmarks }),
    });
    const data = await res.json(); // {label, confidence}
    setLastText(data.label);
  };

  const handHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
    </head>
    <body>
    <video id="v" autoplay playsinline style="display:none"></video>
    <canvas id="c" style="display:none"></canvas>

    <script>
    const hands = new Hands({
      locateFile: (file) =>
        "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((res) => {
      if (!res.multiHandLandmarks || !res.multiHandLandmarks[0]) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "NO_HAND" })
        );
        return;
      }
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "LANDMARKS",
          landmarks: res.multiHandLandmarks[0]
        })
      );
    });

    window.processImage = async (b64) => {
      const img = new Image();
      img.src = "data:image/jpeg;base64," + b64;
      await img.decode();
      await hands.send({ image: img });
    };
    </script>
    </body>
    </html>
    `;

  return (
    <View style={styles.container}>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCameraLayout({ width, height });
        }}
      />
      {showHandPoints && lastLandmarks?.length && cameraLayout.width > 0 && (
          <Svg
            width={cameraLayout.width}
            height={cameraLayout.height}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          >
            {lastLandmarks.map((p, idx) => {
              const xNorm = facing === "front" ? 1 - p.x : p.x;
              return (
                <Circle
                  key={idx}
                  cx={xNorm * cameraLayout.width}
                  cy={p.y * cameraLayout.height}
                  r={6}
                  fill={ACCENT}
                />
              );
            })}
          </Svg>
        )}


      <LandmarkDebugBox visible={showHandPoints} landmarks={lastLandmarks} />

        <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: handHtml }}
        javaScriptEnabled
           onLoadEnd={() => {
              webReadyRef.current = true;
              setWebReady(true);
            }}
        onMessage={async (e) => {
          const msg = JSON.parse(e.nativeEvent.data);
          
        if (msg.type !== "LANDMARKS") {
          setLastText("No hand detected");
          setLastLandmarks(null);
          return;
        }

        // ✅ store landmarks for UI debug
        setLastLandmarks(msg.landmarks);


          try {
            if (pendingActionRef.current === "upload") {
              await fetch(`${SERVER_URL}/upload_landmarks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  label: selectedLabel,
                  landmarks: msg.landmarks,
                }),
              });
              setLastText(`Landmarks saved (${selectedLabel})`);
              await refreshCounts();
            } else {
              const res = await fetch(`${SERVER_URL}/predict_landmarks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ landmarks: msg.landmarks }),
              });
              const data = await res.json();
              recognizerRef.current.lastConfidence = data.confidence ?? 0;

              if ((data.confidence ?? 0) < 0.6) {
                setLastText("No clear sign");
                return;
              }

              smootherRef.current.push(data.label);
              setLastText(smootherRef.current.getStableLabel());
              recognizerRef.current.lastConfidence = data.confidence;
            }
          } catch {
            setLastText("Landmark error");
          } finally {
            pendingActionRef.current = null;
          }
        }}
        style={{ width: 0, height: 0 }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
    

        {/* Header */}
        <View style={styles.overlayTop} pointerEvents="none">
          <Text style={styles.title}>SignSight</Text>
          <Text style={styles.subtitle}>ASL Letter Recognition (Snapshot)</Text>
        </View>

        {/* Bottom Panel */}
        <View style={styles.overlayBottom} pointerEvents="box-none">
          {/* Result */}
          <View style={styles.resultCard} pointerEvents="none">
            <Text style={styles.resultLabel}>Detected</Text>
            <Text style={styles.resultText}>{lastText}</Text>
            <Text style={styles.confidenceText}>
              {Math.round((recognizerRef.current.lastConfidence ?? 0) * 100)}% confidence
            </Text>
          </View>

          {/* Main Actions */}
          <View style={styles.row}>
            <Pressable
              style={[styles.btnPrimary, isSaving && { opacity: 0.6 }]}
              disabled={isSaving}
              onPress={takeSnapshot}
            >
              <Text style={styles.btnPrimaryText}>
                {isSaving
                  ? "Working..."
                  : isDatasetMode
                  ? `Snap + Upload (${selectedLabel})`
                  : "Snap + Detect"}
              </Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={() => speak(lastText)}>
              <Text style={styles.btnText}>Speak</Text>
            </Pressable>
          </View>

          {/* Settings Toggle */}
          <Pressable
            style={[
              styles.btn,
              isSettingsOpen && { borderColor: "rgba(46,230,166,0.55)" },
            ]}
            onPress={() => setIsSettingsOpen((v) => !v)}
          >
            <Text style={styles.btnText}>{isSettingsOpen ? "Close Settings" : "Settings"}</Text>
          </Pressable>

          {/* Settings Panel */}
          {isSettingsOpen && (
            <View style={styles.settingsCard}>
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.chip,
                    isDatasetMode && { borderColor: ACCENT, backgroundColor: "rgba(46,230,166,0.14)" },
                  ]}
                  onPress={() => setIsDatasetMode((v) => !v)}
                >
                  <Text style={styles.chipText}>
                    {isDatasetMode ? "Dataset: ON" : "Dataset: OFF"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.chip}
                  onPress={flip}
                >
                  <Text style={styles.chipText}>Flip Camera</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    showHandPoints && { borderColor: "rgba(46,230,166,0.55)" },
                  ]}
                  onPress={() => setShowHandPoints((v) => !v)}
                >
                  <Text style={styles.chipText}>
                    {showHandPoints ? "Hide Hand Points" : "Show Hand Points"}
                  </Text>
                </Pressable>


              </View>

              {isDatasetMode && (
                <>
                  <Pressable
                    style={[styles.btn, isTraining && { opacity: 0.6 }]}
                    disabled={isTraining}
                    onPress={trainNow}
                  >
                    <Text style={styles.btnText}>
                      {isTraining ? "Training..." : "Train Model"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, isTrainingLandmarks && { opacity: 0.6 }]}
                    disabled={isTrainingLandmarks}
                    onPress={trainLandmarksNow}
                  >
                    <Text style={styles.btnText}>
                      {isTrainingLandmarks ? "Training Landmarks..." : "Train Landmarks"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      const i = ASL_LABELS.indexOf(selectedLabel);
                      setSelectedLabel(ASL_LABELS[(i + 1) % ASL_LABELS.length]);
                    }}
                  >
                    <Text style={styles.btnText}>Change Label → {selectedLabel}</Text>
                  </Pressable>

                  <View style={styles.divider} />

                  <Text style={styles.smallTitle}>Dataset Counts</Text>
                  <Text style={styles.pathText} numberOfLines={1}>
                    {getDatasetRoot()}
                  </Text>

                  <View style={styles.grid}>
                    {ASL_LABELS.map((l) => (
                      <View key={l} style={styles.pill}>
                        <Text style={styles.pillText}>
                          {l}: {clipCounts[l] ?? 0}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Pressable style={styles.btn} onPress={refreshCounts} disabled={isLoadingCounts}>
                    <Text style={styles.btnText}>
                      {isLoadingCounts ? "Refreshing..." : "Refresh Counts"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
function LandmarkDebugBox({
  landmarks,
  visible,
  size = 170,
}: {
  landmarks: any[] | null;
  visible: boolean;
  size?: number;
}) {
  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 90,
        right: 16,
        width: size,
        height: size,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(46,230,166,0.55)",
        backgroundColor: "rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          position: "absolute",
          top: 8,
          left: 10,
          color: "rgba(255,255,255,0.75)",
          fontSize: 11,
          fontWeight: "800",
        }}
      >
        Hand Points
      </Text>

      {!landmarks?.length ? (
        <Text
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            color: "rgba(255,255,255,0.55)",
            fontSize: 11,
            fontWeight: "700",
          }}
        >
          none
        </Text>
      ) : (
        landmarks.map((p: any, i: number) => {
          // MediaPipe gives normalized x/y [0..1]
          const x = Math.max(0, Math.min(1, Number(p.x)));
          const y = Math.max(0, Math.min(1, Number(p.y)));

          // leave some padding inside box
          const pad = 14;
          const px = pad + x * (size - pad * 2);
          const py = pad + y * (size - pad * 2);

          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: px - 2.5,
                top: py - 2.5,
                width: 5,
                height: 5,
                borderRadius: 999,
                backgroundColor: "rgba(46,230,166,0.95)",
              }}
            />
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: "#fff" },

  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },

  overlayTop: { paddingTop: 54, paddingHorizontal: 18 },
  overlayBottom: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "android" ? 12 : 10,
    gap: 12,
  },

  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.7)", marginTop: 4 },

  resultCard: {
    backgroundColor: "rgba(0,0,0,0.68)",
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.35)",
  },
  resultLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    letterSpacing: 1,
  },
  resultText: {
    color: ACCENT,
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: 4,
  },
  confidenceText: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },

  row: { flexDirection: "row", gap: 10 },

  btnPrimary: {
    flex: 2,
    backgroundColor: "rgba(46,230,166,0.22)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.40)",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },

  btn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    paddingVertical: 14,         
    paddingHorizontal: 14,        
    alignItems: "center",
    justifyContent: "center",     
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    minHeight: 48,              
  },

  btnText: { color: "#fff", fontWeight: "700" },

  settingsCard: {
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 10,
  },

  chip: {
    flex: 1,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 4,
  },

  smallTitle: { color: "#fff", fontWeight: "800", marginTop: 2 },
  pathText: { color: "rgba(255,255,255,0.55)", fontSize: 11 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
