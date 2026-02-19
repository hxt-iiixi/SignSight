import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, SafeAreaView } from "react-native";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ✅ Replace these with YOUR real paths
const ASL_IMAGES: Record<string, any> = {
  A: require("../../assets/asl/A.png"),
  B: require("../../assets/asl/B.png"),
  C: require("../../assets/asl/C.png"),
  D: require("../../assets/asl/D.png"),
  E: require("../../assets/asl/E.png"),
  F: require("../../assets/asl/F.png"),
  G: require("../../assets/asl/G.png"),
  H: require("../../assets/asl/H.png"),
  I: require("../../assets/asl/I.png"),
  J: require("../../assets/asl/J.png"),
  K: require("../../assets/asl/K.png"),
  L: require("../../assets/asl/L.png"),
  M: require("../../assets/asl/M.png"),
  N: require("../../assets/asl/N.png"),
  O: require("../../assets/asl/O.png"),
  P: require("../../assets/asl/P.png"),
  Q: require("../../assets/asl/Q.png"),
  R: require("../../assets/asl/R.png"),
  S: require("../../assets/asl/S.png"),
  T: require("../../assets/asl/T.png"),
  U: require("../../assets/asl/U.png"),
  V: require("../../assets/asl/V.png"),
  W: require("../../assets/asl/W.png"),
  X: require("../../assets/asl/X.png"),
  Y: require("../../assets/asl/Y.png"),
  Z: require("../../assets/asl/Z.png"),
};


export default function TutorialScreen({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState("A");
  const data = useMemo(() => LETTERS.map((l) => ({ key: l })), []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>ASL Alphabet</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Preview */}
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Letter: {selected}</Text>
        <Image source={ASL_IMAGES[selected]} style={styles.previewImg} resizeMode="contain" />
      </View>

      <Text style={styles.sectionLabel}>Pick a letter</Text>

      {/* Grid */}
      <FlatList
        data={data}
        numColumns={6}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const active = item.key === selected;
          return (
            <Pressable
              onPress={() => setSelected(item.key)}
              style={[styles.letterBtn, active && styles.letterBtnActive]}
            >
              <Text style={[styles.letterText, active && styles.letterTextActive]}>{item.key}</Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  backText: { color: "#fff", fontWeight: "800" },
  title: { color: "#fff", fontSize: 16, fontWeight: "900" },

  previewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 14,
    marginTop: 6,
  },
  previewTitle: { color: "rgba(255,255,255,0.9)", fontWeight: "900", marginBottom: 10 },
  previewImg: { width: "100%", height: 220 },

  sectionLabel: { color: "rgba(255,255,255,0.75)", marginTop: 14, marginBottom: 10 },

  grid: { paddingBottom: 18 },
  letterBtn: {
    flex: 1,
    margin: 6,
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  letterBtnActive: {
    borderColor: "rgba(46,230,166,0.55)",
    backgroundColor: "rgba(46,230,166,0.18)",
  },
  letterText: { color: "#fff", fontWeight: "900" },
  letterTextActive: { color: "#fff" },
});
