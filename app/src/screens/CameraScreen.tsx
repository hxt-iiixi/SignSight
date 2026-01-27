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
import * as FileSystem from "expo-file-system/legacy";
import { ASL_LABELS } from "../ml/labels";
import { getClipCounts, getDatasetRoot } from "../ml/dataset";
const SERVER_URL = "http://192.168.1.7:8000";


export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [lastText, setLastText] = useState("Ready");

  const lastSpokenRef = useRef<string>("");
  const recognizerRef = useRef(new SignRecognizer());
  const smootherRef = useRef(new MajorityVoteSmoother(5));
  const cameraRef = useRef<any>(null);

  const [isDatasetMode, setIsDatasetMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clipCounts, setClipCounts] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);




  // ASL label picker (A–J MVP)
  const [selectedLabel, setSelectedLabel] = useState("A");

  //useEffect(() => {
    //const t = setInterval(() => {
      //(async () => {
       // const result = await recognizerRef.current.recognize();
        //smootherRef.current.push(result.label);
        //setLastText(smootherRef.current.getStableLabel());
     // })();
  //  }, 700);

   // return () => clearInterval(t);
 // }, []);



  const refreshCounts = async () => {
    try {
      setIsLoadingCounts(true);
      const counts = await getClipCounts();
      setClipCounts(counts);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>We need camera permission to run SignSight.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const ensureDatasetFolder = async () => {
    const baseDir = FileSystem.cacheDirectory;
    if (!baseDir) throw new Error("Cache directory unavailable (Expo Go limitation)");

    const root = `${baseDir}dataset`;
    const labelDir = `${root}/${selectedLabel}`;

    const rootInfo = await FileSystem.getInfoAsync(root);
    if (!rootInfo.exists) await FileSystem.makeDirectoryAsync(root, { intermediates: true });

    const labelInfo = await FileSystem.getInfoAsync(labelDir);
    if (!labelInfo.exists) await FileSystem.makeDirectoryAsync(labelDir, { intermediates: true });

    return labelDir;
  };

  const takeSnapshot = async () => {
  const cam = cameraRef.current;
  if (!cam) return;

  try {
    setIsSaving(true);

    const takeFn = (cam as any).takePictureAsync;
    if (typeof takeFn !== "function") {
      setLastText("takePictureAsync not available");
      return;
    }

    const photo = await takeFn.call(cam, {
      quality: 0.8,
      skipProcessing: true,
      base64: true,
    });

    if (!photo?.base64) throw new Error("No base64 image returned");

    if (isDatasetMode) {
      setLastText(`Uploading ${selectedLabel}...`);

      const up = await fetch(`${SERVER_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: selectedLabel, imageBase64: photo.base64 }),
      });

      if (!up.ok) throw new Error("Upload failed");

      await fetch(`${SERVER_URL}/train`, { method: "POST" });

      setLastText(`Uploaded ✅ ${selectedLabel}`);
      await refreshCounts();
    } else {
      setLastText("Analyzing sign...");

      const res = await fetch(`${SERVER_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photo.base64 }),
      });

      if (!res.ok) throw new Error("Predict failed");

      const data = await res.json(); // { label, confidence }
      setLastText(`${data.label}`);
      recognizerRef.current.lastConfidence = data.confidence ?? 0;
    }
  } catch (e: any) {
    setLastText(`Failed: ${e?.message ?? "unknown error"}`);
  } finally {
    setIsSaving(false);
  }
};


  const toggleCameraFacing = () =>
    setFacing((f) => (f === "back" ? "front" : "back"));

  const speak = (text: string) => {
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    Speech.stop();
    Speech.speak(text, { rate: 0.95 });
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.overlayTop} pointerEvents="none">
          <Text style={styles.title}>SignSight</Text>
          <Text style={styles.subtitle}>Live Camera (MVP)</Text>
        </View>

        <View style={styles.overlayBottom} pointerEvents="box-none">
          {/* Dataset Toggle + Snapshot */}
          <View style={styles.row}>
             <Pressable
              style={[styles.btn, isSaving && { opacity: 0.6 }]}
              disabled={isSaving}
              onPress={takeSnapshot}
            >
              <Text style={styles.btnText}>
                {isSaving ? "Working..." : isDatasetMode ? `Snap + Upload (${selectedLabel})` : "Snap + Predict"}
              </Text>

            </Pressable>
            
            <Pressable style={styles.btn} onPress={() => setIsDatasetMode((v) => !v)}>
              <Text style={styles.btnText}>{isDatasetMode ? "Dataset: ON" : "Dataset: OFF"}</Text>
            </Pressable>

           
          </View>
 
      


          {/* Change Label */}
          {isDatasetMode && (
            <Pressable
              style={[styles.btn, { marginTop: 10 }]}
              onPress={() => {
                const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
                const idx = labels.indexOf(selectedLabel);
                setSelectedLabel(labels[(idx + 1) % labels.length]);
              }}
            >
              <Text style={styles.btnText}>Change Label ▶ {selectedLabel}</Text>
            </Pressable>
          )}

          {/* Detected */}
          <View style={styles.resultCard} pointerEvents="none">
            <Text style={styles.resultLabel}>Detected</Text>
            <Text style={styles.resultText}>
                {lastText}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                Confidence: {Math.round(recognizerRef.current.lastConfidence * 100)}%
              </Text>

          </View>

          {/* Dataset Dashboard */}
          {isDatasetMode && (
            <View style={styles.dashboard}>
              <Text style={styles.dashboardTitle}>Dataset (A–J)</Text>
              <Text style={styles.dashboardPath} numberOfLines={1}>
                {getDatasetRoot()}
              </Text>

              <View style={styles.dashboardGrid}>
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
            </View>
          )}

          {/* Main Buttons */}
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={toggleCameraFacing}>
              <Text style={styles.btnText}>Flip</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={() => speak(lastText)}>
              <Text style={styles.btnText}>Speak</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setLastText("Hello (sample output)")}
            >
              <Text style={styles.btnText}>Test Output</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  text: { color: "#fff", marginTop: 10, textAlign: "center" },

  overlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 54,
    paddingHorizontal: 18,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.8)", marginTop: 4 },

  overlayBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "android" ? 12 : 10,
    paddingHorizontal: 18,
    gap: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },

  resultCard: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  resultLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 },
  resultText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  row: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  btnGhost: { backgroundColor: "rgba(255,255,255,0.10)" },
  btnText: { color: "#fff", fontWeight: "700" },

  dashboard: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  dashboardTitle: { color: "#fff", fontWeight: "700", marginBottom: 6 },
  dashboardPath: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 10 },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
