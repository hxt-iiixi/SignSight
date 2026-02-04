import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ACCENT = "#2EE6A6";

export default function DashboardScreen({
  onTranslate,
  onTutorial,
  onSettings,
}: {
  onTranslate: () => void;
  onTutorial: () => void;
  onSettings: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="hand-left-outline" size={18} color={ACCENT} />
            </View>
            <View>
              <Text style={styles.brandTitle}>SignSight</Text>
              <Text style={styles.brandSub}>ASL Landmark Translator</Text>
            </View>
          </View>

          <View style={styles.pill}>
            <Ionicons name="shield-checkmark-outline" size={16} color="rgba(255,255,255,0.75)" />
            <Text style={styles.pillText}>Secured</Text>
          </View>
        </View>

        {/* Hero card */}
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Ready when you are</Text>
          <Text style={styles.heroTitle}>Translate ASL Letters</Text>
          <Text style={styles.heroSub}>
            Uses 21 hand landmarks for better accuracy in different lighting.
          </Text>

          <Pressable style={styles.primaryBtn} onPress={onTranslate}>
            <View style={styles.primaryBtnRow}>
              <View style={styles.primaryIcon}>
                <Ionicons name="camera-outline" size={18} color="#0B0F14" />
              </View>
              <Text style={styles.primaryText}>Translate Now</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
            </View>
          </Pressable>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.grid}>
          <Pressable style={styles.card} onPress={onTutorial}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="book-outline" size={18} color={ACCENT} />
            </View>
            <Text style={styles.cardTitle}>Tutorial</Text>
            <Text style={styles.cardSub}>How to sign A–C properly</Text>
          </Pressable>

          <Pressable style={styles.card} onPress={onSettings}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="settings-outline" size={18} color={ACCENT} />
            </View>
            <Text style={styles.cardTitle}>Settings</Text>
            <Text style={styles.cardSub}>Dataset, voice, preferences</Text>
          </Pressable>
        </View>

        {/* Bottom note */}
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={16} color="rgba(255,255,255,0.75)" />
          <Text style={styles.tipText}>
            Tip: Keep your hand centered and avoid motion blur.
          </Text>
        </View>

        <Text style={styles.footer}>SignSight • Snapshot-based live tracking</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 14, gap: 14 },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(46,230,166,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  brandSub: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800" },

  hero: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.18)",
    ...Platform.select({
      android: { elevation: 5 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  heroKicker: { color: "rgba(46,230,166,0.9)", fontSize: 12, fontWeight: "900" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 6 },
  heroSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },

  primaryBtn: {
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(46,230,166,0.18)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.30)",
  },
  primaryBtnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "900" },

  sectionTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 2,
  },

  grid: { flexDirection: "row", gap: 12 },
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(46,230,166,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  cardSub: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },

  tip: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  tipText: { flex: 1, color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 15 },

  footer: {
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    paddingBottom: 14,
    paddingTop: 8,
  },
});
