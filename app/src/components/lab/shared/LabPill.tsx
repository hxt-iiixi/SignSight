import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  TEXT,
  TEXT_SECONDARY,
  BORDER,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  WARNING,
  WARNING_LIGHT,
  WARNING_BORDER,
  DANGER,
  DANGER_LIGHT,
  DANGER_BORDER,
  INFO,
  INFO_LIGHT,
  INFO_BORDER,
  RADIUS_MD,
} from "./labColors";

type PillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

type LabPillProps = {
  label: string;
  value: string;
  tone?: PillTone;
  compact?: boolean;
};

const TONE_MAP: Record<
  PillTone,
  { bg: string; border: string; valueColor: string }
> = {
  neutral: {
    bg: "rgba(243,244,246,0.92)",
    border: BORDER,
    valueColor: TEXT,
  },
  accent: {
    bg: ACCENT_LIGHT,
    border: ACCENT_BORDER,
    valueColor: ACCENT,
  },
  success: {
    bg: SUCCESS_LIGHT,
    border: SUCCESS_BORDER,
    valueColor: SUCCESS,
  },
  warning: {
    bg: WARNING_LIGHT,
    border: WARNING_BORDER,
    valueColor: WARNING,
  },
  danger: {
    bg: DANGER_LIGHT,
    border: DANGER_BORDER,
    valueColor: DANGER,
  },
  info: {
    bg: INFO_LIGHT,
    border: INFO_BORDER,
    valueColor: INFO,
  },
};

export default function LabPill({
  label,
  value,
  tone = "neutral",
  compact = false,
}: LabPillProps) {
  const colors = TONE_MAP[tone];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.bg, borderColor: colors.border },
        compact && styles.pillCompact,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, { color: colors.valueColor }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 88,
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
  },
  pillCompact: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 72,
  },
  label: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontWeight: "900",
    fontSize: 14,
    marginTop: 2,
  },
});
