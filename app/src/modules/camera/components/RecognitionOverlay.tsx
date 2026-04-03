import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import type { PredictionViewModel } from "../../../shared/types/mobile";

export function RecognitionOverlay({
  prediction,
}: {
  prediction: PredictionViewModel;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{prediction.hasHand ? prediction.label : "No hand"}</Text>
      <Text style={styles.meta}>
        {Math.round(prediction.confidence * 100)}% confidence
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.SPACE_MD,
    right: SPACING.SPACE_MD,
    bottom: SPACING.SPACE_3XL,
    borderRadius: 24,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(0,0,0,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  label: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_3XL,
    fontWeight: "900",
  },
  meta: {
    marginTop: SPACING.SPACE_XXS,
    color: "rgba(255,255,255,0.9)",
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "700",
  },
});
