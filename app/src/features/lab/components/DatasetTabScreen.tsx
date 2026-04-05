import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { API_BASE } from "../../../config/api";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import {
  ACCENT,
  ACCENT_LIGHT,
  BG,
  BG_CARD,
  BG_MUTED,
  BORDER,
  BORDER_LIGHT,
  INFO,
  INFO_LIGHT,
  SUCCESS,
  SUCCESS_LIGHT,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  WARNING,
  WARNING_LIGHT,
} from "../../../components/lab/shared/labColors";
import { LabPageHeader } from "./LabPageHeader";

type HandCounts = {
  Left: number;
  Right: number;
};

type LabelStats = {
  approved: number;
  pending: number;
  rejected: number;
  legacy: number;
  by_hand: HandCounts;
  signer_count: number;
};

type DatasetHealthResponse = {
  ok?: boolean;
  landmark_total?: number;
  landmark_counts?: Record<string, LabelStats>;
  static_word_landmark_counts?: Record<string, LabelStats>;
  current_landmark_training_mode?: "bootstrap" | "full_reviewed";
  ready_static_letters?: string[];
  unready_static_letters?: string[];
  deficits_by_label?: Record<string, string[]>;
  landmark_unique_signers?: number;
  static_word_unique_signers?: number;
  dataset_unique_signers?: number;
};

type LabelSummaryResponse = {
  ok?: boolean;
  error?: string;
  label?: string;
  approved?: number;
  pending?: number;
  rejected?: number;
  legacy?: number;
  by_hand?: HandCounts;
  session_total?: number;
  session_by_hand?: HandCounts;
  session_pending?: number;
  session_approved?: number;
  session_rejected?: number;
};

type LabelHealthItem = {
  label: string;
  approved: number;
  signerCount: number;
  byHand: HandCounts;
  deficits: string[];
  isReady: boolean;
};

function InsetDivider() {
  return <View style={styles.insetDivider} />;
}

function formatModeLabel(mode?: string) {
  return mode === "full_reviewed" ? "Full Reviewed" : "Bootstrap";
}

function toneForReadiness(readyCount: number, unreadyCount: number) {
  if (readyCount > 0 && unreadyCount === 0) return "strong";
  if (readyCount > 0) return "partial";
  return "limited";
}

function formatBalanceLabel(left: number, right: number) {
  const total = left + right;
  if (total <= 0) return "No approved data yet";
  const diffRatio = Math.abs(left - right) / total;
  if (diffRatio <= 0.15) return "Balanced";
  return left > right ? "Left-heavy" : "Right-heavy";
}

function formatHandSplit(byHand: HandCounts) {
  return `L ${byHand.Left} · R ${byHand.Right}`;
}

function aggregateByHand(source: Record<string, LabelStats> | undefined) {
  const totals: HandCounts = { Left: 0, Right: 0 };
  Object.values(source || {}).forEach((stats) => {
    totals.Left += Number(stats.by_hand?.Left || 0);
    totals.Right += Number(stats.by_hand?.Right || 0);
  });
  return totals;
}

function totalApproved(source: Record<string, LabelStats> | undefined) {
  return Object.values(source || {}).reduce(
    (sum, stats) => sum + Number(stats.approved || 0),
    0
  );
}

function DatasetMetric({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {sublabel ? <Text style={styles.metricSublabel}>{sublabel}</Text> : null}
    </View>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailStat}>
      <Text style={styles.detailStatLabel}>{label}</Text>
      <Text style={styles.detailStatValue}>{value}</Text>
    </View>
  );
}

