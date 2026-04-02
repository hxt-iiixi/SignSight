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
import { TYPOGRAPHY } from "../config/typography";
import { SPACING } from "../config/spacing";

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
  const statusBarInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const topSpacing = statusBarInset + (isTablet ? 24 : 16);
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;
  const scrollBottomPadding = bottomNavPadding + 110;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header and Page Title */}
        <View style={[styles.pageHead, { paddingHorizontal: P }]}>
          <Text style={styles.pageTitle}>
           SignSight
          </Text>
          <Text style={styles.pageSub}>Real-time sign language interpretation</Text>
        </View>

        {/* Hero Card */}
        <View style={{ paddingHorizontal: P, marginTop: SPACING.SPACE_SM }}>
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
        <View style={[styles.sectionWrap, { paddingHorizontal: P, marginTop: SPACING.SPACE_LG }]}>
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


    </SafeAreaView>
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
  dashboardLinks: {
    marginTop: SPACING.SPACE_XXS,
    flexDirection: "row",
    gap: SPACING.SPACE_SM,
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
    fontSize: TYPOGRAPHY.TEXT_XL,
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
    paddingTop: SPACING.SPACE_2XL,
    paddingBottom: SPACING.SPACE_XS,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.TEXT_3XL,
    color: TEXT,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  pageSub: {
    marginTop: SPACING.SPACE_XXS,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
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
    marginLeft: SPACING.SPACE_MD,
    marginBottom: SPACING.SPACE_MD,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_XXS,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  heroBody: {
    padding: SPACING.SPACE_LG,
  },
  heroBodyTitle: {
    fontSize: TYPOGRAPHY.TEXT_2XL,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -0.5,
  },
  heroBodySub: {
    marginTop: SPACING.SPACE_XS,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 22,
  },

  startBtn: {
    marginTop: SPACING.SPACE_LG,
    height: 52,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
  },
  startBtnText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
  },

  sectionWrap: {
    paddingTop: SPACING.SPACE_LG,
    paddingBottom: SPACING.SPACE_XS,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.TEXT_2XL,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -0.5,
  },

  tipsList: {
    gap: SPACING.SPACE_MD,
  },
  tipCard: {
    flexDirection: "row",
    gap: SPACING.SPACE_MD,
    padding: SPACING.SPACE_MD,
    borderRadius: 18,
    backgroundColor: "rgba(243,236,231,0.70)",
  },
  tipIconWrap: {
    paddingTop: 2,
  },
  tipTitle: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
    color: TEXT,
  },
  tipDesc: {
    marginTop: SPACING.SPACE_XXS,
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 18,
    color: MUTED,
  },


});
