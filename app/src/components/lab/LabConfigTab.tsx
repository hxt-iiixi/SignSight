import React from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LabCard from "./shared/LabCard";
import LabCollapsible from "./shared/LabCollapsible";
import {
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  ACCENT,
  BORDER,
  BG_CARD,
  BG_MUTED,
  SUCCESS,
  INFO,
  RADIUS_MD,
  PAD_MD,
} from "./shared/labColors";
import { TYPOGRAPHY } from "../../config/typography";

type LabConfigTabProps = {
  // Metadata
  signerId: string;
  captureSessionId: string;
  variantTagsText: string;
  onSignerIdChange: (text: string) => void;
  onCaptureSessionIdChange: (text: string) => void;
  onVariantTagsChange: (text: string) => void;
  // Diagnostics
  rawLabel: string;
  handedness: string | null;
  fpsCounter: number;
  lmFps: number;
  predictionRate: number;
  wordGraceActive: boolean;
  isOverlaySmoothing: boolean;
  gesturePredictionAgeMs: number | null;
  lastHandAgeMs: number | null;
  // Tracking info
  isSupported: boolean;
};

export default function LabConfigTab({
  signerId,
  captureSessionId,
  variantTagsText,
  onSignerIdChange,
  onCaptureSessionIdChange,
  onVariantTagsChange,
  rawLabel,
  handedness,
  fpsCounter,
  lmFps,
  predictionRate,
  wordGraceActive,
  isOverlaySmoothing,
  gesturePredictionAgeMs,
  lastHandAgeMs,
  isSupported,
}: LabConfigTabProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Capture metadata */}
      <LabCard>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={16} color={ACCENT} />
          <Text style={styles.sectionLabel}>CAPTURE METADATA</Text>
        </View>

        <Text style={styles.description}>
          Metadata is attached to every saved sample for traceability and dataset
          management. Set these once per session.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Signer ID</Text>
          <TextInput
            value={signerId}
            onChangeText={onSignerIdChange}
            style={styles.input}
            placeholder="person_01"
            placeholderTextColor={TEXT_TERTIARY}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldHelper}>
            Identifies who is performing the signs for signer diversity tracking.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Capture Session ID</Text>
          <TextInput
            value={captureSessionId}
            onChangeText={onCaptureSessionIdChange}
            style={styles.input}
            placeholder="2026-04-02_lab"
            placeholderTextColor={TEXT_TERTIARY}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldHelper}>
            Groups samples from a single capture session for batch review.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Variant Tags</Text>
          <TextInput
            value={variantTagsText}
            onChangeText={onVariantTagsChange}
            style={styles.input}
            placeholder="neutral, slight_rotation"
            placeholderTextColor={TEXT_TERTIARY}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldHelper}>
            Comma-separated tags describing hand pose variants (e.g. neutral,
            rotated, angled).
          </Text>
        </View>

        <View style={styles.noticeRow}>
          <Ionicons
            name="shield-checkmark-outline"
            size={14}
            color={SUCCESS}
          />
          <Text style={styles.noticeText}>
            Developer Lab captures save as approved and are included in training
            immediately.
          </Text>
        </View>
      </LabCard>

      {/* Diagnostics */}
      <LabCollapsible
        title="Technical Diagnostics"
        subtitle="Raw output, rates, and timing"
      >
        <View style={styles.diagGrid}>
          <DiagRow label="Raw Label" value={rawLabel} />
          <DiagRow label="Handedness" value={handedness ?? "—"} />
          <DiagRow label="FPS" value={String(fpsCounter)} />
          <DiagRow label="Landmark Rate" value={`${lmFps}/s`} />
          <DiagRow label="Prediction Rate" value={`${predictionRate}/s`} />
          <DiagRow label="Grace" value={wordGraceActive ? "ON" : "OFF"} />
          <DiagRow
            label="Smoothing"
            value={isOverlaySmoothing ? "ON" : "OFF"}
          />
          <DiagRow
            label="Gesture Pred Age"
            value={
              gesturePredictionAgeMs == null
                ? "—"
                : `${gesturePredictionAgeMs}ms`
            }
          />
          <DiagRow
            label="Last Hand Age"
            value={lastHandAgeMs == null ? "—" : `${lastHandAgeMs}ms`}
          />
          <DiagRow
            label="Tracking"
            value={isSupported ? "Supported" : "Unsupported"}
            tone={isSupported ? "success" : "warning"}
          />
        </View>
      </LabCollapsible>
    </ScrollView>
  );
}

function DiagRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const valueColor =
    tone === "success" ? SUCCESS : tone === "warning" ? INFO : TEXT;

  return (
    <View style={styles.diagRow}>
      <Text style={styles.diagLabel}>{label}</Text>
      <Text style={[styles.diagValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: PAD_MD,
    gap: 12,
    paddingBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  // Fields
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_XS,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: RADIUS_MD,
    backgroundColor: BG_CARD,
    color: TEXT,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: TYPOGRAPHY.TEXT_SM,
  },
  fieldHelper: {
    color: TEXT_SECONDARY,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 15,
  },
  // Notice
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 4,
  },
  noticeText: {
    flex: 1,
    color: SUCCESS,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 16,
  },
  // Diagnostics
  diagGrid: {
    gap: 2,
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(229,231,235,0.5)",
  },
  diagLabel: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.TEXT_XS,
  },
  diagValue: {
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontFamily: "monospace",
  },
});
