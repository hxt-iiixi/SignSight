import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import CameraScreen from "./src/screens/CameraScreen";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authenticate();
  }, []);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Authenticating…</Text>
      </View>
    );
  }

  if (!authenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Authentication required</Text>
      </View>
    );
  }

  return <CameraScreen />;
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
});
