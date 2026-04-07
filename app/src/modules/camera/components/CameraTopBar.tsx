import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";

export function CameraTopBar({
  canToggleTorch,
  debugMenuItems,
  horizontalPadding,
  onBack,
  onFlipCamera,
  onToggleTorch,
  showBack = true,
  showFlipCamera = true,
  showTorch = true,
  title,
  top,
  torchEnabled,
  variant = "dark",
}: {
  canToggleTorch: boolean;
  debugMenuItems?: Array<{
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    active?: boolean;
    onPress: () => void;
  }>;
  horizontalPadding: number;
  onBack: () => void;
  onFlipCamera: () => void;
  onToggleTorch: () => void;
  showBack?: boolean;
  showFlipCamera?: boolean;
  showTorch?: boolean;
  title: string;
  top: number;
  torchEnabled: boolean;
  variant?: "dark" | "light";
}) {
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const iconColor = variant === "dark" ? "#FFFFFF" : "#191C1D";
  const titleColor = variant === "dark" ? "#FFFFFF" : "#191C1D";
  const activeAccent = "#F47A22";

  useEffect(() => {
    if (!debugMenuItems?.length) {
      setDebugMenuOpen(false);
    }
  }, [debugMenuItems]);

  return (
    <View style={[styles.topBar, { top, paddingHorizontal: horizontalPadding }]}>
      <View style={styles.topBarContent}>
        <View style={styles.topBarSide}>
          {showBack ? (
            <Pressable onPress={onBack} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={26} color={iconColor} />
            </Pressable>
          ) : null}
          {showTorch ? (
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
                color={torchEnabled && variant === "dark" ? "#FDE68A" : iconColor}
              />
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>

        <View style={[styles.topBarSide, styles.topBarSideRight]}>
          {debugMenuItems?.length ? (
            <View style={styles.debugFabWrap}>
              {debugMenuOpen ? (
                <View style={styles.debugFabMenu}>
                  {debugMenuItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        item.onPress();
                        setDebugMenuOpen(false);
                      }}
                      style={[
                        styles.debugFabItem,
                        item.active && styles.debugFabItemActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={item.active ? activeAccent : iconColor}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={() => setDebugMenuOpen((current) => !current)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name="bug-outline"
                  size={22}
                  color={debugMenuOpen ? activeAccent : iconColor}
                />
              </Pressable>
            </View>
          ) : null}
          {showFlipCamera ? (
            <Pressable
              onPress={onFlipCamera}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="camera-reverse-outline" size={24} color={iconColor} />
            </Pressable>
          ) : null}
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
  debugFabWrap: {
    position: "relative",
  },
  debugFabMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    gap: 8,
    alignItems: "center",
  },
  debugFabItem: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  debugFabItemActive: {
    borderColor: "rgba(244,122,34,0.45)",
    backgroundColor: "rgba(244,122,34,0.12)",
  },
});
