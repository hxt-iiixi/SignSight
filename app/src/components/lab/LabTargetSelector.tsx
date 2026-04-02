import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TEXT,
  TEXT_SECONDARY,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  BORDER,
  BG,
  BG_CARD,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  INFO,
  INFO_LIGHT,
  INFO_BORDER,
  WARNING,
  WARNING_LIGHT,
  WARNING_BORDER,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_PILL,
  PAD_MD,
  PAD_SM,
} from "./shared/labColors";
import type { DetectMode } from "../../ml/streamTypes";

type TargetChoice = {
  value: string;
  isActive: boolean;
  isReady: boolean;
  isStaticWord: boolean;
  isGesture: boolean;
};

type LabTargetSelectorProps = {
  visible: boolean;
  detectMode: DetectMode;
  choices: TargetChoice[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
};

function getBadgeStyle(choice: TargetChoice) {
  if (choice.isStaticWord)
    return { label: "Static word", color: INFO, bg: INFO_LIGHT, border: INFO_BORDER };
  if (choice.isGesture)
    return { label: "Gesture", color: ACCENT, bg: ACCENT_LIGHT, border: ACCENT_BORDER };
  if (choice.isActive)
    return { label: "Active in model", color: SUCCESS, bg: SUCCESS_LIGHT, border: SUCCESS_BORDER };
  if (choice.isReady)
    return { label: "Quota-ready", color: INFO, bg: INFO_LIGHT, border: INFO_BORDER };
  return { label: "Collecting", color: WARNING, bg: WARNING_LIGHT, border: WARNING_BORDER };
}

export default function LabTargetSelector({
  visible,
  detectMode,
  choices,
  selectedValue,
  onSelect,
  onClose,
}: LabTargetSelectorProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>
                {detectMode === "WORDS" ? "Select Word" : "Select Letter"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {detectMode === "WORDS"
                  ? "Choose which word target to capture"
                  : "Choose which letter label to collect"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="close" size={20} color={TEXT} />
            </Pressable>
          </View>

          {/* Target list */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Clear selection */}
            <Pressable
              onPress={() => onSelect(null)}
              style={({ pressed }) => [
                styles.choiceCard,
                !selectedValue && styles.choiceCardSelected,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.choiceMain}>
                <Text style={styles.choiceLabel}>None</Text>
                <Text style={styles.choiceDescription}>
                  Clear target selection
                </Text>
              </View>
              {!selectedValue && (
                <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
              )}
            </Pressable>

            {choices.map((choice) => {
              const isSelected = selectedValue === choice.value;
              const badge = getBadgeStyle(choice);

              return (
                <Pressable
                  key={choice.value}
                  onPress={() => onSelect(choice.value)}
                  style={({ pressed }) => [
                    styles.choiceCard,
                    isSelected && styles.choiceCardSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.choiceMain}>
                    <View style={styles.choiceTitleRow}>
                      <Text style={styles.choiceLabel}>{choice.value}</Text>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.choiceDescription}>
                      {choice.isStaticWord
                        ? "Static landmark — recognized live from hand pose"
                        : choice.isGesture
                          ? "Gesture — requires multi-frame recording"
                          : choice.isActive
                            ? "Already active in the serving model"
                            : choice.isReady
                              ? "Has enough samples for the next retrain"
                              : "Still collecting landmark samples"}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={ACCENT}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: PAD_MD,
    paddingTop: PAD_MD,
    paddingBottom: PAD_SM,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 18,
  },
  headerSubtitle: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 8,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
  },
  listContent: {
    padding: PAD_MD,
    gap: 8,
    paddingBottom: 40,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: PAD_MD,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
  },
  choiceCardSelected: {
    backgroundColor: ACCENT_LIGHT,
    borderColor: ACCENT_BORDER,
  },
  choiceMain: {
    flex: 1,
    gap: 4,
  },
  choiceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 15,
  },
  choiceDescription: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: RADIUS_PILL,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: "800",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
