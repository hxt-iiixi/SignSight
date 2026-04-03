import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";

export function CameraTopBar({
  canToggleTorch,
  horizontalPadding,
  onBack,
  onFlipCamera,
  onToggleTorch,
  title,
  top,
  torchEnabled,
}: {
  canToggleTorch: boolean;
  horizontalPadding: number;
  onBack: () => void;
  onFlipCamera: () => void;
  onToggleTorch: () => void;
  title: string;
  top: number;
  torchEnabled: boolean;
}) {
  return (
    <View style={[styles.topBar, { top, paddingHorizontal: horizontalPadding }]}>
      <View style={styles.topBarContent}>
        <View style={styles.topBarSide}>
          <Pressable onPress={onBack} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={onToggleTorch}
            style={({ pressed }) => [
              styles.iconButton,
              !canToggleTorch && styles.iconButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={torchEnabled ? "flash" : "flash-off"}
              size={24}
              color={torchEnabled ? "#FDE68A" : "#FFFFFF"}
            />
          </Pressable>
        </View>

        <Text style={styles.title}>{title}</Text>

        <View style={[styles.topBarSide, styles.topBarSideRight]}>
          <Pressable
            onPress={onFlipCamera}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBarContent: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarSide: {
    position: "absolute",
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  topBarSideRight: {
    left: undefined,
    right: 0,
  },
  title: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_2XL,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});
