import React from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AuthScreenProps = {
  hasFace: boolean;
  hasFingerprint: boolean;
  loading: boolean;
  preferred: "auto" | "face" | "fingerprint";
  onAuthenticate: () => void;
  onPreferredChange: (value: "auto" | "face" | "fingerprint") => void;
};

const PRIMARY = "#E66E19";
const PRIMARY_CONTAINER = "#F47A22";

export default function AuthScreen({
  hasFace,
  hasFingerprint,
  loading,
  preferred,
  onAuthenticate,
  onPreferredChange,
}: AuthScreenProps) {
  if (loading) {
    return (
      <ImageBackground
        source={require("../../../../assets/bg-auth.jpg")}
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

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Authentication required</Text>
      <Text style={[styles.text, { opacity: 0.7, marginBottom: 18 }]}>
        Face is prioritized when available. You can switch below.
      </Text>

      <View style={styles.row}>
        <Chip
          label="Auto"
          active={preferred === "auto"}
          onPress={() => onPreferredChange("auto")}
        />
        {hasFace ? (
          <Chip
            label="Face"
            active={preferred === "face"}
            onPress={() => onPreferredChange("face")}
          />
        ) : null}
        {hasFingerprint ? (
          <Chip
            label="Fingerprint"
            active={preferred === "fingerprint"}
            onPress={() => onPreferredChange("fingerprint")}
          />
        ) : null}
      </View>

      <Pressable style={styles.btn} onPress={onAuthenticate}>
        <Text style={styles.btnText}>Try Again</Text>
      </Pressable>

      <Text style={[styles.text, { opacity: 0.6, marginTop: 12 }]}>
        If biometrics aren’t available, your device PIN/Passcode will be used.
      </Text>
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    color: "#191C1D",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F2F4F7",
  },
  chipActive: {
    backgroundColor: "rgba(230,110,25,0.12)",
  },
  chipText: {
    color: "#4B5563",
    fontWeight: "700",
  },
  chipTextActive: {
    color: PRIMARY,
  },
  btn: {
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
  },
});
