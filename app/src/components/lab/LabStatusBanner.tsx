import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TEXT,
  BG_CARD,
  BORDER,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  DANGER,
  DANGER_LIGHT,
  DANGER_BORDER,
  INFO,
  INFO_LIGHT,
  INFO_BORDER,
  WARNING,
  WARNING_LIGHT,
  WARNING_BORDER,
  RECORDING,
  RECORDING_LIGHT,
  RECORDING_BORDER,
  RADIUS_LG,
  PAD_SM,
  PAD_MD,
  ELEVATED_SHADOW,
} from "./shared/labColors";
import { TYPOGRAPHY } from "../../config/typography";

type BannerTone =
  | "success"
  | "error"
  | "info"
  | "recording"
  | "training"
  | "warning";

type LabStatusBannerProps = {
  message: string;
  tone?: BannerTone;
  visible: boolean;
  onDismiss?: () => void;
};

const TONE_MAP: Record<
  BannerTone,
  { bg: string; border: string; text: string; icon: string }
> = {
  success: {
    bg: SUCCESS_LIGHT,
    border: SUCCESS_BORDER,
    text: SUCCESS,
    icon: "checkmark-circle",
  },
  error: {
    bg: DANGER_LIGHT,
    border: DANGER_BORDER,
    text: DANGER,
    icon: "close-circle",
  },
  info: {
    bg: INFO_LIGHT,
    border: INFO_BORDER,
    text: INFO,
    icon: "information-circle",
  },
  recording: {
    bg: RECORDING_LIGHT,
    border: RECORDING_BORDER,
    text: RECORDING,
    icon: "radio-button-on",
  },
  training: {
    bg: WARNING_LIGHT,
    border: WARNING_BORDER,
    text: WARNING,
    icon: "hourglass",
  },
  warning: {
    bg: WARNING_LIGHT,
    border: WARNING_BORDER,
    text: WARNING,
    icon: "alert-circle",
  },
};

export default function LabStatusBanner({
  message,
  tone = "info",
  visible,
  onDismiss,
}: LabStatusBannerProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible && !message) return null;

  const colors = TONE_MAP[tone];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        Platform.select(ELEVATED_SHADOW),
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Ionicons
        name={colors.icon as any}
        size={18}
        color={colors.text}
      />
      <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
        {message}
      </Text>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="close" size={14} color={colors.text} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 28,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: PAD_MD,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
  },
  message: {
    flex: 1,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
  },
});
