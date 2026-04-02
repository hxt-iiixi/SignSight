import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LabCard from "./shared/LabCard";
import LabCollapsible from "./shared/LabCollapsible";
import {
  TEXT,
  TEXT_SECONDARY,
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_BORDER,
  BORDER,
  BG_CARD,
  BG_MUTED,
  SUCCESS,
  SUCCESS_LIGHT,
  SUCCESS_BORDER,
  DANGER,
  DANGER_LIGHT,
  DANGER_BORDER,
  INFO,
  INFO_LIGHT,
  INFO_BORDER,
  RADIUS_MD,
  RADIUS_LG,
  RADIUS_PILL,
  PAD_SM,
  PAD_MD,
} from "./shared/labColors";

type LandmarkModelVersion = {
  version_id: string;
  label?: string;
  training_mode?: "bootstrap" | "full_reviewed";
  trained_at?: string;
  is_active?: boolean;
  active_static_letters?: string[];
  archived_at?: string;
  active_static_word_labels?: string[];
};

type ModelRenameDrafts = Record<string, string>;

type LabModelsTabProps = {
  activeModelVersionId: string | null;
  availableVersions: LandmarkModelVersion[];
  archivedVersions: LandmarkModelVersion[];
  renameDrafts: ModelRenameDrafts;
  onActivate: (versionId: string) => void;
  onRename: (versionId: string) => void;
  onArchive: (versionId: string) => void;
  onRenameDraftChange: (versionId: string, text: string) => void;
};

