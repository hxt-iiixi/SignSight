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
  modelSelectable = true,
  modelEmptyStateMessage,
}: {
  prediction: PredictionViewModel;
  mode: TranslatorMode;
  onModeChange: (value: TranslatorMode) => void;
  modelLabel: string;
  modelOptions: Array<{ id: string; label: string; isLatest?: boolean }>;
  onModelSelect: (id: string) => void;
  modelStatusMessage?: string | null;
  modelSelectable?: boolean;
  modelEmptyStateMessage?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

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

            <View style={styles.modelGroup}>
              <Text style={styles.modelLabel}>Model</Text>
              <Pressable
                style={styles.modelSurface}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!modelSelectable) return;
                  setModelPickerOpen((current) => !current);
                }}
              >
                <View style={styles.modelHeader}>
                  <View style={styles.modelHeaderText}>
                    <Text style={styles.modelValue} numberOfLines={1}>
                      {modelLabel || "None"}
                    </Text>
                  </View>
                  {modelSelectable ? (
                    <Ionicons
                      name={modelPickerOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={TEXT_SECONDARY}
                    />
                  ) : null}
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
                          style={styles.modelOption}
                          onPress={() => {
                            onModelSelect(option.id);
                            setModelPickerOpen(false);
                          }}
                        >
                          <View style={styles.modelOptionRow}>
                            <View style={styles.modelTextGroup}>
                              <Text
                                style={[styles.modelOptionText, selected && styles.modelOptionTextSelected]}
                                numberOfLines={1}
                              >
                                {option.label}
                              </Text>
                              {option.isLatest ? (
                                <Text style={styles.latestText}>Latest</Text>
                              ) : null}
                            </View>
                            {selected ? (
                              <Ionicons
                                name="checkmark-sharp"
                                size={16}
                                color="#FFFFFF"
                                style={styles.modelActiveIcon}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}

                {!modelSelectable && modelEmptyStateMessage ? (
                  <Text style={styles.modelEmptyText}>{modelEmptyStateMessage}</Text>
                ) : null}
              </Pressable>
            </View>
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
  modelGroup: {
    gap: 6,
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
  modelOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },
  modelTextGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  modelOptionText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "800",
    flexShrink: 1,
  },
  modelOptionTextSelected: {
    color: "#FFFFFF",
  },
  modelActiveIcon: {
    marginLeft: "auto",
  },
  latestText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginLeft: 2,
  },
  modelEmptyText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    lineHeight: 18,
  },
});
