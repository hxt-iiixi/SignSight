import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import type { PredictionViewModel } from "../../../shared/types/mobile";

export function RecognitionOverlay({
  prediction,
  bottomOffset = SPACING.SPACE_3XL,
  topOffset,
  details,
  collapsible = false,
  defaultExpanded = false,
}: {
  prediction: PredictionViewModel;
  bottomOffset?: number;
  topOffset?: number;
  details?: Array<{ label: string; value: string }>;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showDetails = !!details?.length && (!collapsible || expanded);

  return (
    <Pressable
      style={[
        styles.container,
        topOffset != null ? { top: topOffset } : { bottom: bottomOffset },
      ]}
      onPress={collapsible ? () => setExpanded((current) => !current) : undefined}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.label}>{prediction.hasHand ? prediction.label : "No hand"}</Text>
          <Text style={styles.meta}>
            {Math.round(prediction.confidence * 100)}% confidence
          </Text>
        </View>
        {collapsible ? (
          <View style={styles.chevronBadge}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        ) : null}
      </View>

      {showDetails ? (
        <View style={styles.detailsGrid}>
          {details?.map((item) => (
            <View key={item.label} style={styles.detailChip}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.SPACE_MD,
    right: SPACING.SPACE_MD,
    borderRadius: 24,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(0,0,0,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  headerText: {
    flex: 1,
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
  chevronBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  detailsGrid: {
    marginTop: SPACING.SPACE_SM,
    gap: SPACING.SPACE_SM,
  },
  detailChip: {
    borderRadius: 14,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_XS,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  detailLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    marginTop: 2,
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "800",
  },
});
