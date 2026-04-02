import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TEXT,
  TEXT_SECONDARY,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  BORDER,
  BG_CARD,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  INFO,
  INFO_LIGHT,
  INFO_BORDER,
  WARNING,
  WARNING_LIGHT,
  WARNING_BORDER,
  RADIUS_MD,
  RADIUS_PILL,
  PAD_SM,
  PAD_MD,
  PAD_LG,
} from "./shared/labColors";
import type { DetectMode } from "../../ml/streamTypes";

type LabSessionBarProps = {
  detectMode: DetectMode;
  cameraPosition: "front" | "back";
  selectedTarget: string | null;
  targetIsActive: boolean;
  targetIsReady: boolean;
  isStaticWord: boolean;
  isGesture: boolean;
  isRecordingGesture: boolean;
  onToggleMode: () => void;
  onToggleCamera: () => void;
  onOpenTargetSelector: () => void;
};

function getTargetReadiness(
  target: string | null,
  isActive: boolean,
  isReady: boolean,
  isStaticWord: boolean,
  isGesture: boolean
) {
  if (!target)
    return { label: "No target", color: TEXT_SECONDARY, bg: "rgba(243,244,246,0.92)", border: BORDER };
  if (isStaticWord)
    return { label: "Static word", color: INFO, bg: INFO_LIGHT, border: INFO_BORDER };
  if (isGesture)
    return { label: "Gesture", color: ACCENT, bg: ACCENT_LIGHT, border: ACCENT_BORDER };
  if (isActive)
    return { label: "Active", color: SUCCESS, bg: SUCCESS_LIGHT, border: SUCCESS_BORDER };
  if (isReady)
    return { label: "Quota-ready", color: INFO, bg: INFO_LIGHT, border: INFO_BORDER };
  return { label: "Collecting", color: WARNING, bg: WARNING_LIGHT, border: WARNING_BORDER };
}

export default function LabSessionBar({
  detectMode,
  cameraPosition,
  selectedTarget,
  targetIsActive,
  targetIsReady,
  isStaticWord,
  isGesture,
  isRecordingGesture,
  onToggleMode,
  onToggleCamera,
  onOpenTargetSelector,
}: LabSessionBarProps) {
  const readiness = getTargetReadiness(
    selectedTarget,
    targetIsActive,
    targetIsReady,
    isStaticWord,
    isGesture
  );

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <Pressable
        onPress={onToggleMode}
        disabled={isRecordingGesture}
        style={({ pressed }) => [
          styles.actionItem,
          pressed && { opacity: 0.7 },
          isRecordingGesture && styles.disabled,
        ]}
      >
        <Ionicons
          name={detectMode === "LETTERS" ? "text" : "chatbubble-ellipses"}
          size={14}
          color={ACCENT}
        />
        <Text style={styles.actionText}>
          {detectMode === "LETTERS" ? "Letters" : "Words"}
        </Text>
      </Pressable>

      <View style={styles.separator} />

      {/* Camera toggle */}
      <Pressable
        onPress={onToggleCamera}
        style={({ pressed }) => [
          styles.actionItem,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="camera-reverse-outline" size={14} color={TEXT_SECONDARY} />
        <Text style={styles.actionTextSecondary}>
          {cameraPosition === "front" ? "Front" : "Back"}
        </Text>
      </Pressable>

      <View style={styles.separator} />

      {/* Target display + readiness */}
      <Pressable
        onPress={onOpenTargetSelector}
        style={({ pressed }) => [
          styles.targetItem,
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.targetTextWrap}>
          <Text style={styles.targetLabel} numberOfLines={1}>
            {selectedTarget ?? "Select Target"}
          </Text>
          <View style={styles.readinessIndicator}>
            <View style={[styles.statusDot, { backgroundColor: readiness.color }]} />
            <Text style={[styles.readinessText, { color: readiness.color }]}>
              {readiness.label}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PAD_LG,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingRight: 4,
  },
  actionText: {
    color: ACCENT,
    fontWeight: "900",
    fontSize: 12,
  },
  actionTextSecondary: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: 12,
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginHorizontal: 10,
  },
  targetItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 6,
  },
  targetTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  targetLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  readinessIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 4,
  },
  readinessText: {
    fontWeight: "800",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.4,
  },
});