function ModelVersionCard({
  version,
  isActive,
  renameDraft,
  onActivate,
  onRename,
  onArchive,
  onRenameDraftChange,
}: {
  version: LandmarkModelVersion;
  isActive: boolean;
  renameDraft: string;
  onActivate: () => void;
  onRename: () => void;
  onArchive: () => void;
  onRenameDraftChange: (text: string) => void;
}) {
  const versionId = String(version.version_id);
  const mode =
    version.training_mode === "bootstrap" ? "Bootstrap" : "Full reviewed";
  const letterCount = Array.isArray(version.active_static_letters)
    ? version.active_static_letters.length
    : 0;

  return (
    <LabCard variant={isActive ? "success" : "default"}>
      <View style={styles.versionHeader}>
        <View style={styles.versionTitleWrap}>
          <Text style={styles.versionLabel}>
            {String(version.label ?? versionId)}
          </Text>
          {isActive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.versionMetaRow}>
        <Text style={styles.versionMeta}>{mode}</Text>
        <View style={styles.metaDot} />
        <Text style={styles.versionMeta}>{letterCount} letters</Text>
        {version.trained_at && (
          <>
            <View style={styles.metaDot} />
            <Text style={styles.versionMeta}>{version.trained_at}</Text>
          </>
        )}
      </View>

      {/* Rename field */}
      <View style={styles.renameRow}>
        <TextInput
          value={renameDraft}
          onChangeText={onRenameDraftChange}
          placeholder="Rename version"
          placeholderTextColor={TEXT_SECONDARY}
          style={styles.renameInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={onRename}
          style={({ pressed }) => [
            styles.renameButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.renameButtonText}>Rename</Text>
        </Pressable>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {!isActive && (
          <Pressable
            onPress={onActivate}
            style={({ pressed }) => [
              styles.activateButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="swap-horizontal" size={14} color={ACCENT} />
            <Text style={styles.activateText}>Activate</Text>
          </Pressable>
        )}
        {isActive && (
          <View style={styles.servingIndicator}>
            <Ionicons name="checkmark-circle" size={14} color={SUCCESS} />
            <Text style={styles.servingText}>Currently serving</Text>
          </View>
        )}
        {!isActive && (
          <Pressable
            onPress={onArchive}
            style={({ pressed }) => [
              styles.archiveButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="archive-outline" size={14} color={DANGER} />
            <Text style={styles.archiveText}>Archive</Text>
          </Pressable>
        )}
      </View>
    </LabCard>
  );
}

export default function LabModelsTab({
  activeModelVersionId,
  availableVersions,
  archivedVersions,
  renameDrafts,
  onActivate,
  onRename,
  onArchive,
  onRenameDraftChange,
}: LabModelsTabProps) {
  const activeVersion = availableVersions.find(
    (v) => String(v.version_id) === activeModelVersionId
  );
  const candidateVersions = availableVersions.filter(
    (v) => String(v.version_id) !== activeModelVersionId
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Empty state */}
      {availableVersions.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={36} color={TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>No model versions</Text>
          <Text style={styles.emptyDescription}>
            Train your first model from the Training tab to create a version.
          </Text>
        </View>
      )}

      {/* Active model */}
      {activeVersion && (
        <>
          <Text style={styles.groupTitle}>Active Model</Text>
          <ModelVersionCard
            version={activeVersion}
            isActive={true}
            renameDraft={
              renameDrafts[String(activeVersion.version_id)] ??
              String(activeVersion.label ?? activeVersion.version_id)
            }
            onActivate={() => {}}
            onRename={() => onRename(String(activeVersion.version_id))}
            onArchive={() => {}}
            onRenameDraftChange={(text) =>
              onRenameDraftChange(String(activeVersion.version_id), text)
            }
          />
        </>
      )}

      {/* Candidate versions */}
      {candidateVersions.length > 0 && (
        <>
          <Text style={styles.groupTitle}>Candidate Versions</Text>
          {candidateVersions.map((version) => {
            const versionId = String(version.version_id);
            return (
              <ModelVersionCard
                key={versionId}
                version={version}
                isActive={false}
                renameDraft={
                  renameDrafts[versionId] ??
                  String(version.label ?? versionId)
                }
                onActivate={() => onActivate(versionId)}
                onRename={() => onRename(versionId)}
                onArchive={() => onArchive(versionId)}
                onRenameDraftChange={(text) =>
                  onRenameDraftChange(versionId, text)
                }
              />
            );
          })}
        </>
      )}

      {/* Archived versions */}
      {archivedVersions.length > 0 && (
        <LabCollapsible
          title="Archived Versions"
          subtitle="Previously active model versions"
          count={archivedVersions.length}
        >
          {archivedVersions.map((version) => {
            const versionId = String(version.version_id);
            const mode =
              version.training_mode === "bootstrap"
                ? "Bootstrap"
                : "Full reviewed";
            const letterCount = Array.isArray(version.active_static_letters)
              ? version.active_static_letters.length
              : 0;

            return (
              <View key={versionId} style={styles.archivedCard}>
                <Text style={styles.archivedLabel}>
                  {String(version.label ?? versionId)}
                </Text>
                <Text style={styles.archivedMeta}>
                  {mode} · {letterCount} letters
                </Text>
                {version.trained_at && (
                  <Text style={styles.archivedMeta}>
                    Trained: {version.trained_at}
                  </Text>
                )}
                {version.archived_at && (
                  <Text style={styles.archivedMeta}>
                    Archived: {version.archived_at}
                  </Text>
                )}
              </View>
            );
          })}
        </LabCollapsible>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: PAD_MD,
    gap: 12,
    paddingBottom: 80,
  },
  groupTitle: {
    color: TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  // Empty
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 16,
  },
  emptyDescription: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 260,
  },
  // Version card
  versionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  versionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  versionLabel: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 15,
    flexShrink: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: RADIUS_PILL,
    backgroundColor: SUCCESS_LIGHT,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SUCCESS,
  },
  liveText: {
    color: SUCCESS,
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  versionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  versionMeta: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 12,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  // Rename
  renameRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: RADIUS_MD,
    backgroundColor: BG_CARD,
    color: TEXT,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  renameButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
  },
  renameButtonText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 12,
  },
  // Actions
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  activateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  activateText: {
    color: ACCENT,
    fontWeight: "900",
    fontSize: 13,
  },
  servingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  servingText: {
    color: SUCCESS,
    fontWeight: "800",
    fontSize: 13,
  },
  archiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS_MD,
    backgroundColor: DANGER_LIGHT,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
  },
  archiveText: {
    color: DANGER,
    fontWeight: "900",
    fontSize: 13,
  },
  // Archived
  archivedCard: {
    padding: PAD_SM,
    borderRadius: RADIUS_MD,
    backgroundColor: BG_MUTED,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 2,
  },
  archivedLabel: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 13,
  },
  archivedMeta: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 11,
  },
});
