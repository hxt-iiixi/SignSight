import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export default function AuthGate({
  onAuthed,
  mode,
  onChangeMode,
}: {
  onAuthed: () => void;
  mode: "biometric" | "pin";
  onChangeMode: (m: "biometric" | "pin") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [hasFace, setHasFace] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();

      const face = supported.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const finger = supported.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

      setHasFace(face);

      // biometrics available only if hardware + enrolled and has any type
      setHasBiometrics(hasHardware && isEnrolled && (face || finger));

      // If biometrics isn't available, force PIN mode
      if (!(hasHardware && isEnrolled && (face || finger))) {
        onChangeMode("pin");
      }

      setLoading(false);
    })();
  }, []);

  const primaryLabel = useMemo(() => {
    if (hasFace) return "Continue with Face";
    return "Continue with Biometrics";
  }, [hasFace]);

  const handleBiometric = async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock SignSight",
      disableDeviceFallback: false, // allows device PIN/pattern as fallback
      fallbackLabel: "Use device passcode",
    });

    if (res.success) onAuthed();
  };

  // Basic in-app PIN placeholder (replace later with your real PIN)
  const handlePin = async () => {
    // TODO: replace with real PIN UI + validation
    // For now, just allow access
    onAuthed();
  };

  if (loading) {
    return (
      <ImageBackground source={require("../../assets/bg-auth.jpg")} style={styles.bg} resizeMode="cover">
        <View style={styles.overlay}>
          <Text style={styles.text}>Checking device security…</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require("../../assets/bg-auth.jpg")} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>
        <Text style={styles.title}>SignSight</Text>
        <Text style={styles.subtitle}>Unlock to continue</Text>

        {mode === "biometric" && hasBiometrics && (
          <TouchableOpacity style={styles.btn} onPress={handleBiometric}>
            <Text style={styles.btnText}>{primaryLabel}</Text>
          </TouchableOpacity>
        )}

        {mode === "pin" && (
          <TouchableOpacity style={styles.btn} onPress={handlePin}>
            <Text style={styles.btnText}>Continue with PIN</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => onChangeMode(mode === "pin" ? "biometric" : "pin")}
        >
          <Text style={styles.linkText}>
            {mode === "pin" ? "Use biometrics instead" : "Use PIN instead"}
          </Text>
        </TouchableOpacity>

        {!hasBiometrics && (
          <Text style={[styles.note, { marginTop: 12 }]}>
            Biometrics not available. Use PIN.
          </Text>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 24,
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 30, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.75)", marginTop: 8, marginBottom: 22 },
  text: { color: "#fff", textAlign: "center" },
  btn: { backgroundColor: "#1f6feb", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
  linkBtn: { marginTop: 14, alignItems: "center" },
  linkText: { color: "rgba(255,255,255,0.75)" },
  note: { color: "rgba(255,255,255,0.65)" },
});
