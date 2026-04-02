import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TEXT,
  TEXT_SECONDARY,
  ACCENT,
  BORDER,
  BG,
  BG_CARD,
  DANGER,
  DANGER_LIGHT,
  DANGER_BORDER,
  WARNING_LIGHT,
  WARNING_BORDER,
  RADIUS_LG,
  RADIUS_MD,
  PAD_MD,
  PAD_SM,
} from "./shared/labColors";

type LabArchiveModalProps = {
  visible: boolean;
  versionId: string;
  versionLabel: string;
  trainingMode: string;
  activeLetterCount: number;
  trainedAt: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function LabArchiveModal({
  visible,
  versionId,
  versionLabel,
  trainingMode,
  activeLetterCount,
  trainedAt,
  onConfirm,
  onCancel,
}: LabArchiveModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            {/* Warning icon */}
            <View style={styles.iconWrap}>
              <Ionicons name="archive-outline" size={28} color={DANGER} />
            </View>

            {/* Title */}
            <Text style={styles.title}>Archive this model?</Text>

            {/* Description */}
            <Text style={styles.description}>
              This will remove the model version from the active list and move it
              to archived models. You can still view it later, but it cannot be
              used for serving until restored.
            </Text>

            {/* Model info card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{versionLabel}</Text>
              <Text style={styles.infoMeta}>
                {trainingMode} · {activeLetterCount} active letters
              </Text>
              {trainedAt && (
                <Text style={styles.infoMeta}>Trained: {trainedAt}</Text>
              )}
              <Text style={styles.infoId}>ID: {versionId}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.archiveButton,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="archive-outline" size={16} color={DANGER} />
                <Text style={styles.archiveText}>Archive</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    width: "100%",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: BG,
    borderRadius: RADIUS_LG,
    padding: PAD_MD + 6,
    gap: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DANGER_LIGHT,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 18,
    textAlign: "center",
  },
  description: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: BG_CARD,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: PAD_MD,
    gap: 4,
  },
  infoTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 14,
  },
  infoMeta: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 12,
  },
  infoId: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 10,
    marginTop: 2,
    fontFamily: "monospace",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 14,
  },
  archiveButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    backgroundColor: DANGER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveText: {
    color: DANGER,
    fontWeight: "900",
    fontSize: 14,
  },
});
