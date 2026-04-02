import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ImageBackground, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import * as NavigationBar from "expo-navigation-bar";
import VideoSplashScreen from "./src/screens/VideoSplashScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import CameraScreenVC from "./src/screens/CameraScreenVC";
import TutorialScreen from "./src/screens/TutorialScreen";
import FeedbackScreen from "./src/screens/FeedbackScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import LabScreen from "./src/screens/LabScreen";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [route, setRoute] = useState("dashboard");
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [showHandOverlay, setShowHandOverlay] = useState(false);

  const [supportedTypes, setSupportedTypes] = useState([]);
  const [preferred, setPreferred] = useState("auto"); // "auto" | "face" | "fingerprint"
  const isCameraLikeRoute = route === "camera" || route === "lab";
  const statusBarStyle =
    showSplash || loading || !authenticated || isCameraLikeRoute
      ? "light"
      : "dark";
  const statusBarBackgroundColor =
    showSplash || loading || !authenticated
      ? "#000000"
      : isCameraLikeRoute
        ? "transparent"
        : "#FFFFFF";
  const statusBarTranslucent = isCameraLikeRoute;

  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        try {
          await NavigationBar.setBackgroundColorAsync("#FFFFFF");
          await NavigationBar.setButtonStyleAsync("dark");
        } catch (e) {}
      }

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
    return (
      <>
        <ExpoStatusBar
          style={statusBarStyle}
          backgroundColor={statusBarBackgroundColor}
          translucent={statusBarTranslucent}
        />
        <VideoSplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <ExpoStatusBar
          style={statusBarStyle}
          backgroundColor={statusBarBackgroundColor}
          translucent={statusBarTranslucent}
        />
        <ImageBackground source={require("./assets/bg-auth.jpg")} style={styles.bg} resizeMode="cover">
          <View style={styles.overlay}>
            <ActivityIndicator size="large" />
            <Text style={styles.text}>Authenticating…</Text>
          </View>
        </ImageBackground>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <ExpoStatusBar
          style={statusBarStyle}
          backgroundColor={statusBarBackgroundColor}
          translucent={statusBarTranslucent}
        />
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
      </>
    );
  }

  if (route === "camera") {
    return (
      <>
        <ExpoStatusBar
          style={statusBarStyle}
          backgroundColor={statusBarBackgroundColor}
          translucent={statusBarTranslucent}
        />
        <CameraScreenVC
          onBack={() => setRoute("dashboard")}
          debugEnabled={debugEnabled}
          showHandOverlay={showHandOverlay}
        />
      </>
    );
  }
  if (route === "lab") {
    return (
      <>
        <ExpoStatusBar
          style={statusBarStyle}
          backgroundColor={statusBarBackgroundColor}
          translucent={statusBarTranslucent}
        />
        <LabScreen
          onBack={() => setRoute("settings")}
          debugEnabled={debugEnabled}
          showHandOverlay={showHandOverlay}
        />
      </>
    );
  }

  // Persistent Tab Routes
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;

  return (
    <>
      <ExpoStatusBar
        style={statusBarStyle}
        backgroundColor={statusBarBackgroundColor}
        translucent={statusBarTranslucent}
      />
      <View style={{ flex: 1 }}>
        {route === "dashboard" && (
          <DashboardScreen
            onTranslate={() => setRoute("camera")}
            onTutorial={() => setRoute("tutorial")}
            onSettings={() => setRoute("settings")}
            onFeedback={() => setRoute("feedback")}
          />
        )}
        {route === "tutorial" && <TutorialScreen onBack={() => setRoute("dashboard")} />}
        {route === "feedback" && <FeedbackScreen onBack={() => setRoute("dashboard")} />}
        {route === "settings" && (
          <SettingsScreen
            onBack={() => setRoute("dashboard")}
            debugEnabled={debugEnabled}
            setDebugEnabled={setDebugEnabled}
            showHandOverlay={showHandOverlay}
            setShowHandOverlay={setShowHandOverlay}
            onOpenLab={() => setRoute("lab")}
          />
        )}
        
        <View style={[styles.bottomNav, { paddingBottom: bottomNavPadding }]}>
          <NavItem icon="home-outline" label="Home" active={route === "dashboard"} onPress={() => setRoute("dashboard")} />
          <NavItem icon="book-outline" label="Tutorial" active={route === "tutorial"} onPress={() => setRoute("tutorial")} />
          <NavItem icon="create-outline" label="Feedback" active={route === "feedback"} onPress={() => setRoute("feedback")} />
          <NavItem icon="settings-outline" label="Settings" active={route === "settings"} onPress={() => setRoute("settings")} />
        </View>
      </View>
    </>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const PRIMARY = "#E66E19";
const MUTED = "#976D4E";

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}) {
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <Ionicons
        name={icon}
        size={22}
        color={active ? PRIMARY : MUTED}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
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

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#F3ECE7",
    ...Platform.select({
      android: { elevation: 10 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
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
    color: MUTED,
  },
  navLabelActive: {
    color: PRIMARY,
    fontWeight: "800",
  },
});
