import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import type { PredictionViewModel } from "../../../shared/types/mobile";

export function RecognitionOverlay({
  prediction,
  bottomOffset = SPACING.SPACE_3XL,
  topOffset,
  collapsible = false,
  defaultExpanded = false,
  targetLabel,
  targetOptions,
  onTargetSelect,
  modeValue,
  onModeChange,
  modelLabel,
  modelOptions,
  onModelSelect,
  signerId,
  onSignerIdChange,
  variantTag,
  onVariantTagChange,
}: {
  prediction: PredictionViewModel;
  bottomOffset?: number;
  topOffset?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  targetLabel?: string;
  targetOptions?: string[];
  onTargetSelect?: (value: string) => void;
  modeValue?: "letters" | "words";
  onModeChange?: (value: "letters" | "words") => void;
  modelLabel?: string;
  modelOptions?: Array<{ id: string; label: string }>;
  onModelSelect?: (id: string) => void;
  signerId?: string;
  onSignerIdChange?: (value: string) => void;
  variantTag?: string;
  onVariantTagChange?: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [openPicker, setOpenPicker] = useState<"target" | "model" | null>(null);
  const showDetails = !collapsible || expanded;
  const showMetadataInputs =
    (!collapsible || expanded) && (onSignerIdChange != null || onVariantTagChange != null);

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
          <Pressable
            style={styles.detailChip}
            onPress={(event) => {
              event.stopPropagation();
              setOpenPicker((current) => (current === "target" ? null : "target"));
            }}
          >
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailHeaderText}>
                <Text style={styles.detailLabel}>Target</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {targetLabel ?? "None"}
                </Text>
              </View>
              <Ionicons
                name={openPicker === "target" ? "chevron-up" : "chevron-down"}
                size={18}
                color="rgba(255,255,255,0.9)"
              />
            </View>

            {openPicker === "target" && targetOptions?.length ? (
              <View style={styles.optionWrap}>
                {targetOptions.map((option) => {
                  const selected = option === targetLabel;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                      onPress={(event) => {
                        event.stopPropagation();
                        onTargetSelect?.(option);
                        setOpenPicker(null);
                      }}
                    >
                      <Text
                        style={[styles.optionText, selected && styles.optionTextSelected]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Pressable>

          <View style={styles.detailChip}>
            <Text style={styles.detailLabel}>Mode</Text>
            <View style={styles.modeToggle}>
              <Pressable
                style={[
                  styles.modeButton,
                  modeValue === "letters" && styles.modeButtonActive,
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  onModeChange?.("letters");
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    modeValue === "letters" && styles.modeButtonTextActive,
                  ]}
                >
                  Letters
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  modeValue === "words" && styles.modeButtonActive,
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  onModeChange?.("words");
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    modeValue === "words" && styles.modeButtonTextActive,
                  ]}
                >
                  Words
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={styles.detailChip}
            onPress={(event) => {
              event.stopPropagation();
              setOpenPicker((current) => (current === "model" ? null : "model"));
            }}
          >
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailHeaderText}>
                <Text style={styles.detailLabel}>Model</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {modelLabel ?? "None"}
                </Text>
              </View>
              <Ionicons
                name={openPicker === "model" ? "chevron-up" : "chevron-down"}
                size={18}
                color="rgba(255,255,255,0.9)"
              />
            </View>

            {openPicker === "model" && modelOptions?.length ? (
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
                      onPress={(event) => {
                        event.stopPropagation();
                        onModelSelect?.(option.id);
                        setOpenPicker(null);
                      }}
                    >
                      <Text
                        style={[styles.modelOptionText, selected && styles.optionTextSelected]}
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
        </View>
      ) : null}

      {showMetadataInputs ? (
        <View style={styles.metadataSection}>
          {onSignerIdChange ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Signer ID</Text>
              <TextInput
                value={signerId ?? ""}
                onChangeText={onSignerIdChange}
                placeholder="person_01"
                placeholderTextColor="rgba(255,255,255,0.38)"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : null}

          {onVariantTagChange ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Variant Tag</Text>
              <TextInput
                value={variantTag ?? ""}
                onChangeText={onVariantTagChange}
                placeholder="low_light"
                placeholderTextColor="rgba(255,255,255,0.38)"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : null}
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
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  detailHeaderText: {
    flex: 1,
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
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SPACE_XS,
    marginTop: SPACING.SPACE_SM,
  },
  optionChip: {
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  optionChipSelected: {
    backgroundColor: "rgba(230,110,25,0.24)",
    borderColor: "rgba(230,110,25,0.48)",
  },
  optionText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },
  modeToggle: {
    marginTop: SPACING.SPACE_SM,
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "rgba(230,110,25,0.24)",
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  modelList: {
    marginTop: SPACING.SPACE_SM,
    maxHeight: 180,
  },
  modelOption: {
    borderRadius: 10,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
  },
  modelOptionSelected: {
    backgroundColor: "rgba(230,110,25,0.18)",
  },
  modelOptionText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
  metadataSection: {
    marginTop: SPACING.SPACE_SM,
    gap: SPACING.SPACE_SM,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
});
