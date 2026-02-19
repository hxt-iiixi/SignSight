import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ImageBackground, Pressable } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import VideoSplashScreen from "./src/screens/VideoSplashScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import CameraScreenVC from "./src/screens/CameraScreenVC";
import TutorialScreen from "./src/screens/TutorialScreen";
import FeedbackScreen from "./src/screens/FeedbackScreen";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [route, setRoute] = useState("dashboard"); // "dashboard" | "camera"

  const [supportedTypes, setSupportedTypes] = useState([]);
  const [preferred, setPreferred] = useState("auto"); // "auto" | "face" | "fingerprint"

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setSupportedTypes(types || []);
    })();
  }, []);

  const hasFace = useMemo(
    () => supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
    [supportedTypes]
  );
  const hasFingerprint = useMemo(
    () => supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
    [supportedTypes]
  );

  useEffect(() => {
    if (!showSplash) authenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash, preferred]);

  const authenticate = async () => {
    try {
      setLoading(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // No biometrics at all → allow access (or you can force passcode by attempting authenticate anyway)
      if (!hasHardware || !isEnrolled) {
        setAuthenticated(true);
        return;
      }

      // Face priority logic
      const prompt =
        preferred === "face"
          ? "Unlock with Face"
          : preferred === "fingerprint"
          ? "Unlock with Fingerprint"
          : hasFace
          ? "Unlock with Face"
          : "Unlock";

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        disableDeviceFallback: false, // ✅ allows device PIN/Pattern/Passcode fallback
        fallbackLabel: "Use device passcode",
      });

      setAuthenticated(result.success);
    } catch (e) {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (showSplash) {
    return <VideoSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <ImageBackground source={require("./assets/bg-auth.jpg")} style={styles.bg} resizeMode="cover">
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={styles.text}>Authenticating…</Text>
        </View>
      </ImageBackground>
    );
  }

  if (!authenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Authentication required</Text>
        <Text style={[styles.text, { opacity: 0.7, marginBottom: 18 }]}>
          Face is prioritized when available. You can switch below.
        </Text>

        <View style={styles.row}>
          <Chip label="Auto" active={preferred === "auto"} onPress={() => setPreferred("auto")} />
          {hasFace && <Chip label="Face" active={preferred === "face"} onPress={() => setPreferred("face")} />}
          {hasFingerprint && (
            <Chip
              label="Fingerprint"
              active={preferred === "fingerprint"}
              onPress={() => setPreferred("fingerprint")}
            />
          )}
        </View>

        <Pressable style={styles.btn} onPress={authenticate}>
          <Text style={styles.btnText}>Try Again</Text>
        </Pressable>

        <Text style={[styles.text, { opacity: 0.6, marginTop: 12 }]}>
          If biometrics aren’t available, your device PIN/Passcode will be used.
        </Text>
      </View>
    );
  }

  if (route === "camera") return <CameraScreenVC onBack={() => setRoute("dashboard")} />;
  if (route === "feedback") return <FeedbackScreen onBack={() => setRoute("dashboard")} />;
  if (route === "tutorial") return <TutorialScreen onBack={() => setRoute("dashboard")} />;

  return (
    <DashboardScreen
      onBack={() => setRoute("dashboard")} // or whatever you want as "back"
      onTranslate={() => setRoute("camera")}
      onTutorial={() => setRoute("tutorial")}
      onSettings={() => console.log("Settings")}
      onFeedback={() => setRoute("feedback")}
    />
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 22 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  text: { color: "#fff", marginTop: 6, fontSize: 14, textAlign: "center" },
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },

  row: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipActive: { borderColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.12)" },
  chipText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  btn: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  btnText: { color: "#fff", fontWeight: "800" },
});
