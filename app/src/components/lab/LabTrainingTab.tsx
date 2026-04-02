import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LabCard from "./shared/LabCard";
import LabPill from "./shared/LabPill";
import {
  TEXT,
  TEXT_SECONDARY,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  BORDER,
  BG_CARD,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  WARNING,
  WARNING_LIGHT,
  WARNING_BORDER,
  DANGER,
  INFO,
  RADIUS_MD,
  RADIUS_PILL,
  PAD_SM,
  PAD_MD,
} from "./shared/labColors";
import { TYPOGRAPHY } from "../../config/typography";
import type { DetectMode } from "../../ml/streamTypes";

type LandmarkTrainingMode = "bootstrap" | "full_reviewed";

type LabTrainingTabProps = {
  detectMode: DetectMode;
  landmarkTrainingMode: LandmarkTrainingMode;
  currentServingMode: LandmarkTrainingMode;
  activeModelVersionId: string | null;
  activeModelLabel: string | null;
  activeLetterCount: number;
  totalLetterCount: number;
  readyLettersByMode: Record<LandmarkTrainingMode, string[]>;
  selectedWordIsStaticLandmark: boolean;
  onSetTrainingMode: (mode: LandmarkTrainingMode) => void;
  onTrainLandmarks: () => void;
  onTrainGestures: () => void;
};

export default function LabTrainingTab({
  detectMode,
  landmarkTrainingMode,
  currentServingMode,
  activeModelVersionId,
  activeModelLabel,
  activeLetterCount,
  totalLetterCount,
  readyLettersByMode,
  selectedWordIsStaticLandmark,
  onSetTrainingMode,
  onTrainLandmarks,
  onTrainGestures,
}: LabTrainingTabProps) {
  const isLetters = detectMode === "LETTERS";
  const isWords = detectMode === "WORDS";
  const showLandmarkTraining = isLetters || (isWords && selectedWordIsStaticLandmark);
  const showGestureTraining = isWords && !selectedWordIsStaticLandmark;
  const readyCount = readyLettersByMode[landmarkTrainingMode].length;
  const isBootstrap = landmarkTrainingMode === "bootstrap";

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Training readiness summary */}
      <LabCard>
        <Text style={styles.sectionLabel}>TRAINING READINESS</Text>

        <View style={styles.pillRow}>
          <LabPill
            label="Serving Mode"
            value={currentServingMode === "bootstrap" ? "Bootstrap" : "Full Reviewed"}
            compact
          />
          <LabPill
            label="Active Set"
            value={`${activeLetterCount}/${totalLetterCount}`}
            tone={activeLetterCount > 0 ? "success" : "warning"}
            compact
          />
          <LabPill
            label="Pending"
            value={String(readyCount)}
            tone={readyCount > 0 ? "info" : "neutral"}
            compact
          />
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="server-outline" size={14} color={TEXT_SECONDARY} />
          <Text style={styles.summaryText}>
            Serving: {activeModelLabel ?? activeModelVersionId ?? "No model"}
          </Text>
        </View>
      </LabCard>

      {/* Landmark training */}
      {showLandmarkTraining && (
        <LabCard>
          <Text style={styles.sectionLabel}>LANDMARK RETRAIN</Text>

          <Text style={styles.description}>
            {isBootstrap
              ? "Bootstrap mode uses lower quotas for solo or early internal testing."
              : "Full reviewed mode uses the stricter final dataset quotas and signer diversity."}{" "}
            Creates a new model version without overwriting the old one.
          </Text>

          {/* Mode selector */}
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => onSetTrainingMode("bootstrap")}
              style={({ pressed }) => [
                styles.modeOption,
                isBootstrap && styles.modeOptionActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.modeOptionText,
                  isBootstrap && styles.modeOptionTextActive,
                ]}
              >
                Bootstrap
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSetTrainingMode("full_reviewed")}
              style={({ pressed }) => [
                styles.modeOption,
                !isBootstrap && styles.modeOptionActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.modeOptionText,
                  !isBootstrap && styles.modeOptionTextActive,
                ]}
              >
                Full Reviewed
              </Text>
            </Pressable>
          </View>

          {/* Training CTA */}
          <Pressable
            onPress={onTrainLandmarks}
            style={({ pressed }) => [
              styles.trainButton,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name="flash-outline" size={18} color={BG_CARD} />
            <Text style={styles.trainButtonText}>
              {isBootstrap
                ? "Create New Bootstrap Model"
                : "Create New Full Reviewed Model"}
            </Text>
          </Pressable>

          {activeModelVersionId && (
            <View style={styles.metaRow}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={TEXT_SECONDARY}
              />
              <Text style={styles.metaText}>
                Current serving mode:{" "}
                {currentServingMode === "bootstrap"
                  ? "Bootstrap"
                  : "Full reviewed"}{" "}
                · Version: {activeModelVersionId}
              </Text>
            </View>
          )}
        </LabCard>
      )}

      {/* Training notice */}
      <View style={styles.noticeCard}>
        <Ionicons name="alert-circle-outline" size={16} color={WARNING} />
        <Text style={styles.noticeText}>
          {showGestureTraining
            ? "Train only after you have collected enough clean gesture samples for the current target set."
            : isBootstrap
              ? "Bootstrap mode is temporary and should not be treated as the final shared model."
              : "Full reviewed mode expects stricter dataset quotas and signer diversity."}
          {selectedWordIsStaticLandmark
            ? " Static word landmarks are learned through the main landmark retrain, not a separate model."
            : ""}
        </Text>
      </View>

      {/* Gesture training */}
      {showGestureTraining && (
        <LabCard>
          <Text style={styles.sectionLabel}>GESTURE TRAINING</Text>

          <Text style={styles.description}>
            Train the gesture model from all collected gesture samples. This
            creates a new gesture model that handles multi-frame word
            recognition.
          </Text>

          <Pressable
            onPress={onTrainGestures}
            style={({ pressed }) => [
              styles.trainButton,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name="flash-outline" size={18} color={BG_CARD} />
            <Text style={styles.trainButtonText}>Train Gesture Model</Text>
          </Pressable>
        </LabCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: PAD_MD,
    gap: 12,
    paddingBottom: 24,
  },
  sectionLabel: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  description: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  // Mode selector
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    backgroundColor: "rgba(0,0,0,0.02)",
    alignItems: "center",
  },
  modeOptionActive: {
    backgroundColor: ACCENT_LIGHT,
    borderColor: ACCENT_BORDER,
  },
  modeOptionText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  modeOptionTextActive: {
    color: ACCENT,
    fontWeight: "900",
  },
  // Train button
  trainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS_MD,
    backgroundColor: ACCENT,
  },
  trainButtonText: {
    color: BG_CARD,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  // Meta
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  metaText: {
    flex: 1,
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 16,
  },
  // Notice
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: PAD_MD,
    borderRadius: RADIUS_MD,
    backgroundColor: WARNING_LIGHT,
    borderWidth: 1,
    borderColor: WARNING_BORDER,
  },
  noticeText: {
    flex: 1,
    color: WARNING,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 17,
  },
});
