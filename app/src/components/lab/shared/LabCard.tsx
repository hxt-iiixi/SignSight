import React from "react";
import { View, StyleSheet, Platform, type ViewStyle } from "react-native";
import {
  BG_CARD,
  BORDER,
  RADIUS_LG,
  PAD_MD,
  CARD_SHADOW,
  ACCENT_BORDER,
  ACCENT_LIGHT,
  RECORDING_BORDER,
  RECORDING_LIGHT,
  SUCCESS_BORDER,
  SUCCESS_LIGHT,
} from "./labColors";

type CardVariant = "default" | "accent" | "recording" | "success";

type LabCardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  noPadding?: boolean;
};

const VARIANT_MAP: Record<
  CardVariant,
  { bg: string; border: string }
> = {
  default: { bg: BG_CARD, border: BORDER },
  accent: { bg: ACCENT_LIGHT, border: ACCENT_BORDER },
  recording: { bg: RECORDING_LIGHT, border: RECORDING_BORDER },
  success: { bg: SUCCESS_LIGHT, border: SUCCESS_BORDER },
};

export default function LabCard({
  children,
  variant = "default",
  style,
  noPadding = false,
}: LabCardProps) {
  const colors = VARIANT_MAP[variant];
  const platformShadow: ViewStyle =
    Platform.OS === "android"
      ? { elevation: CARD_SHADOW.android.elevation }
      : Platform.OS === "ios"
        ? { ...CARD_SHADOW.ios }
        : {};

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        noPadding && styles.noPadding,
        platformShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    padding: PAD_MD,
    gap: 8,
  },
  noPadding: {
    padding: 0,
  },
});
