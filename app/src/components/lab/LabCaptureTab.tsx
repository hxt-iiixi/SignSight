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
  INFO,
  WARNING,
  RECORDING,
  RADIUS_MD,
  RADIUS_LG,
  RADIUS_PILL,
  PAD_SM,
  PAD_MD,
} from "./shared/labColors";
import { TYPOGRAPHY } from "../../config/typography";
import type { DetectMode } from "../../ml/streamTypes";

type LetterSummary = {
  approved: number;
  pending: number;
  rejected: number;
  legacy: number;
  by_hand: { Left: number; Right: number };
  session_total: number;
  session_by_hand: { Left: number; Right: number };
  session_pending: number;
  session_approved: number;
  session_rejected: number;
} | null;

type StaticWordCounts = {
  approved: number;
  pending: number;
  rejected: number;
  legacy: number;
} | null;

type LabCaptureTabProps = {
  detectMode: DetectMode;
  // Letter mode
  selectedLabel: string | null;
  selectedLabelIsActive: boolean;
  selectedLabelIsReady: boolean;
  labelSummary: LetterSummary;
  trainingMode: "bootstrap" | "full_reviewed";
  onSaveLandmark: () => void;
  // Word mode
  selectedWord: string | null;
  selectedWordIsStaticLandmark: boolean;
  staticWordCounts: StaticWordCounts;
  activeStaticWordLabels: string[];
  isRecordingGesture: boolean;
  recordingGestureFramesCount: number;
  liveGestureFramesCount: number;
  gestureFramesTotal: number;
  onToggleRecording: () => void;
  onSaveGesture: () => void;
  onSaveStaticWord: () => void;
  onClearFrames: () => void;
};

