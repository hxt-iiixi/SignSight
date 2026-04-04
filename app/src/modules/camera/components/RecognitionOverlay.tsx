import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ACCENT,
  BORDER_LIGHT,
  TEXT_SECONDARY,
  RADIUS_LG,
  RADIUS_MD,
} from "../../../components/lab/shared/labColors";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import type { PredictionViewModel } from "../../../shared/types/mobile";

type SaveState = "idle" | "saving" | "success" | "error" | "info";

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
  quotaLabel,
  saveState = "idle",
  saveMessage,
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
  quotaLabel?: string;
  saveState?: SaveState;
  saveMessage?: string | null;
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
  const compactTarget = targetLabel ?? "None";
  const compactHand = prediction.hasHand ? prediction.handedness ?? "Unknown" : "No hand";
  const compactMeta = `${Math.round(prediction.confidence * 100)}% | ${compactTarget} | ${compactHand} | ${quotaLabel ?? "—"}`;

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
          <Text style={styles.meta}>{quotaLabel ? compactMeta : `${Math.round(prediction.confidence * 100)}% confidence`}</Text>
          {saveMessage ? (
            <Text
              style={[
                styles.statusText,
                saveState === "error"
                  ? styles.statusError
                  : saveState === "success"
                    ? styles.statusSuccess
                    : styles.statusInfo,
              ]}
            >
              {saveMessage}
            </Text>
          ) : null}
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

          <Pressable
            style={styles.surfaceCard}
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
                color={TEXT_SECONDARY}
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

          <Pressable
            style={styles.surfaceCard}
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
                color={TEXT_SECONDARY}
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
        <View style={styles.metadataRow}>
          {onSignerIdChange ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Signer ID</Text>
              <TextInput
                value={signerId ?? ""}
                onChangeText={onSignerIdChange}
                placeholder="person_01"
                placeholderTextColor={TEXT_SECONDARY}
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
                placeholderTextColor={TEXT_SECONDARY}
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
    borderRadius: RADIUS_LG,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_MD,
    backgroundColor: "rgba(31, 30, 26, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    marginTop: SPACING.SPACE_XXS,
    color: "rgba(255,255,255,0.78)",
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "700",
  },
  statusText: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
  },
  statusSuccess: {
    color: "#8CE6A4",
  },
  statusError: {
    color: "#FCA5A5",
  },
  statusInfo: {
    color: "rgba(255,255,255,0.76)",
  },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  detailsGrid: {
    marginTop: SPACING.SPACE_SM,
    gap: SPACING.SPACE_SM,
  },
  surfaceCard: {
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    color: "rgba(255,255,255,0.58)",
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  optionChipSelected: {
    backgroundColor: "rgba(230,110,25,0.16)",
    borderColor: "rgba(230,110,25,0.22)",
  },
  optionText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 2,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.72)",
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
    borderRadius: 12,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
  },
  modelOptionSelected: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modelOptionText: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
  metadataRow: {
    marginTop: SPACING.SPACE_SM,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SPACE_SM,
  },
  inputGroup: {
    flex: 1,
    minWidth: 150,
    gap: 6,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: SPACING.SPACE_SM,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
});
