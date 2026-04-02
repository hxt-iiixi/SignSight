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

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PRIMARY = "#E66E19";
const BG = "#F8F7F6";
const CARD = "#FFFFFF";
const BORDER = "#E7D9D0";
const MUTED = "#976D4E";
const TEXT = "#1B130E";

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
    paddingTop: Platform.OS === "android" ? 16 : 0,
  },



  stickyPreviewWrap: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: BG,
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
    padding: 20,
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: PRIMARY,
  },
  levelBadge: {
    backgroundColor: "rgba(230,110,25,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  levelBadgeText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  previewDesc: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 28,
    color: MUTED,
  },
  previewActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
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
    gap: 8,
  },
  watchBtnText: {
    color: "#fff",
    fontSize: 15,
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
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
  },

  grid: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },

  columnWrap: {
    justifyContent: "space-between",
    gap: 12,
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
    marginBottom: 12,
    gap: 10,
  },
  letterBtnActive: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: "rgba(230,110,25,0.05)",
  },
  letterText: {
    fontSize: 16,
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
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalImage: {
    width: "100%",
    height: 360,
  },
  modalCloseBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },


});