export default function LabCaptureTab({
  detectMode,
  selectedLabel,
  selectedLabelIsActive,
  selectedLabelIsReady,
  labelSummary,
  trainingMode,
  onSaveLandmark,
  selectedWord,
  selectedWordIsStaticLandmark,
  staticWordCounts,
  activeStaticWordLabels,
  isRecordingGesture,
  recordingGestureFramesCount,
  liveGestureFramesCount,
  gestureFramesTotal,
  onToggleRecording,
  onSaveGesture,
  onSaveStaticWord,
  onClearFrames,
}: LabCaptureTabProps) {
  const isLetters = detectMode === "LETTERS";
  const isWords = detectMode === "WORDS";
  const target = isLetters ? selectedLabel : selectedWord;

  if (!target) {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyState}>
          <Ionicons name="hand-left-outline" size={36} color={TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>No target selected</Text>
          <Text style={styles.emptyDescription}>
            Select a {isLetters ? "letter" : "word"} target from the session bar
            above to start capturing samples.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── Letters mode ──────────────────────────────────────────
  if (isLetters) {
    const readinessText = selectedLabelIsActive
      ? `${selectedLabel} is active in the serving model.`
      : selectedLabelIsReady
        ? `${selectedLabel} is quota-ready for ${trainingMode === "bootstrap" ? "bootstrap" : "full reviewed"}. Will join the next trained model.`
        : `${selectedLabel} is still in collection. Keep saving samples until it reaches quota.`;

    const readinessTone = selectedLabelIsActive
      ? "success"
      : selectedLabelIsReady
        ? "info"
        : "warning";

    const readinessIcon = selectedLabelIsActive
      ? "checkmark-circle"
      : selectedLabelIsReady
        ? "time"
        : "hourglass";

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Capture action card */}
        <LabCard>
          <View style={styles.captureHeader}>
            <View style={styles.captureHeaderText}>
              <Text style={styles.sectionLabel}>LETTER CAPTURE</Text>
              <Text style={styles.targetTitle}>{selectedLabel}</Text>
            </View>
            <View style={styles.readinessIndicator}>
              <View
                style={[
                  styles.statusDotSmall,
                  {
                    backgroundColor:
                      readinessTone === "success"
                        ? SUCCESS
                        : readinessTone === "info"
                          ? INFO
                          : WARNING,
                  },
                ]}
              />
              <Text
                style={[
                  styles.readinessTextLabel,
                  {
                    color:
                      readinessTone === "success"
                        ? SUCCESS
                        : readinessTone === "info"
                          ? INFO
                          : WARNING,
                  },
                ]}
              >
                {selectedLabelIsActive
                  ? "Active"
                  : selectedLabelIsReady
                    ? "Quota-ready"
                    : "Collecting"}
              </Text>
            </View>
          </View>

          <Text style={styles.readinessDescription}>{readinessText}</Text>

          <Pressable
            onPress={onSaveLandmark}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name="save-outline" size={18} color={ACCENT} />
            <Text style={styles.primaryActionText}>Save Landmark Sample</Text>
          </Pressable>
        </LabCard>

        {/* Dataset status */}
        <LabCard>
          <Text style={styles.sectionLabel}>DATASET STATUS</Text>

          <View style={styles.pillRow}>
            <LabPill
              label="Approved"
              value={String(labelSummary?.approved ?? 0)}
              tone="success"
              compact
            />
            <LabPill
              label="Pending"
              value={String(labelSummary?.pending ?? 0)}
              tone="warning"
              compact
            />
            <LabPill
              label="Session"
              value={String(labelSummary?.session_total ?? 0)}
              tone="accent"
              compact
            />
          </View>

          <View style={styles.pillRow}>
            <LabPill
              label="Left"
              value={String(labelSummary?.by_hand.Left ?? 0)}
              compact
            />
            <LabPill
              label="Right"
              value={String(labelSummary?.by_hand.Right ?? 0)}
              compact
            />
          </View>

          {/* Readiness insight */}
          <View style={styles.insightRow}>
            <Ionicons name="bulb-outline" size={14} color={ACCENT} />
            <Text style={styles.insightText}>
              {selectedLabelIsActive
                ? "Already active. Additional samples improve diversity."
                : selectedLabelIsReady
                  ? `Ready for next ${trainingMode === "bootstrap" ? "bootstrap" : "full reviewed"} retrain.`
                  : "Keep collecting samples to reach the training quota."}
            </Text>
          </View>
        </LabCard>

        {/* Save policy note */}
        <View style={styles.noteRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={SUCCESS} />
          <Text style={styles.noteText}>
            Lab captures save as approved and count toward training immediately.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── Words mode: Static word ───────────────────────────────
  if (isWords && selectedWordIsStaticLandmark) {
    const isActive = activeStaticWordLabels.includes(selectedWord!);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LabCard>
          <View style={styles.captureHeader}>
            <View style={styles.captureHeaderText}>
              <Text style={styles.sectionLabel}>STATIC WORD CAPTURE</Text>
              <Text style={styles.targetTitle}>{selectedWord}</Text>
            </View>
            <View style={styles.readinessIndicator}>
              <View
                style={[
                  styles.statusDotSmall,
                  { backgroundColor: isActive ? SUCCESS : INFO },
                ]}
              />
              <Text
                style={[
                  styles.readinessTextLabel,
                  { color: isActive ? SUCCESS : INFO },
                ]}
              >
                {isActive ? "Active" : "Static Word"}
              </Text>
            </View>
          </View>

          <Text style={styles.readinessDescription}>
            {isActive
              ? "This word is active in the landmark model. Save more samples to improve accuracy."
              : "This word uses landmark recognition. Save samples, then retrain the main landmark model."}
          </Text>

          <View style={styles.pillRow}>
            <LabPill
              label="Approved"
              value={String(staticWordCounts?.approved ?? 0)}
              tone="success"
              compact
            />
            <LabPill
              label="Pending"
              value={String(staticWordCounts?.pending ?? 0)}
              compact
            />
            <LabPill
              label="Model"
              value={isActive ? "Active" : "Fallback"}
              tone={isActive ? "success" : "info"}
              compact
            />
          </View>

          <Pressable
            onPress={onSaveStaticWord}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name="save-outline" size={18} color={ACCENT} />
            <Text style={styles.primaryActionText}>
              Save Static Word Landmark
            </Text>
          </Pressable>
        </LabCard>
      </ScrollView>
    );
  }

  // ── Words mode: Gesture ───────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <LabCard variant={isRecordingGesture ? "recording" : "default"}>
        <View style={styles.captureHeader}>
          <View style={styles.captureHeaderText}>
            <Text style={styles.sectionLabel}>GESTURE CAPTURE</Text>
            <Text style={styles.targetTitle}>{selectedWord}</Text>
          </View>
          {isRecordingGesture && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>REC</Text>
            </View>
          )}
        </View>

        <Text style={styles.readinessDescription}>
          {isRecordingGesture
            ? "Move through the full gesture, then stop recording before saving."
            : "Start recording to collect a fresh gesture sequence."}
        </Text>

        <View style={styles.pillRow}>
          <LabPill
            label="Live"
            value={`${liveGestureFramesCount}/${gestureFramesTotal}`}
            compact
          />
          <LabPill
            label="Recorded"
            value={`${recordingGestureFramesCount}/${gestureFramesTotal}`}
            tone={isRecordingGesture ? "danger" : "neutral"}
            compact
          />
          <LabPill
            label="State"
            value={isRecordingGesture ? "Recording" : "Idle"}
            tone={isRecordingGesture ? "danger" : "neutral"}
            compact
          />
        </View>
      </LabCard>

      {/* Recording controls */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={onToggleRecording}
          style={({ pressed }) => [
            isRecordingGesture ? styles.stopButton : styles.recordButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name={isRecordingGesture ? "stop-circle" : "radio-button-on"}
            size={16}
            color={isRecordingGesture ? RECORDING : ACCENT}
          />
          <Text
            style={[
              styles.actionButtonText,
              { color: isRecordingGesture ? RECORDING : ACCENT },
            ]}
          >
            {isRecordingGesture ? "Stop Recording" : "Start Recording"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onSaveGesture}
          style={({ pressed }) => [
            styles.primaryAction,
            { flex: 1 },
            pressed && { opacity: 0.88 },
          ]}
        >
          <Ionicons name="save-outline" size={16} color={ACCENT} />
          <Text style={styles.primaryActionText}>Save</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onClearFrames}
        style={({ pressed }) => [
          styles.secondaryAction,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="trash-outline" size={14} color={TEXT_SECONDARY} />
        <Text style={styles.secondaryActionText}>Clear All Frames</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: PAD_MD,
    gap: 12,
    paddingBottom: 24,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_MD,
  },
  emptyDescription: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 260,
  },
  // Capture header
  captureHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  captureHeaderText: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  targetTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_XL,
  },
  // Readiness
  readinessIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 6,
  },
  readinessTextLabel: {
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readinessDescription: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 17,
  },
  // Pills
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  // Insight
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 4,
  },
  insightText: {
    flex: 1,
    color: ACCENT,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 17,
  },
  // Note
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    color: SUCCESS,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 16,
  },
  // Actions
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS_MD,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  primaryActionText: {
    color: ACCENT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  recordButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS_MD,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  stopButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS_MD,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.30)",
  },
  actionButtonText: {
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
  },
  secondaryActionText: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  // Recording
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS_PILL,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.30)",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RECORDING,
  },
  recordingText: {
    color: RECORDING,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    letterSpacing: 0.8,
  },
});
