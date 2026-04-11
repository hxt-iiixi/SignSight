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
import { API_BASE } from "../../../config/api";

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
import { LabPageHeader } from "./LabPageHeader";

export type TrainingModeValue = "bootstrap" | "full_reviewed";

export type ModelManagementItem = {
  id: string;
  versionId: string;
  label: string;
  note?: string | null;
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

type GestureHealthResponse = {
  ok?: boolean;
  trained_gestures?: boolean;
  trained_gestures_legacy?: boolean;
  trained_gestures_v2?: boolean;
  gesture_labels?: string[];
  gesture_total?: number;
  gesture_v2_total?: number;
  gesture_unique_signers?: number;
  gesture_counts?: Record<
    string,
    {
      approved?: number;
      pending?: number;
      rejected?: number;
      legacy?: number;
      signer_count?: number;
      v2_sequences?: number;
    }
  >;
};

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inspectRow}>
      <Text style={styles.inspectLabel}>{label}</Text>
      <Text style={styles.inspectValue}>{value}</Text>
    </View>
  );
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
  trainingLabel,
  onTrainingLabelChange,
  trainingNote,
  onTrainingNoteChange,
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
  trainingLabel: string;
  onTrainingLabelChange: (value: string) => void;
  trainingNote: string;
  onTrainingNoteChange: (value: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivingModelId: string | null;
  renamingModelId: string | null;
  onArchiveModel: (modelId: string) => void;
  onRenameModel: (modelId: string, nextLabel: string) => void;
}) {
  const navigation = useNavigation<any>();
  const handleBack = () => {
    navigation.getParent()?.goBack?.();
  };
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [menuModelId, setMenuModelId] = useState<string | null>(null);
  const [inlineRenameModelId, setInlineRenameModelId] = useState<string | null>(null);
  const [showReadinessInfo, setShowReadinessInfo] = useState(false);
  const [gestureHealth, setGestureHealth] = useState<GestureHealthResponse | null>(null);
  const [gestureLoading, setGestureLoading] = useState(false);
  const [gestureMessage, setGestureMessage] = useState<string | null>(null);
  const [gestureTrainingState, setGestureTrainingState] = useState<ActionState>("idle");

  const activeModels = useMemo(() => models.filter((model) => !model.isArchived), [models]);
  const archivedModels = useMemo(() => models.filter((model) => model.isArchived), [models]);
  const readiness = readinessSummary(activeModel);
  const hasReadinessInfo = useMemo(() => {
    if (!activeModel || !readiness.body?.trim()) {
      return false;
    }
    return Object.values(activeModel.trainingSampleCounts || {}).some(
      (count) => Number(count || 0) > 0
    );
  }, [activeModel, readiness.body]);
  const gestureCoverage = useMemo(() => {
    const counts = gestureHealth?.gesture_counts || {};
    const labels = Object.entries(counts)
      .map(([label, stats]) => ({
        label,
        approved: Number(stats.approved || 0),
        v2Sequences: Number(stats.v2_sequences || 0),
      }))
      .filter((item) => item.approved > 0 || item.v2Sequences > 0)
      .sort((a, b) => {
        if (a.approved !== b.approved) return b.approved - a.approved;
        if (a.v2Sequences !== b.v2Sequences) return b.v2Sequences - a.v2Sequences;
        return a.label.localeCompare(b.label);
      });

    return {
      labels,
      topSummary: labels
        .slice(0, 6)
        .map((item) => `${item.label}:${item.approved}`)
        .join(" · "),
    };
  }, [gestureHealth]);

  async function fetchGestureHealth() {
    try {
      setGestureLoading(true);
      const response = await fetch(`${API_BASE}/health`);
      const payload = (await response.json()) as GestureHealthResponse;
      if (!response.ok || payload?.ok === false) {
        setGestureMessage("Failed to load gesture model status.");
        return;
      }
      setGestureHealth(payload);
      setGestureMessage(null);
    } catch (error) {
      console.log("Failed to load gesture health", error);
      setGestureMessage("Failed to load gesture model status.");
    } finally {
      setGestureLoading(false);
    }
  }

  async function handleTrainGestureModel() {
    try {
      setGestureTrainingState("running");
      setGestureMessage("Training gesture model...");
      const response = await fetch(`${API_BASE}/train_gestures`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        setGestureMessage(payload?.error ?? "Gesture training failed.");
        return;
      }
      const schemaLabel =
        payload?.schema === "gesture_v2"
          ? "Gesture V2"
          : payload?.schema === "legacy"
            ? "Legacy gesture"
            : "Gesture";
      const accuracy =
        typeof payload?.accuracy === "number"
          ? `${(payload.accuracy * 100).toFixed(1)}%`
          : "completed";
      setGestureMessage(`${schemaLabel} training finished. Holdout accuracy ${accuracy}.`);
      await fetchGestureHealth();
    } catch (error) {
      console.log("Failed to train gesture model", error);
      setGestureMessage("Gesture training failed.");
    } finally {
      setGestureTrainingState("idle");
    }
  }

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

  useEffect(() => {
    void fetchGestureHealth();
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.pageHeaderWrap}>
        <LabPageHeader
          title="Models"
          onBack={handleBack}
          horizontalPadding={19}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="hardware-chip-outline" size={15} color={ACCENT} />
            <Text style={styles.sectionTitle}>Landmark Training</Text>
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

          <View style={styles.trainingFields}>
            <View style={styles.trainingInputGroup}>
              <Text style={styles.trainingInputLabel}>
                Model label <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                value={trainingLabel}
                onChangeText={onTrainingLabelChange}
                placeholder={
                  trainingMode === "bootstrap"
                    ? "Bootstrap model label"
                    : "Full model label"
                }
                placeholderTextColor={TEXT_TERTIARY}
                style={styles.trainingInput}
              />
            </View>

            <View style={styles.trainingInputGroup}>
              <Text style={styles.trainingInputLabel}>
                Model note <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                value={trainingNote}
                onChangeText={onTrainingNoteChange}
                placeholder="What is this model intended for?"
                placeholderTextColor={TEXT_TERTIARY}
                style={[styles.trainingInput, styles.trainingNoteInput]}
                multiline
                textAlignVertical="top"
              />
            </View>
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
              (trainingState === "running" ||
                !trainingLabel.trim() ||
                !trainingNote.trim()) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={onTrain}
            disabled={trainingState === "running" || !trainingLabel.trim() || !trainingNote.trim()}
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
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="git-branch-outline" size={15} color={ACCENT} />
            <Text style={styles.sectionTitle}>Gesture</Text>
          </View>
          {gestureLoading ? <ActivityIndicator size="small" color={ACCENT} /> : null}
        </View>

        <View style={styles.sectionBody}>
          <View style={styles.gestureSummaryGrid}>
            <View style={styles.gestureMetric}>
              <Text style={styles.gestureMetricLabel}>Model</Text>
              <Text style={styles.gestureMetricValue}>
                {gestureHealth?.trained_gestures_v2
                  ? "Gesture V2"
                  : gestureHealth?.trained_gestures_legacy
                    ? "Legacy"
                    : "Not trained"}
              </Text>
            </View>
            <View style={styles.gestureMetric}>
              <Text style={styles.gestureMetricLabel}>Reviewed sequences</Text>
              <Text style={styles.gestureMetricValue}>
                {String(gestureHealth?.gesture_total ?? 0)}
              </Text>
            </View>
            <View style={styles.gestureMetric}>
              <Text style={styles.gestureMetricLabel}>V2 sequences</Text>
              <Text style={styles.gestureMetricValue}>
                {String(gestureHealth?.gesture_v2_total ?? 0)}
              </Text>
            </View>
            <View style={styles.gestureMetric}>
              <Text style={styles.gestureMetricLabel}>Signers</Text>
              <Text style={styles.gestureMetricValue}>
                {String(gestureHealth?.gesture_unique_signers ?? 0)}
              </Text>
            </View>
          </View>

          <View style={styles.gestureInfoBlock}>
            <Text style={styles.gestureInfoTitle}>Gesture coverage</Text>
            <Text style={styles.gestureInfoBody}>
              {gestureCoverage.topSummary || "No reviewed gesture labels yet."}
            </Text>
          </View>

          {gestureMessage ? (
            <Text
              style={[
                styles.feedbackText,
                gestureTrainingState === "running" ? styles.feedbackInfo : styles.feedbackNeutral,
              ]}
            >
              {gestureMessage}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              (gestureTrainingState === "running" || (gestureHealth?.gesture_total ?? 0) <= 0) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={() => {
              void handleTrainGestureModel();
            }}
            disabled={gestureTrainingState === "running" || (gestureHealth?.gesture_total ?? 0) <= 0}
          >
            <Text style={styles.primaryButtonText}>
              {gestureTrainingState === "running" ? "Training Gesture..." : "Train Gesture Model"}
            </Text>
          </Pressable>
        </View>
      </View>

      <InsetDivider />

      <View style={styles.section}>
          <View style={[styles.sectionHeader, styles.sectionHeaderStack]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="layers-outline" size={15} color={ACCENT} />
            <Text style={styles.sectionTitle}>Landmark Versions</Text>
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

          {activeModels.map((model, index) => {
          const expanded = expandedModelId === model.id;
          const renameValue = renameDrafts[model.id] ?? model.label;
          const archiveBusy = archivingModelId === model.id;
          const renameBusy = renamingModelId === model.id;
          const menuOpen = menuModelId === model.id;
          const renameOpen = inlineRenameModelId === model.id;
          const statusLabel = "Candidate";
          const isLatestModel = index === 0;
          const menuOpenUpward = index >= Math.max(0, activeModels.length - 2);

            return (
            <View key={model.id} style={styles.versionCard}>
              <View style={styles.versionTopRow}>
                <View style={styles.versionTitleWrap}>
                  <View style={styles.versionTitleRow}>
                  {renameOpen ? (
                    <View style={styles.inlineRenameTitleRow}>
                      <TextInput
                        value={renameValue}
                        onChangeText={(value) =>
                          setRenameDrafts((current) => ({ ...current, [model.id]: value }))
                        }
                        placeholder="Model label"
                        style={[
                          styles.inlineRenameTitleInput,
                          {
                            width: Math.max(84, Math.min(220, renameValue.length * 11)),
                          },
                        ]}
                        placeholderTextColor={TEXT_TERTIARY}
                      />
                      <Pressable
                        style={styles.inlineRenameConfirm}
                        disabled={
                          renameBusy ||
                          !renameValue.trim() ||
                          renameValue.trim() === model.label
                        }
                        onPress={() => {
                          void onRenameModel(model.id, renameValue.trim());
                          setInlineRenameModelId(null);
                        }}
                      >
                        <Ionicons
                          name={renameBusy ? "hourglass-outline" : "checkmark-sharp"}
                          size={22}
                          color={ACCENT}
                        />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.versionTitle}>{model.label}</Text>
                  )}
                  {isLatestModel ? (
                    <Text style={styles.latestTagText}>Latest</Text>
                  ) : null}
                  </View>
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
                        <View style={[styles.menuPanel, menuOpenUpward && styles.menuPanelUpward]}>
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
                            style={[styles.menuItem, styles.menuItemDivider]}
                            onPress={() => {
                              setInlineRenameModelId(renameOpen ? null : model.id);
                              setMenuModelId(null);
                            }}
                          >
                            <View style={styles.menuItemRow}>
                              <Ionicons name="pencil-outline" size={16} color={TEXT} />
                              <Text style={styles.menuItemText}>
                                {renameOpen ? "Cancel rename" : "Rename"}
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
                  <View style={styles.inspectSection}>
                    <DetailRow label="Version ID" value={model.versionId} />
                    <InsetDivider />
                    <DetailRow label="Accuracy" value={formatAccuracy(model.accuracy)} />
                    <InsetDivider />
                    <DetailRow label="Trained" value={formatDate(model.trainedAt)} />
                  </View>

                  <InsetDivider />
                  <View style={styles.inspectSection}>
                    <Text style={styles.inspectLabel}>Note</Text>
                    <Text style={styles.inspectValue}>{model.note?.trim() || "N/A"}</Text>
                  </View>

                  <InsetDivider />
                  <View style={styles.inspectSection}>
                    <DetailRow
                      label="Ready letters"
                      value={
                        model.readyStaticLetters.length
                          ? model.readyStaticLetters.join(", ")
                          : "None"
                      }
                    />
                    <InsetDivider />
                    <DetailRow
                      label="Unready letters"
                      value={
                        model.unreadyStaticLetters.length
                          ? model.unreadyStaticLetters.join(", ")
                          : "None"
                      }
                    />
                    <InsetDivider />
                    <DetailRow
                      label="Word labels"
                      value={
                        model.activeStaticWordLabels.length
                          ? model.activeStaticWordLabels.join(", ")
                          : "None"
                      }
                    />
                    <InsetDivider />
                    <DetailRow
                      label="Quota target"
                      value={String(
                        model.quotasUsed?.min_approved_per_hand ??
                          model.quotasUsed?.min_approved_samples_per_label ??
                          "—"
                      )}
                    />
                  </View>

                  {Object.keys(model.trainingSampleCounts).length ? (
                    <>
                      <InsetDivider />
                      <View style={styles.inspectSection}>
                        <Text style={styles.inspectLabel}>Sample counts</Text>
                        <Text style={styles.inspectValue}>
                          {Object.entries(model.trainingSampleCounts)
                            .slice(0, 10)
                            .map(([label, count]) => `${label}:${count}`)
                            .join(" · ")}
                        </Text>
                      </View>
                    </>
                  ) : null}

                  {Object.keys(model.deficitsByLabel).length ? (
                    <>
                      <InsetDivider />
                      <View style={styles.inspectSection}>
                        <Text style={styles.inspectLabel}>Deficits</Text>
                        <Text style={styles.inspectValue}>
                          {Object.entries(model.deficitsByLabel)
                            .slice(0, 6)
                            .map(([label, deficits]) => `${label} (${deficits.length})`)
                            .join(" · ")}
                        </Text>
                      </View>
                    </>
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
              {archivedModels.map((model, index) => {
              const expanded = expandedModelId === model.id;
              const menuOpen = menuModelId === model.id;
              const menuOpenUpward = index >= Math.max(0, archivedModels.length - 2);
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
                        <View style={[styles.menuPanel, menuOpenUpward && styles.menuPanelUpward]}>
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
                      <View style={styles.inspectSection}>
                        <DetailRow label="Version ID" value={model.versionId} />
                        <InsetDivider />
                        <DetailRow label="Accuracy" value={formatAccuracy(model.accuracy)} />
                        <InsetDivider />
                        <DetailRow label="Trained" value={formatDate(model.trainedAt)} />
                        <InsetDivider />
                        <DetailRow label="Archived" value={formatDate(model.archivedAt)} />
                      </View>

                      <InsetDivider />
                      <View style={styles.inspectSection}>
                        <Text style={styles.inspectLabel}>Note</Text>
                        <Text style={styles.inspectValue}>{model.note?.trim() || "N/A"}</Text>
                      </View>

                      <InsetDivider />
                      <View style={styles.inspectSection}>
                        <DetailRow
                          label="Ready letters"
                          value={
                            model.readyStaticLetters.length
                              ? model.readyStaticLetters.join(", ")
                              : "None"
                          }
                        />
                      </View>
                      <InsetDivider />
                      <View style={styles.inspectSection}>
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
  pageHeaderWrap: {
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 1 : 6,
    paddingHorizontal: 19,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.SPACE_MD,
    paddingTop: SPACING.SPACE_LG,
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
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "900",
    letterSpacing: -0.2,
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
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "800",
  },
  segmentedCaption: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
  },
  trainingFields: {
    gap: SPACING.SPACE_SM,
  },
  trainingInputGroup: {
    gap: 6,
  },
  trainingInputLabel: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
  },
  requiredAsterisk: {
    color: DANGER,
  },
  trainingInput: {
    minHeight: 46,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: 12,
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "600",
  },
  trainingNoteInput: {
    minHeight: 78,
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
  gestureSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SPACE_SM,
  },
  gestureMetric: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    gap: 4,
  },
  gestureMetricLabel: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  gestureMetricValue: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "900",
  },
  gestureInfoBlock: {
    backgroundColor: BG_MUTED,
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    gap: 4,
  },
  gestureInfoTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "800",
  },
  gestureInfoBody: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
    lineHeight: 20,
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
  versionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  versionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
  },
  latestTagText: {
    color: ACCENT,
    fontSize: TYPOGRAPHY.TEXT_XXS,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
  menuPanelUpward: {
    top: undefined,
    bottom: 34,
  },
  menuItem: {
    paddingHorizontal: SPACING.SPACE_SM,
    paddingVertical: 10,
  },
  menuItemDivider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginTop: 4,
    paddingTop: 12,
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
  inspectSection: {
    gap: SPACING.SPACE_XS,
  },
  inspectRow: {
    gap: 4,
  },
  inlineRenameTitleRow: {
    flexDirection: "row",
    gap: SPACING.SPACE_XS,
    alignItems: "center",
  },
  inlineRenameTitleInput: {
    flex: 0,
    minHeight: 32,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
    borderBottomWidth: 1.5,
    borderBottomColor: ACCENT,
  },
  inlineRenameConfirm: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
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
