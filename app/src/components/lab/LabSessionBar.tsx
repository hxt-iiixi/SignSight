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
          styles.modeButton,
          pressed && { opacity: 0.85 },
          isRecordingGesture && styles.disabled,
        ]}
      >
        <Ionicons
          name={detectMode === "LETTERS" ? "text" : "chatbubble-ellipses"}
          size={14}
          color={ACCENT}
        />
        <Text style={styles.modeButtonText}>
          {detectMode === "LETTERS" ? "Letters" : "Words"}
        </Text>
      </Pressable>

      {/* Camera toggle */}
      <Pressable
        onPress={onToggleCamera}
        style={({ pressed }) => [
          styles.cameraButton,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="camera-reverse-outline" size={14} color={TEXT} />
        <Text style={styles.cameraButtonText}>
          {cameraPosition === "front" ? "Front" : "Back"}
        </Text>
      </Pressable>

      {/* Target display + readiness */}
      <Pressable
        onPress={onOpenTargetSelector}
        style={({ pressed }) => [
          styles.targetButton,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.targetTextWrap}>
          <Text style={styles.targetLabel} numberOfLines={1}>
            {selectedTarget ?? "Select"}
          </Text>
          <View
            style={[
              styles.readinessBadge,
              { backgroundColor: readiness.bg, borderColor: readiness.border },
            ]}
          >
            <Text
              style={[styles.readinessText, { color: readiness.color }]}
            >
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
    gap: 8,
    paddingHorizontal: PAD_LG,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  modeButtonText: {
    color: ACCENT,
    fontWeight: "900",
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderWidth: 0,
  },
  cameraButtonText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 12,
  },
  targetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderWidth: 0,
  },
  targetTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  targetLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  readinessBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS_PILL,
    borderWidth: 1,
  },
  readinessText: {
    fontWeight: "800",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
