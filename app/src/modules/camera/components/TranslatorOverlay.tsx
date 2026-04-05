import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ACCENT,
  BORDER_LIGHT,
  RADIUS_LG,
  RADIUS_MD,
  TEXT_SECONDARY,
} from "../../../components/lab/shared/labColors";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import type { PredictionViewModel } from "../../../shared/types/mobile";

type TranslatorMode = "letters" | "words";

export function TranslatorOverlay({
  prediction,
  mode,
  onModeChange,
  modelLabel,
  modelOptions,
  onModelSelect,
  modelStatusMessage,
}: {
  prediction: PredictionViewModel;
  mode: TranslatorMode;
  onModeChange: (value: TranslatorMode) => void;
  modelLabel: string;
  modelOptions: Array<{ id: string; label: string }>;
  onModelSelect: (id: string) => void;
  modelStatusMessage?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const helperText = prediction.hasHand
    ? null
    : mode === "letters"
      ? "No hand detected."
      : "No hand detected.";

  return (
    <View style={styles.container}>
      <Pressable style={styles.card} onPress={() => setExpanded((current) => !current)}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.label}>{prediction.hasHand ? prediction.label : "No hand"}</Text>
            <Text style={styles.meta}>
              {Math.round(prediction.confidence * 100)}% confidence
            </Text>
          </View>
          <View style={styles.chevronBadge}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        </View>

        {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

        {modelStatusMessage ? (
          <Text style={styles.statusText}>{modelStatusMessage}</Text>
        ) : null}

        {expanded ? (
          <>
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeButton, mode === "letters" && styles.modeButtonActive]}
                onPress={(event) => {
                  event.stopPropagation();
                  onModeChange("letters");
                }}
              >
                <Text
                  style={[styles.modeButtonText, mode === "letters" && styles.modeButtonTextActive]}
                >
                  Letters
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === "words" && styles.modeButtonActive]}
                onPress={(event) => {
                  event.stopPropagation();
                  onModeChange("words");
                }}
              >
                <Text
                  style={[styles.modeButtonText, mode === "words" && styles.modeButtonTextActive]}
                >
                  Words
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.modelSurface}
              onPress={(event) => {
                event.stopPropagation();
                setModelPickerOpen((current) => !current);
              }}
            >
              <View style={styles.modelHeader}>
                <View style={styles.modelHeaderText}>
                  <Text style={styles.modelLabel}>Model</Text>
                  <Text style={styles.modelValue} numberOfLines={1}>
                    {modelLabel || "None"}
                  </Text>
                </View>
                <Ionicons
                  name={modelPickerOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={TEXT_SECONDARY}
                />
              </View>

              {modelPickerOpen && modelOptions.length ? (
                <ScrollView
                  style={styles.modelList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {modelOptions.map((option) => {
                    const selected = option.label === modelLabel;
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.modelOption, selected && styles.modelOptionSelected]}
                        onPress={() => {
                          onModelSelect(option.id);
                          setModelPickerOpen(false);
                        }}
                      >
                        <Text
                          style={[styles.modelOptionText, selected && styles.modelOptionTextSelected]}
                          numberOfLines={1}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </Pressable>
          </>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.SPACE_MD,
    right: SPACING.SPACE_MD,
    bottom: SPACING.SPACE_3XL,
  },
  card: {
    borderRadius: RADIUS_LG,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(31, 30, 26, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    gap: SPACING.SPACE_XS,
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
    letterSpacing: -0.6,
  },
  meta: {
    color: "rgba(255,255,255,0.78)",
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "700",
  },
  helperText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    lineHeight: 18,
  },
  statusText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
  },
  chevronBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 3,
    gap: 3,
  },
  modeButton: {
    flex: 1,
    borderRadius: RADIUS_MD - 4,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  modelSurface: {
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    gap: SPACING.SPACE_XS,
  },
  modelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  modelHeaderText: {
    flex: 1,
    gap: 2,
  },
  modelLabel: {
    color: "rgba(255,255,255,0.54)",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  modelValue: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "800",
  },
  modelList: {
    maxHeight: 176,
    gap: SPACING.SPACE_XS,
  },
  modelOption: {
    borderRadius: RADIUS_MD - 2,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  modelOptionSelected: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modelOptionText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "800",
  },
  modelOptionTextSelected: {
    color: "#FFFFFF",
  },
});
