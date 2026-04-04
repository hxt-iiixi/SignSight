import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_LIGHT,
  BG_CARD,
  BG_MUTED,
  BG,
  BORDER,
  BORDER_LIGHT,
  DANGER,
  DANGER_BORDER,
  DANGER_LIGHT,
  INFO,
  INFO_BORDER,
  INFO_LIGHT,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_PILL,
  SUCCESS,
  SUCCESS_BORDER,
  SUCCESS_LIGHT,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  WARNING,
  WARNING_BORDER,
  WARNING_LIGHT,
} from "../../../components/lab/shared/labColors";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import { CameraTopBar } from "../../../modules/camera/components/CameraTopBar";

export type TrainingModeValue = "bootstrap" | "full_reviewed";

export type ModelManagementItem = {
  id: string;
  versionId: string;
  label: string;
  detail?: string;
  rawInfo?: any;
  trainedAt?: string | null;
  trainingMode: TrainingModeValue;
  isActive: boolean;
  isArchived: boolean;
  accuracy?: number | null;
  archivedAt?: string | null;
  activeStaticLetters: string[];
  activeStaticWordLabels: string[];
  readyStaticLetters: string[];
  readyStaticWordLabels: string[];
  unreadyStaticLetters: string[];
  deficitsByLabel: Record<string, string[]>;
  trainingSampleCounts: Record<string, number>;
  quotasUsed?: Record<string, any> | null;
};

type ActionState = "idle" | "running";

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatModeLabel(mode: TrainingModeValue) {
  return mode === "full_reviewed" ? "Full Reviewed" : "Bootstrap";
}

