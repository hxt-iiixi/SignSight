import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  TEXT,
  TEXT_SECONDARY,
  BORDER,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  WARNING,
  WARNING_LIGHT,
  WARNING_BORDER,
  PAD_LG,
} from "./shared/labColors";
import { TYPOGRAPHY } from "../../config/typography";
import type { DetectMode } from "../../ml/streamTypes";

type LabLiveHeaderProps = {
  detectMode: DetectMode;
  displayLabel: string;
  confidence: number;
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

export default function LabLiveHeader({
  detectMode,
  displayLabel,
  confidence,
  activeModelLabel,
  trainingMode,
  activeLetterCount,
  totalLetterCount,
  gestureFramesCount = 0,
  gestureFramesTotal = 12,
  isRecording = false,
  isStaticWord = false,
}: LabLiveHeaderProps) {
  const confTone = getConfidenceTone(confidence);
  const confPercent = Math.round(confidence * 100);
  const isWords = detectMode === "WORDS";

  return (
    <View style={styles.container}>
      {/* Main row: prediction + confidence */}
      <View style={styles.mainRow}>
        <View style={styles.predictionWrap}>
          <Text style={styles.predictionLabel} numberOfLines={1}>
            {displayLabel}
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
              ? `Landmark model${activeModelLabel ? ` · ${activeModelLabel}` : ""}`
              : isRecording
                ? `Recording · ${gestureFramesCount}/${gestureFramesTotal} frames`
                : `Gesture buffer · ${gestureFramesCount}/${gestureFramesTotal}`
            : `${activeModelLabel ?? "No model"} · ${trainingMode === "bootstrap" ? "Bootstrap" : "Full reviewed"}`}
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
