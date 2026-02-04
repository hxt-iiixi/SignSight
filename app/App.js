import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import CameraScreen from "./src/screens/CameraScreen";
import VideoSplashScreen from "./src/screens/VideoSplashScreen";
import { ImageBackground } from "react-native";
import DashboardScreen from "./src/screens/DashboardScreen";


export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [route, setRoute] = useState("dashboard"); // "dashboard" | "camera"

  useEffect(() => {
    if (!showSplash) authenticate();
  }, [showSplash]);


  const authenticate = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // No biometrics available → allow app access
        setAuthenticated(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock SignSight",
        fallbackLabel: "Use device passcode",
        disableDeviceFallback: false,
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
      <ImageBackground
        source={require("./assets/bg-auth.jpg")}
        style={styles.bg}
        resizeMode="cover"
      >
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
        <Text style={styles.text}>Authentication required</Text>
      </View>
    );
  }

  if (route === "camera") {
    return <CameraScreen />;
  }

  return (
    <DashboardScreen
      onTranslate={() => setRoute("camera")}
      onTutorial={() => console.log("Tutorial")}
      onSettings={() => console.log("Settings")}
    />
  );

}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
  },
  bg: { flex: 1 },
    overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)", // darken image
    alignItems: "center",
    justifyContent: "center",
  },

});