function formatAccuracy(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "No accuracy recorded";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function summarizeCoverage(model?: ModelManagementItem | null) {
  if (!model) return "No active model";
  const letters = model.activeStaticLetters.length;
  const words = model.activeStaticWordLabels.length;
  if (letters > 0 && words > 0) return `${letters} letters, ${words} words`;
  if (letters > 0) return `${letters} letters active`;
  if (words > 0) return `${words} words active`;
  return "No label coverage recorded";
}

function readinessSummary(model?: ModelManagementItem | null) {
  if (!model) {
    return {
      title: "System readiness unavailable",
      tone: "neutral" as const,
      body: "Load a model version to inspect training readiness.",
    };
  }
  const sampleTotal = Object.values(model.trainingSampleCounts || {}).reduce(
    (sum, count) => sum + Number(count || 0),
    0
  );
  const readyLetters = model.readyStaticLetters.length;
  const unreadyLetters = model.unreadyStaticLetters.length;

  if (readyLetters > 0 && unreadyLetters === 0) {
    return {
      title: "System readiness strong",
      tone: "success" as const,
      body: `${sampleTotal} approved samples support ${readyLetters} ready letters with no current deficits.`,
    };
  }
  if (readyLetters > 0) {
    return {
      title: "System readiness partial",
      tone: "info" as const,
      body: `${sampleTotal} approved samples detected. ${readyLetters} ready letters, ${unreadyLetters} still below quota.`,
    };
  }
  return {
    title: "System readiness limited",
    tone: "warning" as const,
    body: `${sampleTotal} approved samples detected. More reviewed data is needed before a broad retrain.`,
  };
}

function InsetDivider() {
  return <View style={styles.insetDivider} />;
}

export function ModelsTabScreen({
  models,
  activeModel,
  loading,
  error,
  trainingMode,
  onTrainingModeChange,
  onTrain,
  trainingState,
  trainingMessage,
  showArchived,
  onToggleArchived,
  archivingModelId,
  renamingModelId,
  onArchiveModel,
  onRenameModel,
}: {
  models: ModelManagementItem[];
  activeModel: ModelManagementItem | null;
  loading: boolean;
  error: string | null;
  trainingMode: TrainingModeValue;
  onTrainingModeChange: (value: TrainingModeValue) => void;
  onTrain: () => void;
  trainingState: ActionState;
  trainingMessage: string | null;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivingModelId: string | null;
  renamingModelId: string | null;
  onArchiveModel: (modelId: string) => void;
  onRenameModel: (modelId: string, nextLabel: string) => void;
}) {
  const navigation = useNavigation<any>();
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [menuModelId, setMenuModelId] = useState<string | null>(null);
  const [showReadinessInfo, setShowReadinessInfo] = useState(false);

  const activeModels = useMemo(() => models.filter((model) => !model.isArchived), [models]);
  const archivedModels = useMemo(() => models.filter((model) => model.isArchived), [models]);
  const readiness = readinessSummary(activeModel);
  const statusBarInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const topBarTop = Math.max(10, statusBarInset + 4);
  const topPadding = 18;
  const hasReadinessInfo = useMemo(() => {
    if (!activeModel || !readiness.body?.trim()) {
      return false;
    }
    return Object.values(activeModel.trainingSampleCounts || {}).some(
      (count) => Number(count || 0) > 0
    );
  }, [activeModel, readiness.body]);

  useEffect(() => {
    if (!showReadinessInfo || !hasReadinessInfo) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setShowReadinessInfo(false);
    }, 2400);
    return () => clearTimeout(timeoutId);
  }, [showReadinessInfo, hasReadinessInfo]);

  useEffect(() => {
    if (!hasReadinessInfo && showReadinessInfo) {
      setShowReadinessInfo(false);
    }
  }, [hasReadinessInfo, showReadinessInfo]);

  return (
    <View style={styles.screen}>
      <CameraTopBar
        canToggleTorch={false}
        horizontalPadding={topPadding}
        onBack={() => navigation.goBack()}
        onFlipCamera={() => {}}
        onToggleTorch={() => {}}
        showFlipCamera={false}
        showTorch={false}
        title="Models"
        top={topBarTop}
        torchEnabled={false}
        variant="light"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="hardware-chip-outline" size={16} color={ACCENT} />
            <Text style={styles.sectionTitle}>Training Center</Text>
          </View>
          <View style={styles.headerUtilities}>
            {hasReadinessInfo ? (
              <Pressable
                style={styles.infoIconButton}
                onPress={() => setShowReadinessInfo(true)}
              >
                <Ionicons name="help-circle-outline" size={21} color={TEXT_SECONDARY} />
              </Pressable>
            ) : null}
            {loading ? <ActivityIndicator size="small" color={ACCENT} /> : null}
          </View>
        </View>

        {showReadinessInfo && hasReadinessInfo ? (
          <View
            pointerEvents="none"
            style={[
              styles.readinessMessage,
              styles.readinessFloatingOverlay,
              readiness.tone === "success"
                ? styles.readinessMessageSuccess
                : readiness.tone === "warning"
                  ? styles.readinessMessageWarning
                  : styles.readinessMessageInfo,
            ]}
          >
            <View style={styles.readinessMessageRow}>
              <Ionicons
                name={
                  readiness.tone === "success"
                    ? "checkmark-circle-outline"
                    : readiness.tone === "warning"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                }
                size={16}
                color={
                  readiness.tone === "success"
                    ? SUCCESS
                    : readiness.tone === "warning"
                      ? WARNING
                      : INFO
                }
              />
              <View style={styles.readinessMessageText}>
                <Text style={styles.readinessTitle}>{readiness.title}</Text>
                <Text style={styles.readinessBody}>{readiness.body}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionBody}>
          <View style={styles.modeCard}>
            {(["bootstrap", "full_reviewed"] as TrainingModeValue[]).map((option) => {
              const selected = trainingMode === option;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.modeRow,
                    option === "full_reviewed" && styles.modeRowDivider,
                  ]}
                  onPress={() => onTrainingModeChange(option)}
                >
                  <View style={styles.modeRowText}>
                    <Text style={styles.segmentedTitle}>
                      {option === "bootstrap"
                        ? "Bootstrap Model"
                        : "Full Reviewed Model"}
                    </Text>
                    <Text
                      style={styles.segmentedCaption}
                    >
                      {option === "bootstrap"
                        ? "Accelerated synthetic priming"
                        : "Validate against human labels"}
                    </Text>
                  </View>
                  <View style={[styles.modeIndicator, selected && styles.modeIndicatorActive]}>
                    {selected ? <View style={styles.modeIndicatorDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {trainingMessage ? (
            <Text
              style={[
                styles.feedbackText,
                trainingState === "running" ? styles.feedbackInfo : styles.feedbackNeutral,
              ]}
            >
              {trainingMessage}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              trainingState === "running" && styles.primaryButtonDisabled,
            ]}
            onPress={onTrain}
            disabled={trainingState === "running"}
          >
            <Text style={styles.primaryButtonText}>
              {trainingState === "running"
                ? "Training New Model..."
                : trainingMode === "bootstrap"
                  ? "Train Bootstrap Model"
                  : "Train Full Model"}
            </Text>
          </Pressable>
        </View>
      </View>

      <InsetDivider />

      <View style={styles.section}>
        <View style={[styles.sectionHeader, styles.sectionHeaderStack]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="layers-outline" size={16} color={ACCENT} />
            <Text style={styles.sectionTitle}>Model Versions</Text>
          </View>
          <Pressable style={styles.archivedToggleInline} onPress={onToggleArchived}>
            <Ionicons
              name={showArchived ? "eye-off-outline" : "eye-outline"}
              size={16}
              color={TEXT_SECONDARY}
            />
            <Text style={styles.archivedToggleText}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionBody}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {activeModels.map((model) => {
          const expanded = expandedModelId === model.id;
          const renameValue = renameDrafts[model.id] ?? model.label;
          const archiveBusy = archivingModelId === model.id;
          const renameBusy = renamingModelId === model.id;
          const menuOpen = menuModelId === model.id;
          const statusLabel = model.isActive ? "Active" : "Candidate";

            return (
            <View key={model.id} style={styles.versionCard}>
              <View style={styles.versionTopRow}>
                <View style={styles.versionTitleWrap}>
                  <Text style={styles.versionTitle}>{model.label}</Text>
                  <Text style={styles.versionSubtitle}>
                    {formatModeLabel(model.trainingMode)} · {statusLabel}
                  </Text>
                </View>
                <View style={styles.menuWrap}>
                  <Pressable
                    style={styles.menuTrigger}
                    onPress={() => setMenuModelId(menuOpen ? null : model.id)}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color={TEXT_SECONDARY} />
                  </Pressable>

                      {menuOpen ? (
                        <View style={styles.menuPanel}>
                          <Pressable
                            style={styles.menuItem}
                            onPress={() => {
                              setExpandedModelId(expanded ? null : model.id);
                              setMenuModelId(null);
                            }}
                          >
                            <View style={styles.menuItemRow}>
                              <Ionicons name="search-outline" size={16} color={TEXT} />
                              <Text style={styles.menuItemText}>
                                {expanded ? "Hide details" : "Inspect"}
                              </Text>
                            </View>
                          </Pressable>
                          <Pressable
                            style={[styles.menuItem, styles.menuItemDanger]}
                            disabled={archiveBusy}
                            onPress={() => {
                              setMenuModelId(null);
                              onArchiveModel(model.id);
                            }}
                          >
                            <View style={styles.menuItemRow}>
                              <Ionicons name="archive-outline" size={16} color={DANGER} />
                              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                                {archiveBusy ? "Archiving..." : "Archive"}
                              </Text>
                            </View>
                          </Pressable>
                        </View>
                      ) : null}
                </View>
              </View>

              {expanded ? (
                <View style={styles.inspectPanel}>
                  <View style={styles.inspectGrid}>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Version ID</Text>
                      <Text style={styles.inspectValue}>{model.versionId}</Text>
                    </View>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Accuracy</Text>
                      <Text style={styles.inspectValue}>{formatAccuracy(model.accuracy)}</Text>
                    </View>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Trained</Text>
                      <Text style={styles.inspectValue}>{formatDate(model.trainedAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.renameRow}>
                    <TextInput
                      value={renameValue}
                      onChangeText={(value) =>
                        setRenameDrafts((current) => ({ ...current, [model.id]: value }))
                      }
                      placeholder="Model label"
                      style={styles.renameInput}
                      placeholderTextColor={TEXT_TERTIARY}
                    />
                    <Pressable
                      style={[styles.renameButton, renameBusy && styles.renameButtonDisabled]}
                      disabled={renameBusy || !renameValue.trim() || renameValue.trim() === model.label}
                      onPress={() => onRenameModel(model.id, renameValue.trim())}
                    >
                      <Text style={styles.renameButtonText}>
                        {renameBusy ? "Saving..." : "Rename"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.inspectGrid}>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Ready letters</Text>
                      <Text style={styles.inspectValue}>
                        {model.readyStaticLetters.length
                          ? model.readyStaticLetters.join(", ")
                          : "None"}
                      </Text>
                    </View>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Unready letters</Text>
                      <Text style={styles.inspectValue}>
                        {model.unreadyStaticLetters.length
                          ? model.unreadyStaticLetters.join(", ")
                          : "None"}
                      </Text>
                    </View>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Word labels</Text>
                      <Text style={styles.inspectValue}>
                        {model.activeStaticWordLabels.length
                          ? model.activeStaticWordLabels.join(", ")
                          : "None"}
                      </Text>
                    </View>
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Quota target</Text>
                      <Text style={styles.inspectValue}>
                        {String(
                          model.quotasUsed?.min_approved_per_hand ??
                            model.quotasUsed?.min_approved_samples_per_label ??
                            "—"
                        )}
                      </Text>
                    </View>
                  </View>

                  {Object.keys(model.trainingSampleCounts).length ? (
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Sample counts</Text>
                      <Text style={styles.inspectValue}>
                        {Object.entries(model.trainingSampleCounts)
                          .slice(0, 10)
                          .map(([label, count]) => `${label}:${count}`)
                          .join(" · ")}
                      </Text>
                    </View>
                  ) : null}

                  {Object.keys(model.deficitsByLabel).length ? (
                    <View style={styles.inspectBlock}>
                      <Text style={styles.inspectLabel}>Deficits</Text>
                      <Text style={styles.inspectValue}>
                        {Object.entries(model.deficitsByLabel)
                          .slice(0, 6)
                          .map(([label, deficits]) => `${label} (${deficits.length})`)
                          .join(" · ")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            );
          })}

          {showArchived && archivedModels.length ? (
            <View style={styles.archivedSection}>
              <InsetDivider />
              <Text style={styles.archivedTitle}>Archived Models</Text>
              {archivedModels.map((model) => {
              const expanded = expandedModelId === model.id;
              const menuOpen = menuModelId === model.id;
                return (
                <View key={model.id} style={[styles.versionCard, styles.archivedCard]}>
                  <View style={styles.versionTopRow}>
                    <View style={styles.versionTitleWrap}>
                      <Text style={styles.versionTitle}>{model.label}</Text>
                      <Text style={styles.versionSubtitle}>
                        {formatModeLabel(model.trainingMode)} · Archived
                      </Text>
                    </View>
                    <View style={styles.menuWrap}>
                      <Pressable
                        style={styles.menuTrigger}
                        onPress={() => setMenuModelId(menuOpen ? null : model.id)}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color={TEXT_SECONDARY} />
                      </Pressable>

                      {menuOpen ? (
                        <View style={styles.menuPanel}>
                          <Pressable
                            style={styles.menuItem}
                            onPress={() => {
                              setExpandedModelId(expanded ? null : model.id);
                              setMenuModelId(null);
                            }}
                          >
                            <View style={styles.menuItemRow}>
                              <Ionicons name="search-outline" size={16} color={TEXT} />
                              <Text style={styles.menuItemText}>
                                {expanded ? "Hide details" : "Inspect"}
                              </Text>
                            </View>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {expanded ? (
                    <View style={styles.inspectPanel}>
                      <View style={styles.inspectGrid}>
                        <View style={styles.inspectBlock}>
                          <Text style={styles.inspectLabel}>Version ID</Text>
                          <Text style={styles.inspectValue}>{model.versionId}</Text>
                        </View>
                        <View style={styles.inspectBlock}>
                          <Text style={styles.inspectLabel}>Accuracy</Text>
                          <Text style={styles.inspectValue}>{formatAccuracy(model.accuracy)}</Text>
                        </View>
                        <View style={styles.inspectBlock}>
                          <Text style={styles.inspectLabel}>Trained</Text>
                          <Text style={styles.inspectValue}>{formatDate(model.trainedAt)}</Text>
                        </View>
                        <View style={styles.inspectBlock}>
                          <Text style={styles.inspectLabel}>Archived</Text>
                          <Text style={styles.inspectValue}>{formatDate(model.archivedAt)}</Text>
                        </View>
                      </View>

                      <View style={styles.inspectBlock}>
                        <Text style={styles.inspectLabel}>Ready letters</Text>
                        <Text style={styles.inspectValue}>
                          {model.readyStaticLetters.length
                            ? model.readyStaticLetters.join(", ")
                            : "None"}
                        </Text>
                      </View>
                      <View style={styles.inspectBlock}>
                        <Text style={styles.inspectLabel}>Sample counts</Text>
                        <Text style={styles.inspectValue}>
                          {Object.entries(model.trainingSampleCounts)
                            .slice(0, 10)
                            .map(([label, count]) => `${label}:${count}`)
                            .join(" · ") || "None"}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.SPACE_MD,
    paddingTop: SPACING.SPACE_3XL + 44,
    paddingBottom: SPACING.SPACE_XL,
    gap: SPACING.SPACE_LG,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerUtilities: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  sectionHeaderStack: {
    alignItems: "flex-start",
    gap: 2,
  },
  section: {
    gap: SPACING.SPACE_XS,
    position: "relative",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_XL,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionBody: {
    gap: SPACING.SPACE_SM,
  },
  insetDivider: {
    height: 1,
    marginHorizontal: 0,
    backgroundColor: BORDER,
  },
  modeCard: {
    backgroundColor: BG_CARD,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    overflow: "hidden",
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.SPACE_MD,
    gap: SPACING.SPACE_SM,
  },
  modeRowDivider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  modeRowText: {
    flex: 1,
    gap: 4,
  },
  segmentedTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
  },
  segmentedCaption: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
  },
  modeIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG_CARD,
  },
  modeIndicatorActive: {
    borderColor: ACCENT,
    backgroundColor: "rgba(230,110,25,0.10)",
  },
  modeIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  readinessMessage: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: 10,
  },
  readinessFloatingOverlay: {
    position: "absolute",
    top: 26,
    right: 0,
    maxWidth: 260,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  infoIconButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  readinessMessageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.SPACE_XS,
  },
  readinessMessageText: {
    flex: 1,
    gap: 2,
  },
  readinessMessageSuccess: {
    backgroundColor: SUCCESS_LIGHT,
    borderColor: SUCCESS_BORDER,
  },
  readinessMessageWarning: {
    backgroundColor: WARNING_LIGHT,
    borderColor: WARNING_BORDER,
  },
  readinessMessageInfo: {
    backgroundColor: INFO_LIGHT,
    borderColor: INFO_BORDER,
  },
  archivedToggleInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 22,
  },
  archivedToggleText: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "800",
  },
  readinessTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "900",
  },
  readinessBody: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 20,
    fontWeight: "600",
  },
  feedbackText: {
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
  },
  feedbackInfo: {
    color: TEXT_SECONDARY,
  },
  feedbackNeutral: {
    color: TEXT_SECONDARY,
  },
  primaryButton: {
    borderRadius: RADIUS_MD,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "900",
  },
  errorText: {
    color: DANGER,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
  versionCard: {
    backgroundColor: BG_CARD,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingVertical: SPACING.SPACE_SM,
    paddingHorizontal: SPACING.SPACE_SM,
    gap: SPACING.SPACE_SM,
    marginTop: 2,
  },
  archivedCard: {
    backgroundColor: "#FCFCFC",
  },
  versionTopRow: {
    flexDirection: "row",
    gap: SPACING.SPACE_SM,
    alignItems: "flex-start",
  },
  versionTitleWrap: {
    flex: 1,
    gap: 3,
  },
  versionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
  },
  versionSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "600",
  },
  menuWrap: {
    position: "relative",
  },
  menuTrigger: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuPanel: {
    position: "absolute",
    top: 34,
    right: 0,
    minWidth: 138,
    borderRadius: RADIUS_MD,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingVertical: 6,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  menuItem: {
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: 10,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginTop: 4,
    paddingTop: 12,
  },
  menuItemText: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
  menuItemTextDanger: {
    color: DANGER,
  },
  inspectPanel: {
    gap: SPACING.SPACE_SM,
    paddingTop: SPACING.SPACE_XS,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  renameRow: {
    flexDirection: "row",
    gap: SPACING.SPACE_SM,
    alignItems: "center",
  },
  renameInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    paddingHorizontal: SPACING.SPACE_SM,
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
  renameButton: {
    borderRadius: RADIUS_MD,
    backgroundColor: ACCENT,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: 12,
  },
  renameButtonDisabled: {
    opacity: 0.7,
  },
  renameButtonText: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "900",
  },
  inspectGrid: {
    gap: SPACING.SPACE_SM,
  },
  inspectBlock: {
    borderRadius: RADIUS_MD,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    padding: SPACING.SPACE_SM,
    gap: 4,
  },
  inspectLabel: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inspectValue: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_XS,
    lineHeight: 18,
    fontWeight: "700",
  },
  archivedSection: {
    marginTop: SPACING.SPACE_MD,
    gap: SPACING.SPACE_SM,
  },
  archivedTitle: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
