import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#E66E19";
const BG = "#F8F7F6";
const CARD = "#FFFFFF";
const TEXT = "#1B130E";
const MUTED = "#976D4E";
const BORDER = "#F3ECE7";

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

  const isSmall = width < 360;
  const isTablet = width >= 768;

  const P = isTablet ? 28 : isSmall ? 14 : 18;
  const heroTitleSize = isTablet ? 30 : isSmall ? 20 : 24;
  const statusBarInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const topSpacing = statusBarInset + (isTablet ? 8 : 4);
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;
  const scrollBottomPadding = bottomNavPadding + 110;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: P, paddingTop: topSpacing },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.logoWrap}>
              <Ionicons name="hand-left-outline" size={22} color={PRIMARY} />
            </View>
          </View>
        </View>

        {/* Page Title */}
        <View style={[styles.pageHead, { paddingHorizontal: P }]}>
          <Text style={[styles.pageTitle, { fontSize: heroTitleSize }]}>
           SignSight
          </Text>
          <Text style={styles.pageSub}>Real-time sign language interpretation</Text>
        </View>

        {/* Hero Card */}
        <View style={{ paddingHorizontal: P, marginTop: 8 }}>
          <View style={styles.heroCard}>
            <ImageBackground
              source={{
                uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDuYqUxtI5_XFPcKR0qGe1pTjoAw2mrdzUEBUQXIzusKwMlJNoNKiZvjjb5oq2a3j1ZiJCX05Jor-aLzwUPXV-NL_SYeN8J5vb_r0WrlSBqZ5Ihf1SpF7KP7iz-4rrJnD1HfkhUDeUE6Nu9-MPIuOf2BkCUeR4NJ7BhQFj_MM2GUKMQTcqdPUH6uzCnDn86cCS-mnY35vcRfi7lNwNeDDlejuBB9NS7u3rJGJxSwXRXtC5pg_32jldOGDnV6SZcL45K3mBkb5dj0Q",
              }}
              imageStyle={styles.heroImageStyle}
              style={styles.heroImage}
            >
              <View style={styles.heroOverlay} />
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE DETECTION READY</Text>
              </View>
            </ImageBackground>

            <View style={styles.heroBody}>
              <Text style={styles.heroBodyTitle}>Translate ASL Letters</Text>
              <Text style={styles.heroBodySub}>
                Start real-time translation using your device&apos;s camera to
                identify landmarks and signs.
              </Text>

              <Pressable style={styles.startBtn} onPress={onTranslate}>
                <Ionicons name="videocam-outline" size={18} color="#fff" />
                <Text style={styles.startBtnText}>Start Camera</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={[styles.sectionWrap, { paddingHorizontal: P, marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Tips for Better Accuracy</Text>
        </View>

        <View style={[styles.tipsList, { paddingHorizontal: P }]}>
          <View style={styles.tipCard}>
            <View style={styles.tipIconWrap}>
              <Ionicons name="bulb-outline" size={18} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Good Lighting</Text>
              <Text style={styles.tipDesc}>
                Ensure your hands are well-lit for the sensor to track landmarks accurately.
              </Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIconWrap}>
              <Ionicons name="scan-outline" size={18} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Stay in Frame</Text>
              <Text style={styles.tipDesc}>
                Keep your hands within the camera frame, about 2–3 feet away from the lens.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomNav,
          { paddingBottom: bottomNavPadding },
        ]}
      >
        <NavItem icon="home-outline" label="Home" active />
        <NavItem
          icon="book-outline"
          label="Tutorial"
          onPress={onTutorial}
        />
        <NavItem
          icon="create-outline"
          label="Feedback"
          onPress={onFeedback}
        />
        <NavItem
          icon="settings-outline"
          label="Settings"
          onPress={onSettings}
        />
      </View>
    </SafeAreaView>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onPress?: () => void;
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
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(230,110,25,0.10)",
  },
  brandText: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  pageHead: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  pageTitle: {
    color: TEXT,
    fontWeight: "800",
    lineHeight: 32,
  },
  pageSub: {
    marginTop: 2,
    color: MUTED,
    fontSize: 14,
    fontWeight: "500",
  },

  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  heroImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    justifyContent: "flex-end",
  },
  heroImageStyle: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  liveBadge: {
    alignSelf: "flex-start",
    marginLeft: 14,
    marginBottom: 14,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  heroBody: {
    padding: 18,
  },
  heroBodyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT,
  },
  heroBodySub: {
    marginTop: 6,
    color: MUTED,
    fontSize: 14,
    lineHeight: 22,
  },

  startBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  sectionWrap: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT,
  },

  tipsList: {
    gap: 12,
  },
  tipCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(243,236,231,0.70)",
  },
  tipIconWrap: {
    paddingTop: 2,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT,
  },
  tipDesc: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-around",
    borderWidth: 1,
    borderBottomWidth: 0,
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
