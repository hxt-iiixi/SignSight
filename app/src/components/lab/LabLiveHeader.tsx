import React from "react";
import { View, Text, StyleSheet } from "react-native";
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
  RECORDING,
  INFO,
  INFO_LIGHT,
  INFO_BORDER,
  RADIUS_LG,
  RADIUS_PILL,
  PAD_SM,
  PAD_MD,
  PAD_LG,
} from "./shared/labColors";
import { TYPOGRAPHY } from "../../config/typography";
import type { DetectMode } from "../../ml/streamTypes";

type LabLiveHeaderProps = {
  detectMode: DetectMode;
  cameraPosition: "front" | "back";
  displayLabel: string;
  confidence: number;
  rawLabel: string;
  handedness: string | null;
  hasHand: boolean;
  landmarkCount: number;
  activeModelLabel: string | null;
  trainingMode: "bootstrap" | "full_reviewed";
  activeLetterCount: number;
  totalLetterCount: number;
  // Words mode
  gestureFramesCount?: number;
  gestureFramesTotal?: number;
  isRecording?: boolean;
  wordGraceActive?: boolean;
  // Static word
  isStaticWord?: boolean;
  activeStaticWordCount?: number;
};

function getConfidenceTone(confidence: number) {
  if (confidence >= 0.75) return { color: SUCCESS, bg: SUCCESS_LIGHT, border: SUCCESS_BORDER, label: "High" };
  if (confidence >= 0.5) return { color: WARNING, bg: WARNING_LIGHT, border: WARNING_BORDER, label: "Medium" };
  return { color: TEXT_SECONDARY, bg: "rgba(243,244,246,0.92)", border: BORDER, label: "Low" };
}

function getHandStatus(hasHand: boolean, isRecording?: boolean) {
  if (isRecording) return { color: RECORDING, dotColor: RECORDING, label: "Recording" };
  if (hasHand) return { color: SUCCESS, dotColor: SUCCESS, label: "Hand detected" };
  return { color: TEXT_SECONDARY, dotColor: "#D1D5DB", label: "No hand" };
}

export default function LabLiveHeader({
  detectMode,
  cameraPosition,
  displayLabel,
  confidence,
  rawLabel,
  handedness,
  hasHand,
  activeModelLabel,
  trainingMode,
  activeLetterCount,
  totalLetterCount,
  gestureFramesCount = 0,
  gestureFramesTotal = 12,
  isRecording = false,
  wordGraceActive = false,
  isStaticWord = false,
  activeStaticWordCount = 0,
}: LabLiveHeaderProps) {
  const confTone = getConfidenceTone(confidence);
  const handStatus = getHandStatus(hasHand, isRecording);
  const confPercent = Math.round(confidence * 100);
  const isWords = detectMode === "WORDS";

  return (
    <View style={styles.container}>
      {/* Top row: mode + hand status */}
      <View style={styles.topRow}>
        <View style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            {isWords ? "WORDS" : "LETTERS"} · {cameraPosition.toUpperCase()}
          </Text>
        </View>
        <View style={styles.handStatusIndicator}>
          <View style={[styles.dot, { backgroundColor: handStatus.dotColor }]} />
          <Text style={[styles.handStatusText, { color: handStatus.color }]}>
            {handStatus.label}
          </Text>
        </View>
      </View>

      {/* Main row: prediction + confidence */}
      <View style={styles.mainRow}>
        <View style={styles.predictionWrap}>
          <Text style={styles.predictionLabel} numberOfLines={1}>
            {displayLabel}
          </Text>
          <Text style={styles.rawMeta} numberOfLines={1}>
            Raw: {rawLabel} · Hand: {handedness ?? "—"}
            {isWords && !isStaticWord
              ? ` · Frames: ${gestureFramesCount}/${gestureFramesTotal}`
              : ""}
            {wordGraceActive ? " · Grace" : ""}
          </Text>
        </View>

        <View style={styles.confidenceIndicator}>
          <Text style={[styles.confidenceText, { color: confTone.color }]}>
            {confPercent}%
          </Text>
          <Text style={styles.confidenceMetaText}>CONF</Text>
        </View>
      </View>

      {/* Bottom row: model info */}
      <View style={styles.bottomRow}>
        <Text style={styles.modelText} numberOfLines={1}>
          {isWords
            ? isStaticWord
              ? `Landmark model${activeModelLabel ? ` · ${activeModelLabel}` : ""} · ${activeStaticWordCount} static words`
              : isRecording
                ? `Recording · ${gestureFramesCount}/${gestureFramesTotal} frames`
                : `Gesture buffer · ${gestureFramesCount}/${gestureFramesTotal}`
            : `${activeModelLabel ?? "No model"} · ${trainingMode === "bootstrap" ? "Bootstrap" : "Full reviewed"} · ${activeLetterCount}/${totalLetterCount} active`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PAD_LG,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeIndicator: {
    paddingVertical: 2,
  },
  modeText: {
    color: ACCENT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    letterSpacing: 1.2,
  },
  handStatusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 6,
  },
  handStatusText: {
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
    letterSpacing: 0.2,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  predictionWrap: {
    flex: 1,
    gap: 2,
  },
  predictionLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_2XL,
    letterSpacing: -0.2,
  },
  rawMeta: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  confidenceIndicator: {
    alignItems: "flex-end",
    gap: 0,
  },
  confidenceText: {
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_LG,
    lineHeight: 22,
  },
  confidenceMetaText: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    letterSpacing: 0.5,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modelText: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
});