export function DatasetTabScreen({
  captureSessionId,
  signerId,
}: {
  captureSessionId?: string;
  signerId?: string;
}) {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<DatasetHealthResponse | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const [labelSummaries, setLabelSummaries] = useState<Record<string, LabelSummaryResponse>>({});
  const [summaryLoadingLabel, setSummaryLoadingLabel] = useState<string | null>(null);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/health`);
      const payload = (await response.json()) as DatasetHealthResponse;
      if (!response.ok || payload?.ok === false) {
        setError("Failed to load dataset health.");
        return;
      }
      setHealth(payload);
      setLastRefresh(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } catch (fetchError) {
      console.log("Failed to load dataset health", fetchError);
      setError("Failed to load dataset health.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  const labelItems = useMemo<LabelHealthItem[]>(() => {
    const counts = health?.landmark_counts || {};
    const deficitsByLabel = health?.deficits_by_label || {};
    const readyLabels = new Set(health?.ready_static_letters || []);

    return Object.entries(counts)
      .map(([label, stats]) => ({
        label,
        approved: Number(stats.approved || 0),
        signerCount: Number(stats.signer_count || 0),
        byHand: {
          Left: Number(stats.by_hand?.Left || 0),
          Right: Number(stats.by_hand?.Right || 0),
        },
        deficits: Array.isArray(deficitsByLabel[label]) ? deficitsByLabel[label] : [],
        isReady: readyLabels.has(label),
      }))
      .sort((a, b) => {
        const aDeficit = a.deficits.length > 0 ? 1 : 0;
        const bDeficit = b.deficits.length > 0 ? 1 : 0;
        if (aDeficit !== bDeficit) return bDeficit - aDeficit;
        if (a.deficits.length !== b.deficits.length) return b.deficits.length - a.deficits.length;
        if (a.approved !== b.approved) return a.approved - b.approved;
        return a.label.localeCompare(b.label);
      });
  }, [health]);

  const letterByHand = useMemo(
    () => aggregateByHand(health?.landmark_counts),
    [health?.landmark_counts]
  );
  const wordByHand = useMemo(
    () => aggregateByHand(health?.static_word_landmark_counts),
    [health?.static_word_landmark_counts]
  );

  const snapshot = useMemo(() => {
    const landmarkApproved = totalApproved(health?.landmark_counts);
    const wordApproved = totalApproved(health?.static_word_landmark_counts);
    const signerCount =
      Number(health?.dataset_unique_signers || 0) ||
      Number(health?.landmark_unique_signers || 0) ||
      Number(health?.static_word_unique_signers || 0);
    return {
      landmarkApproved,
      wordApproved,
      signerCount,
      modeLabel: formatModeLabel(health?.current_landmark_training_mode),
    };
  }, [health]);

  const readiness = useMemo(() => {
    const readyCount = (health?.ready_static_letters || []).length;
    const unreadyCount = (health?.unready_static_letters || []).length;
    const topDeficits = Object.entries(health?.deficits_by_label || {})
      .filter(([, deficits]) => Array.isArray(deficits) && deficits.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);
    return {
      readyCount,
      unreadyCount,
      tone: toneForReadiness(readyCount, unreadyCount),
      topDeficits,
    };
  }, [health]);

  async function ensureLabelSummary(label: string) {
    if (labelSummaries[label]) return;
    try {
      setSummaryLoadingLabel(label);
      const response = await fetch(`${API_BASE}/landmark_label_summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          captureSessionId: captureSessionId || undefined,
          signerId: signerId?.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as LabelSummaryResponse;
      setLabelSummaries((current) => ({ ...current, [label]: payload }));
    } catch (summaryError) {
      console.log("Failed to load label summary", summaryError);
      setLabelSummaries((current) => ({
        ...current,
        [label]: { ok: false, error: "Failed to load label summary." },
      }));
    } finally {
      setSummaryLoadingLabel((current) => (current === label ? null : current));
    }
  }

  function handleToggleLabel(label: string) {
    if (expandedLabel === label) {
      setExpandedLabel(null);
      return;
    }
    setExpandedLabel(label);
    void ensureLabelSummary(label);
  }

  const readinessToneStyle =
    readiness.tone === "strong"
      ? styles.readinessStrong
      : readiness.tone === "partial"
        ? styles.readinessPartial
        : styles.readinessLimited;

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>
        <LabPageHeader
          title="Dataset"
          onBack={() => navigation.getParent()?.goBack?.()}
          horizontalPadding={18}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void fetchHealth(true);
            }}
            tintColor={ACCENT}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : error ? (
          <View style={styles.messageWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="albums-outline" size={16} color={ACCENT} />
                <Text style={styles.sectionTitle}>Dataset Snapshot</Text>
              </View>
              <View style={styles.sectionBody}>
                <View style={styles.metricsGrid}>
                  <DatasetMetric label="Letter samples" value={String(snapshot.landmarkApproved)} />
                  <DatasetMetric label="Word samples" value={String(snapshot.wordApproved)} />
                  <DatasetMetric label="Signers" value={String(snapshot.signerCount)} />
                  <DatasetMetric
                    label="Training mode"
                    value={snapshot.modeLabel}
                    sublabel={lastRefresh ? `Updated ${lastRefresh}` : undefined}
                  />
                </View>
              </View>
            </View>

            <InsetDivider />

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="swap-horizontal-outline" size={16} color={ACCENT} />
                <Text style={styles.sectionTitle}>Handedness Balance</Text>
              </View>
              <View style={styles.sectionBody}>
                <View style={styles.balanceRow}>
                  <View style={styles.balanceMeta}>
                    <Text style={styles.balanceTitle}>Letters</Text>
                    <Text style={styles.balanceSubtitle}>{formatBalanceLabel(letterByHand.Left, letterByHand.Right)}</Text>
                  </View>
                  <Text style={styles.balanceValue}>{formatHandSplit(letterByHand)}</Text>
                </View>
                <View style={styles.balanceRow}>
                  <View style={styles.balanceMeta}>
                    <Text style={styles.balanceTitle}>Words</Text>
                    <Text style={styles.balanceSubtitle}>{formatBalanceLabel(wordByHand.Left, wordByHand.Right)}</Text>
                  </View>
                  <Text style={styles.balanceValue}>{formatHandSplit(wordByHand)}</Text>
                </View>
              </View>
            </View>

            <InsetDivider />

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pulse-outline" size={16} color={ACCENT} />
                <Text style={styles.sectionTitle}>Readiness</Text>
              </View>
              <View style={styles.sectionBody}>
                <View style={[styles.readinessBanner, readinessToneStyle]}>
                  <Text style={styles.readinessTitle}>
                    {readiness.tone === "strong"
                      ? "Dataset readiness is strong"
                      : readiness.tone === "partial"
                        ? "Dataset readiness is partial"
                        : "Dataset readiness is limited"}
                  </Text>
                  <Text style={styles.readinessBody}>
                    {readiness.readyCount} ready labels · {readiness.unreadyCount} below quota
                  </Text>
                </View>
                {readiness.topDeficits.length ? (
                  <View style={styles.deficitList}>
                    {readiness.topDeficits.map(([label, deficits]) => (
                      <View key={label} style={styles.deficitRow}>
                        <Text style={styles.deficitLabel}>{label}</Text>
                        <Text style={styles.deficitValue}>{deficits.join(", ")}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyHint}>No current quota deficits detected.</Text>
                )}
              </View>
            </View>

            <InsetDivider />

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-outline" size={16} color={ACCENT} />
                <Text style={styles.sectionTitle}>Label Health</Text>
              </View>
              <View style={styles.sectionBody}>
                {labelItems.map((item, index) => {
                  const summary = labelSummaries[item.label];
                  const isExpanded = expandedLabel === item.label;
                  return (
                    <View key={item.label}>
                      {index > 0 ? <InsetDivider /> : null}
                      <Pressable
                        onPress={() => handleToggleLabel(item.label)}
                        style={styles.labelRow}
                      >
                        <View style={styles.labelPrimary}>
                          <View style={styles.labelTopRow}>
                            <Text style={styles.labelName}>{item.label}</Text>
                            <Text style={[styles.labelState, item.isReady ? styles.labelStateReady : styles.labelStateWeak]}>
                              {item.isReady ? "Ready" : "Weak"}
                            </Text>
                          </View>
                          <Text style={styles.labelMeta}>
                            {item.approved} approved · {item.signerCount} signers · {formatHandSplit(item.byHand)}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={TEXT_TERTIARY}
                        />
                      </Pressable>

                      {isExpanded ? (
                        <View style={styles.labelDetail}>
                          {summaryLoadingLabel === item.label && !summary ? (
                            <ActivityIndicator size="small" color={ACCENT} />
                          ) : summary?.ok === false ? (
                            <Text style={styles.errorText}>{summary.error || "Failed to load label details."}</Text>
                          ) : summary ? (
                            <>
                              <View style={styles.detailStatsGrid}>
                                <DetailStat label="Approved" value={String(summary.approved || 0)} />
                                <DetailStat label="Pending" value={String(summary.pending || 0)} />
                                <DetailStat label="Rejected" value={String(summary.rejected || 0)} />
                                <DetailStat label="Legacy" value={String(summary.legacy || 0)} />
                              </View>
                              <InsetDivider />
                              <View style={styles.sessionRow}>
                                <Text style={styles.sessionTitle}>Current session</Text>
                                <Text style={styles.sessionValue}>
                                  {(summary.session_total || 0) > 0
                                    ? `${summary.session_total || 0} total · L ${summary.session_by_hand?.Left || 0} · R ${summary.session_by_hand?.Right || 0}`
                                    : "No matching session samples"}
                                </Text>
                              </View>
                            </>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  headerWrap: {
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 1 : 6,
    paddingHorizontal: 18,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: SPACING.SPACE_LG,
    paddingBottom: SPACING.SPACE_LG,
    gap: SPACING.SPACE_LG,
  },
  loadingWrap: {
    paddingTop: SPACING.SPACE_XL,
    alignItems: "center",
  },
  messageWrap: {
    paddingTop: SPACING.SPACE_XL,
  },
  errorText: {
    color: WARNING,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "600",
  },
  section: {
    gap: SPACING.SPACE_MD,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_XS,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  sectionBody: {
    gap: SPACING.SPACE_MD,
  },
  insetDivider: {
    height: 1,
    marginHorizontal: 0,
    backgroundColor: BORDER,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SPACE_SM,
  },
  metricCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 18,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    gap: 4,
  },
  metricLabel: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "900",
  },
  metricSublabel: {
    color: TEXT_TERTIARY,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 18,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
    gap: SPACING.SPACE_MD,
  },
  balanceMeta: {
    flex: 1,
    gap: 2,
  },
  balanceTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
  },
  balanceSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
  },
  balanceValue: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
  },
  readinessBanner: {
    borderRadius: 18,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_MD,
    gap: 4,
  },
  readinessStrong: {
    backgroundColor: SUCCESS_LIGHT,
  },
  readinessPartial: {
    backgroundColor: INFO_LIGHT,
  },
  readinessLimited: {
    backgroundColor: WARNING_LIGHT,
  },
  readinessTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "900",
  },
  readinessBody: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "600",
  },
  deficitList: {
    gap: SPACING.SPACE_XS,
  },
  deficitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.SPACE_MD,
    alignItems: "flex-start",
    backgroundColor: BG_MUTED,
    borderRadius: 14,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_XS,
  },
  deficitLabel: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
  },
  deficitValue: {
    flex: 1,
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
    textAlign: "right",
  },
  emptyHint: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "600",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
  },
  labelPrimary: {
    flex: 1,
    gap: 4,
  },
  labelTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_MD,
  },
  labelName: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "900",
  },
  labelState: {
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "800",
  },
  labelStateReady: {
    color: SUCCESS,
  },
  labelStateWeak: {
    color: WARNING,
  },
  labelMeta: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
  },
  labelDetail: {
    gap: SPACING.SPACE_MD,
    paddingTop: SPACING.SPACE_XS,
    paddingBottom: SPACING.SPACE_SM,
  },
  detailStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SPACE_SM,
  },
  detailStat: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 14,
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_XS,
    gap: 2,
  },
  detailStatLabel: {
    color: TEXT_TERTIARY,
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailStatValue: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "900",
  },
  sessionRow: {
    gap: 4,
  },
  sessionTitle: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
  },
  sessionValue: {
    color: TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
  },
});
