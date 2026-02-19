import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ACCENT = "#2EE6A6";

export default function DashboardScreen({
  onTranslate,
  onTutorial,
  onSettings,
  onFeedback,
}: {
  onTranslate: () => void;
  onTutorial: () => void;
  onSettings: () => void;
  onFeedback: () => void;
}) {
  const { width } = useWindowDimensions();

  // ✅ responsive sizing
  const isSmall = width < 360;
  const isTablet = width >= 768;

  const P = isTablet ? 28 : isSmall ? 14 : 18;
  const heroTitleSize = isTablet ? 28 : isSmall ? 20 : 24;
  const heroSubSize = isTablet ? 14 : 12;

  // ✅ responsive card sizing for grid
  const cardMinWidth = isTablet ? 260 : 160;

  return (
    <SafeAreaView style={styles.safe}>
      {/* subtle background glow */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: P, paddingTop: 14, paddingBottom: 22 }}
        showsVerticalScrollIndicator={false}
      >
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
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color="rgba(255,255,255,0.75)"
            />
            <Text style={styles.pillText}>Secured</Text>
          </View>
        </View>

        {/* Hero card */}
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Ready when you are</Text>
          <Text style={[styles.heroTitle, { fontSize: heroTitleSize }]}>Translate ASL Letters</Text>
          <Text style={[styles.heroSub, { fontSize: heroSubSize }]}>
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

        {/* ✅ Wrap grid so it adapts */}
        <View style={[styles.grid, { gap: 12 }]}>
          <ActionCard
            title="Tutorial"
            sub="Learn the ASL alphabet"
            icon="book-outline"
            onPress={onTutorial}
            minWidth={cardMinWidth}
          />

          <ActionCard
            title="Settings"
            sub="Dataset, preferences"
            icon="settings-outline"
            onPress={onSettings}
            minWidth={cardMinWidth}
          />

          <ActionCard
            title="Feedback"
            sub="Send anonymous feedback"
            icon="chatbubble-ellipses-outline"
            onPress={onFeedback}
            minWidth={cardMinWidth}
          />
        </View>

        {/* Bottom note */}
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={16} color="rgba(255,255,255,0.75)" />
          <Text style={styles.tipText}>Tip: Keep your hand centered and avoid motion blur.</Text>
        </View>

        <Text style={styles.footer}>SignSight • Snapshot-based live tracking</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({
  title,
  sub,
  icon,
  onPress,
  minWidth,
}: {
  title: string;
  sub: string;
  icon: any;
  onPress: () => void;
  minWidth: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { minWidth, flexGrow: 1 }]}>
      <View style={styles.cardIconWrap}>
        <Ionicons name={icon} size={18} color={ACCENT} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },

  // ✅ subtle background glow layers
  bgGlow1: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(46,230,166,0.12)",
  },
  bgGlow2: {
    position: "absolute",
    bottom: -160,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(46,230,166,0.08)",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(46,230,166,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.22)",
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
    marginTop: 14,
    borderRadius: 26,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.18)",
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  heroKicker: { color: "rgba(46,230,166,0.92)", fontSize: 12, fontWeight: "900" },
  heroTitle: { color: "#fff", fontWeight: "900", marginTop: 6 },
  heroSub: {
    color: "rgba(255,255,255,0.62)",
    marginTop: 8,
    lineHeight: 18,
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
    marginTop: 18,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // ✅ responsive wrap grid
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
  },

  card: {
    borderRadius: 22,
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
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(46,230,166,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.58)", fontSize: 11, marginTop: 6, lineHeight: 15 },

  tip: {
    marginTop: 18,
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
    paddingTop: 14,
  },
});
