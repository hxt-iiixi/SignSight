import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  SafeAreaView,
  useWindowDimensions,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TYPOGRAPHY } from "../config/typography";
import { SPACING } from "../config/spacing";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PRIMARY = "#E66E19";
const PRIMARY_CONTAINER = "#F47A22";
const BG = "#F8F9FA";
const CARD = "#FFFFFF";
const BORDER = "#F3F4F5";
const MUTED = "#737373";
const TEXT = "#191C1D";

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

const LETTER_DESCRIPTIONS: Record<string, string> = {
  A: "Closed fist with the thumb resting vertically against the side of the index finger. Keep your palm facing the viewer.",
  B: "Hold your hand upright with fingers together and thumb tucked across the palm.",
  C: "Curve your fingers and thumb to form a clear letter C shape.",
  D: "Raise the index finger while the other fingers touch the thumb.",
  E: "Curl your fingers inward with the thumb resting across them.",
  F: "Touch the tip of the thumb and index finger while the other fingers stay raised.",
  G: "Point the index finger and thumb sideways, parallel to each other.",
  H: "Extend the index and middle finger together sideways.",
  I: "Raise the pinky while the other fingers stay folded.",
  J: "Draw a J shape in the air using the pinky finger.",
  K: "Raise the index and middle fingers while the thumb touches the middle finger.",
  L: "Extend the index finger and thumb to form an L shape.",
  M: "Place the thumb under three fingers.",
  N: "Place the thumb under two fingers.",
  O: "Curve all fingers and thumb together to form a circle.",
  P: "Point index and middle finger downward while thumb touches the middle finger.",
  Q: "Point index finger and thumb downward, similar to G but facing down.",
  R: "Cross the index and middle fingers.",
  S: "Make a fist with the thumb wrapped over the fingers.",
  T: "Place the thumb between the index and middle fingers.",
  U: "Raise the index and middle fingers together.",
  V: "Raise the index and middle fingers apart in a V shape.",
  W: "Raise the index, middle, and ring fingers.",
  X: "Curl the index finger into a hook shape.",
  Y: "Extend the thumb and pinky outward.",
  Z: "Draw the letter Z in the air with the index finger.",
};

export default function TutorialScreen({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState("A");
  const [showImageModal, setShowImageModal] = useState(false);
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const numColumns = isTablet ? 6 : 3;
  const data = useMemo(() => LETTERS.map((l) => ({ key: l })), []);

  return (
    <SafeAreaView style={styles.container}>

      {/* Page Title */}
      <View style={styles.headBlock}>
        <Text style={styles.pageTitle}>ASL Alphabet</Text>
        {/* <Text style={styles.pageSub}>Learn and practice American Sign Language</Text> */}
      </View>

      {/* Sticky preview area */}
      <View style={styles.stickyPreviewWrap}>
        <View style={styles.previewCard}>
          <View style={styles.previewImageWrap}>
            <Image
              source={ASL_IMAGES[selected]}
              style={styles.previewImg}
              resizeMode="cover"
            />
          </View>

          <View style={styles.previewBody}>
            <View style={styles.previewTopRow}>
              <Text style={styles.previewTitle}>Letter '{selected}'</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>BEGINNER</Text>
              </View>
            </View>

            <Text style={styles.previewDesc}>
              {LETTER_DESCRIPTIONS[selected] ?? "Learn how to properly form this ASL letter."}
            </Text>

            <View style={styles.previewActions}>
              <Pressable style={styles.watchBtn} onPress={() => setShowImageModal(true)}>
                <Ionicons name="image-outline" size={18} color="#fff" />
                <Text style={styles.watchBtnText}>View Image</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Practice the Alphabet</Text>
          <Text style={styles.sectionCount}>26 Letters</Text>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
        renderItem={({ item }) => {
          const active = item.key === selected;

          return (
            <Pressable
              onPress={() => setSelected(item.key)}
              style={[styles.letterBtn, active && styles.letterBtnActive]}
            >
              <Ionicons
                name="hand-left-outline"
                size={26}
                color={active ? PRIMARY : "#D9C5B8"}
              />
              <Text style={[styles.letterText, active && styles.letterTextActive]}>
                {item.key}
              </Text>
            </Pressable>
          );
        }}
      />

      <Modal visible={showImageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image
              source={ASL_IMAGES[selected]}
              style={styles.modalImage}
              resizeMode="contain"
            />
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowImageModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  headBlock: {
    paddingHorizontal: SPACING.SPACE_MD,
    paddingTop: SPACING.SPACE_2XL,
    marginBottom: SPACING.SPACE_LG,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.TEXT_3XL,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -0.8,
  },
  pageSub: {
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
    color: MUTED,
    marginTop: SPACING.SPACE_XXS,
    lineHeight: 20,
  },
  stickyPreviewWrap: {
    paddingTop: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingBottom: SPACING.SPACE_MD,
    backgroundColor: BG,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  previewCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  previewImageWrap: {
    height: 180,
    backgroundColor: "#DDD",
  },
  previewImg: {
    width: "100%",
    height: "100%",
  },
  previewBody: {
    padding: SPACING.SPACE_LG,
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "800",
    color: PRIMARY,
  },
  levelBadge: {
    backgroundColor: "rgba(230,110,25,0.10)",
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_XXS,
    borderRadius: 999,
  },
  levelBadgeText: {
    color: PRIMARY,
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  previewDesc: {
    marginTop: SPACING.SPACE_MD,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 28,
    color: MUTED,
  },
  previewActions: {
    marginTop: SPACING.SPACE_LG,
    flexDirection: "row",
    gap: SPACING.SPACE_SM,
    alignItems: "center",
  },
  watchBtn: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.SPACE_XS,
  },
  watchBtnText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "800",
  },
  favoriteBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  sectionHeader: {
    marginTop: SPACING.SPACE_LG,
    marginBottom: SPACING.SPACE_SM,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
    color: TEXT,
  },
  sectionCount: {
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    color: MUTED,
  },

  grid: {
    paddingHorizontal: SPACING.SPACE_MD,
    paddingBottom: 110,
  },

  columnWrap: {
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },

  letterBtn: {
    flex: 1,
    minWidth: 92,
    maxWidth: "31%",
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.SPACE_SM,
    gap: SPACING.SPACE_XS,
  },
  letterBtnActive: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: "rgba(230, 110, 25, 0.15)",
  },
  letterText: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
    color: TEXT,
  },
  letterTextActive: {
    color: PRIMARY,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.SPACE_LG,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: "#fff",
    padding: SPACING.SPACE_MD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalImage: {
    width: "100%",
    height: 360,
  },
  modalCloseBtn: {
    marginTop: SPACING.SPACE_SM,
    height: 48,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_MD,
  },


});