import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetFlatList,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";

import {
  ACCENT,
  BG_CARD,
} from "../../../components/lab/shared/labColors";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import { API_BASE } from "../../../config/api";
import { ASL_LABELS } from "../../../ml/labels";

export interface ModelItem {
  id: string;
  label: string;
  detail?: string;
  rawInfo?: any;
}

type Mode = "letters" | "words";

type TargetSheetItem = {
  id: string;
  label: string;
  count: number;
  deficits: string[];
  statusText: string;
  statusColor: string;
  statusKind: "active" | "ready" | "unready" | "collecting" | "none";
  unreadyStats?: {
    approved: number;
    signers: number | null;
    left: number | null;
    right: number | null;
  };
  selected: boolean;
};

type ModelSheetItem = {
  id: string;
  label: string;
  detail?: string;
  selected: boolean;
  latest: boolean;
  model: ModelItem;
};

const MODEL_ROW_HEIGHT = 72;

function extractDeficitCount(
  deficits: string[],
  matcher: RegExp
): number | null {
  const match = deficits.find((deficit) => matcher.test(deficit))?.match(/(\d+)\s*\/\s*\d+/);
  return match ? Number(match[1]) : null;
}

const TargetRow = memo(function TargetRow({
  item,
  onPress,
}: {
  item: TargetSheetItem;
  onPress: (label: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.sheetListItem}
      onPress={() => onPress(item.label)}
    >
      <View style={styles.sheetItemContent}>
        <View style={styles.sheetRow}>
          <View style={styles.sheetMainRow}>
            <View style={styles.sheetTitleRow}>
              <Text
                style={[
                  styles.sheetItemText,
                  styles.sheetTargetText,
                ]}
              >
                {item.label}
              </Text>
              {item.statusKind === "active" ? (
                <View style={styles.inlineActiveBadge}>
                  <Ionicons name="sparkles" size={12} color="#16A34A" />
                </View>
              ) : item.statusKind === "unready" ? (
                <View style={styles.inlineUnreadyBadge}>
                  <Ionicons name="alert-circle" size={12} color="#DC2626" />
                </View>
              ) : null}
            </View>
            {item.statusKind !== "active" && item.statusKind !== "unready" ? (
              <Text style={[styles.sheetStatusText, { color: item.statusColor }]}>
                {item.statusText}
              </Text>
            ) : null}
          </View>
          {item.selected ? (
            <View style={styles.selectedIconBadge}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {item.count > 0 && item.statusKind !== "unready" ? (
          <Text style={styles.sheetItemMeta}>Samples: {item.count}</Text>
        ) : null}

        {item.statusKind === "unready" && item.unreadyStats ? (
          <View style={styles.unreadyStatsCard}>
            <View style={styles.unreadyStatsGrid}>
              <View style={styles.unreadyStatsCell}>
                <Text style={styles.unreadyStatsLabel}>Approved</Text>
                <Text style={styles.unreadyStatsValue}>{item.unreadyStats.approved}</Text>
              </View>
              <View style={styles.unreadyStatsCell}>
                <Text style={styles.unreadyStatsLabel}>Left Hand</Text>
                <Text style={styles.unreadyStatsValue}>
                  {item.unreadyStats.left ?? "—"}
                </Text>
              </View>
              <View style={styles.unreadyStatsCell}>
                <Text style={styles.unreadyStatsLabel}>Signers</Text>
                <Text style={styles.unreadyStatsValue}>
                  {item.unreadyStats.signers ?? "—"}
                </Text>
              </View>
              <View style={styles.unreadyStatsCell}>
                <Text style={styles.unreadyStatsLabel}>Right Hand</Text>
                <Text style={styles.unreadyStatsValue}>
                  {item.unreadyStats.right ?? "—"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {item.deficits.length > 0 && item.statusKind !== "unready" ? (
          <View style={styles.deficitsWrap}>
            {item.deficits.map((deficit, index) => (
              <Text key={`${item.id}-deficit-${index}`} style={styles.deficitText}>
                • {deficit}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.sheetDivider} />
    </TouchableOpacity>
  );
});

const ModelRow = memo(function ModelRow({
  item,
  onPress,
}: {
  item: ModelSheetItem;
  onPress: (model: ModelItem) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.sheetListItem}
      onPress={() => onPress(item.model)}
    >
      <View style={styles.sheetItemContent}>
        <View style={styles.sheetRow}>
          <View style={styles.sheetMainRow}>
            {item.latest ? (
              <Text style={styles.latestBadgeText}>Latest</Text>
            ) : null}
            <Text
              style={styles.sheetItemText}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
          {item.selected ? (
            <View style={styles.selectedIconBadge}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.sheetDivider} />
    </TouchableOpacity>
  );
});

export function CaptureCard() {
  const [mode, setMode] = useState<Mode>("letters");
  const [selectedLabel, setSelectedLabel] = useState<string>("N/A");
  const [availableModels, setAvailableModels] = useState<ModelItem[]>([
    { id: "None", label: "None" },
  ]);
  const [selectedModelObj, setSelectedModelObj] = useState<ModelItem>({
    id: "None",
    label: "None",
  });
  const [openSheet, setOpenSheet] = useState<"target" | "model" | null>(null);

  const targetSheetRef = useRef<BottomSheet>(null);
  const modelSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%"], []);
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 34,
    stiffness: 280,
    overshootClamping: true,
  });

  const letterLabels = [...ASL_LABELS];
  const wordLabels = [
    "HELLO",
    "THANK_YOU",
    "PLEASE",
    "SORRY",
    "YES",
    "NO",
    "HELP",
    "I_LOVE_YOU",
    "WHERE",
    "GOODBYE",
  ];
  const currentLabels = mode === "letters" ? letterLabels : wordLabels;
  const selectedModelInfo = selectedModelObj.rawInfo || {};

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch(`${API_BASE}/models`);
        const data = await res.json();

        let modelsList: ModelItem[] = [{ id: "None", label: "None" }];

        if (data.models && Array.isArray(data.models)) {
          const activeVersions = data.models
            .filter(
              (m: any) =>
                m.type === "json" &&
                m.path.includes("landmark_versions/") &&
                !m.path.includes("archived_models")
            )
            .map((m: any) => {
              const info = m.info || {};
              const label =
                info.label || m.path.split("/").pop()?.replace(".json", "");
              const dateObj = info.trained_at ? new Date(info.trained_at) : null;
              const detail =
                dateObj && !Number.isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString()
                  : info.training_mode || "";

              return {
                id: m.path,
                label,
                detail,
                rawInfo: info,
                _tempDate:
                  dateObj && !Number.isNaN(dateObj.getTime())
                    ? dateObj.getTime()
                    : 0,
              };
            })
            .sort((a: any, b: any) => b._tempDate - a._tempDate);

          if (activeVersions.length > 0) {
            modelsList = [...modelsList, ...activeVersions];
          }
        }

        setAvailableModels(modelsList);
        if (modelsList.length > 1) {
          setSelectedModelObj(modelsList[1]);
        } else {
          setSelectedModelObj(modelsList[0]);
        }
      } catch (err) {
        console.log("Failed to fetch models", err);
      }
    }

    fetchModels();
  }, []);

  const openTargetSheet = useCallback(() => {
    if (openSheet === "model") {
      modelSheetRef.current?.close();
    }
    targetSheetRef.current?.snapToIndex(0);
    setOpenSheet("target");
  }, [openSheet]);

  const openModelSheet = useCallback(() => {
    if (openSheet === "target") {
      targetSheetRef.current?.close();
    }
    modelSheetRef.current?.snapToIndex(0);
    setOpenSheet("model");
  }, [openSheet]);

  const closeTargetSheet = useCallback(() => {
    targetSheetRef.current?.close();
  }, []);

  const closeModelSheet = useCallback(() => {
    modelSheetRef.current?.close();
  }, []);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedLabel("N/A");
  };

  const targetSheetData = useMemo<TargetSheetItem[]>(() => {
    return currentLabels.map((label) => {
      const isActive =
        (selectedModelInfo.active_static_letters || []).includes(label) ||
        (selectedModelInfo.active_static_word_labels || []).includes(label);
      const isReady =
        (selectedModelInfo.ready_static_letters || []).includes(label) ||
        (selectedModelInfo.ready_static_word_labels || []).includes(label);
      const isUnready =
        (selectedModelInfo.unready_static_letters || []).includes(label);
      const count = selectedModelInfo.training_sample_counts?.[label] || 0;
      const deficits = selectedModelInfo.deficits_by_label?.[label] || [];

      let statusText = "N/A";
      let statusColor = "#737373";
      let statusKind: TargetSheetItem["statusKind"] = "none";

      if (isActive) {
        statusText = "Active (in model)";
        statusColor = "#16A34A";
        statusKind = "active";
      } else if (isReady) {
        statusText = "Ready (pending model)";
        statusColor = "#0284C7";
        statusKind = "ready";
      } else if (isUnready) {
        statusText = "Unready (needs data)";
        statusColor = "#DC2626";
        statusKind = "unready";
      } else if (count > 0) {
        statusText = "Collecting data";
        statusColor = "#D97706";
        statusKind = "collecting";
      } else {
        statusText = "No data";
      }

      return {
        id: label,
        label,
        count,
        deficits,
        statusText,
        statusColor,
        statusKind,
        unreadyStats:
          statusKind === "unready"
            ? {
                approved: count,
                signers: extractDeficitCount(deficits, /signers/i),
                left: extractDeficitCount(deficits, /left hand/i),
                right: extractDeficitCount(deficits, /right hand/i),
              }
            : undefined,
        selected: selectedLabel === label,
      };
    });
  }, [currentLabels, selectedLabel, selectedModelInfo]);

  const modelSheetData = useMemo<ModelSheetItem[]>(
    () => {
      const latestModelId =
        availableModels.find((model) => model.id !== "None")?.id ?? null;

      return availableModels
      .filter((model) => model.id !== "None")
      .map((model) => ({
        id: model.id,
        label: model.label,
        detail: model.detail,
        selected: selectedModelObj.id === model.id,
        latest: model.id !== "None" && model.id === latestModelId,
        model,
      }));
    },
    [availableModels, selectedModelObj.id]
  );

  const handleTargetSelect = useCallback(
    (label: string) => {
      setSelectedLabel(label);
      closeTargetSheet();
    },
    [closeTargetSheet]
  );

  const handleModelSelect = useCallback(
    (model: ModelItem) => {
      setSelectedModelObj(model);
      closeModelSheet();
    },
    [closeModelSheet]
  );

  const renderTargetItem = useCallback(
    ({ item }: { item: TargetSheetItem }) => (
      <TargetRow item={item} onPress={handleTargetSelect} />
    ),
    [handleTargetSelect]
  );

  const renderModelItem = useCallback(
    ({ item }: { item: ModelSheetItem }) => (
      <ModelRow item={item} onPress={handleModelSelect} />
    ),
    [handleModelSelect]
  );

  const keyExtractor = useCallback((item: { id: string }) => item.id, []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bottomStack}>
        <TouchableOpacity style={styles.captureBtnFloating}>
          <Ionicons
            name={mode === "letters" ? "camera" : "videocam"}
            size={36}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View style={styles.cardContainer}>
          <View style={styles.cardContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Dataset Collection</Text>
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    mode === "letters" && styles.modeButtonActive,
                  ]}
                  onPress={() => handleModeChange("letters")}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === "letters" && styles.modeTextActive,
                    ]}
                  >
                    Ltr
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    mode === "words" && styles.modeButtonActive,
                  ]}
                  onPress={() => handleModeChange("words")}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === "words" && styles.modeTextActive,
                    ]}
                  >
                    Wrd
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.selectorsRow}>
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>Target</Text>
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={openTargetSheet}
                >
                  <View style={styles.selectorTextContainer}>
                    <Text
                      style={styles.selectorValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {selectedLabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#737373" />
                </TouchableOpacity>
              </View>

              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>Model</Text>
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={openModelSheet}
                >
                  <View style={styles.selectorTextContainer}>
                    <Text
                      style={styles.selectorValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {selectedModelObj.label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#737373" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>

      <BottomSheet
        ref={targetSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        animationConfigs={animationConfigs}
        onChange={(index) => {
          if (index < 0 && openSheet === "target") {
            setOpenSheet(null);
          }
        }}
        backgroundStyle={styles.bottomSheet}
        handleIndicatorStyle={styles.sheetHandle}
        handleStyle={styles.sheetHandleWrap}
        style={styles.persistentSheet}
      >
        <BottomSheetFlatList
          data={targetSheetData}
          renderItem={renderTargetItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.sheetList}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={6}
          nestedScrollEnabled
          removeClippedSubviews={false}
        />
      </BottomSheet>

      <BottomSheet
        ref={modelSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        animationConfigs={animationConfigs}
        onChange={(index) => {
          if (index < 0 && openSheet === "model") {
            setOpenSheet(null);
          }
        }}
        backgroundStyle={styles.bottomSheet}
        handleIndicatorStyle={styles.sheetHandle}
        handleStyle={styles.sheetHandleWrap}
        style={styles.persistentSheet}
      >
        <BottomSheetFlatList
          data={modelSheetData}
          renderItem={renderModelItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.sheetList}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          nestedScrollEnabled
          removeClippedSubviews={false}
          getItemLayout={(_, index) => ({
            length: MODEL_ROW_HEIGHT,
            offset: MODEL_ROW_HEIGHT * index,
            index,
          })}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    pointerEvents: "box-none",
  },
  bottomStack: {
    pointerEvents: "box-none",
    paddingBottom: 116,
  },
  captureBtnFloating: {
    alignSelf: "center",
    backgroundColor: ACCENT,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: SPACING.SPACE_LG,
  },
  cardContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BG_CARD,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  cardContent: {
    padding: SPACING.SPACE_LG,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.SPACE_MD,
  },
  title: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "800",
    color: "#191C1D",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F3F4",
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  modeText: {
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "600",
    color: "#737373",
  },
  modeTextActive: {
    color: ACCENT,
    fontWeight: "800",
  },
  selectorsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },
  selectorGroup: {
    flex: 1,
  },
  selectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: SPACING.SPACE_MD,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectorTextContainer: {
    flex: 1,
    marginRight: SPACING.SPACE_XS,
  },
  selectorLabel: {
    fontSize: TYPOGRAPHY.TEXT_XS - 2,
    fontWeight: "600",
    color: "#737373",
    textTransform: "uppercase",
    marginBottom: 6,
    marginLeft: 2,
  },
  selectorValue: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "700",
    color: "#191C1D",
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  sheetHandleWrap: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  persistentSheet: {
    zIndex: 20,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  sheetList: {
    paddingTop: SPACING.SPACE_XS,
    paddingHorizontal: SPACING.SPACE_XL,
    paddingBottom: SPACING.SPACE_MD + 48,
    gap: SPACING.SPACE_XS,
  },
  sheetListItem: {
    paddingVertical: 10,
  },
  sheetItemContent: {
    flex: 1,
  },
  sheetItemText: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "700",
    color: "#191C1D",
  },
  sheetTargetText: {
    fontSize: 18,
  },
  sheetItemMeta: {
    fontSize: 13,
    color: "#737373",
    marginTop: 4,
  },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.SPACE_SM,
  },
  sheetMainRow: {
    flex: 1,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  inlineActiveBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(22,163,74,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineUnreadyBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(220,38,38,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  latestBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#E8EAED",
    marginTop: SPACING.SPACE_XS,
    marginHorizontal: 0,
  },
  deficitsWrap: {
    marginTop: 6,
    backgroundColor: "#FEE2E2",
    padding: 6,
    borderRadius: 6,
  },
  unreadyStatsCard: {
    marginTop: 5,
    backgroundColor: "#FEF2F2",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  unreadyStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  unreadyStatsCell: {
    width: "50%",
    paddingRight: 4,
  },
  unreadyStatsLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#991B1B",
    textTransform: "uppercase",
    letterSpacing: 0.15,
    marginBottom: 0,
  },
  unreadyStatsValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7F1D1D",
    lineHeight: 16,
  },
  deficitText: {
    fontSize: 12,
    color: "#991B1B",
  },
});
