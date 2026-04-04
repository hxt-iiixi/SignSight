import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
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
type SheetKind = "target" | "model" | null;

export function CaptureCard() {
  const [mode, setMode] = useState<Mode>("letters");
  const [selectedLabel, setSelectedLabel] = useState<string>("N/A");
  const [activeSheet, setActiveSheet] = useState<SheetKind>(null);
  const [availableModels, setAvailableModels] = useState<ModelItem[]>([
    { id: "None", label: "None" },
  ]);
  const [selectedModelObj, setSelectedModelObj] = useState<ModelItem>({
    id: "None",
    label: "None",
  });

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["50%"], []);

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
      } catch (err) {
        console.log("Failed to fetch models", err);
      }
    }

    fetchModels();
  }, []);

  const openSheet = useCallback((kind: Exclude<SheetKind, null>) => {
    setActiveSheet(kind);
  }, []);

  useEffect(() => {
    if (!activeSheet) return;
    requestAnimationFrame(() => {
      bottomSheetRef.current?.present();
    });
  }, [activeSheet]);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedLabel("N/A");
  };

  const sheetTitle =
    activeSheet === "model" ? "Select Model" : "Select Target";

  return (
    <View style={styles.wrapper}>
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
            <Text style={styles.title}>Data Collector</Text>
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
            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => openSheet("target")}
            >
              <View style={styles.selectorTextContainer}>
                <Text style={styles.selectorLabel}>Target</Text>
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

            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => openSheet("model")}
            >
              <View style={styles.selectorTextContainer}>
                <Text style={styles.selectorLabel}>Model</Text>
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

      <BottomSheetModal
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        animateOnMount
        backdropComponent={null}
        onDismiss={() => setActiveSheet(null)}
        backgroundStyle={styles.bottomSheet}
        handleIndicatorStyle={styles.sheetHandle}
        handleStyle={styles.sheetHandleWrap}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{sheetTitle}</Text>

          {activeSheet === "model" ? (
            <BottomSheetScrollView contentContainerStyle={styles.sheetList}>
              {availableModels.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.sheetListItem,
                    selectedModelObj.id === m.id && styles.sheetItemActive,
                  ]}
                  onPress={() => {
                    setSelectedModelObj(m);
                    closeSheet();
                  }}
                >
                  <View>
                    <Text
                      style={[
                        styles.sheetItemText,
                        selectedModelObj.id === m.id &&
                          styles.sheetItemTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {m.label}
                    </Text>
                    {m.detail ? (
                      <Text style={styles.sheetItemMeta}>{m.detail}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </BottomSheetScrollView>
          ) : (
            <BottomSheetScrollView contentContainerStyle={styles.sheetList}>
              {currentLabels.map((lbl) => {
                const info = selectedModelObj.rawInfo || {};
                const isActive =
                  (info.active_static_letters || []).includes(lbl) ||
                  (info.active_static_word_labels || []).includes(lbl);
                const isReady =
                  (info.ready_static_letters || []).includes(lbl) ||
                  (info.ready_static_word_labels || []).includes(lbl);
                const isUnready = (info.unready_static_letters || []).includes(
                  lbl
                );
                const count = info.training_sample_counts?.[lbl] || 0;
                const deficits = info.deficits_by_label?.[lbl] || [];

                let statusText = "N/A";
                let statusColor = "#737373";

                if (isActive) {
                  statusText = "Active (in model)";
                  statusColor = "#16A34A";
                } else if (isReady) {
                  statusText = "Ready (pending model)";
                  statusColor = "#0284C7";
                } else if (isUnready) {
                  statusText = "Unready (needs data)";
                  statusColor = "#DC2626";
                } else if (count > 0) {
                  statusText = "Collecting data";
                  statusColor = "#D97706";
                } else {
                  statusText = "No data";
                }

                return (
                  <TouchableOpacity
                    key={lbl}
                    style={[
                      styles.sheetListItem,
                      selectedLabel === lbl && styles.sheetItemActive,
                    ]}
                    onPress={() => {
                      setSelectedLabel(lbl);
                      closeSheet();
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.sheetRow}>
                        <Text
                          style={[
                            styles.sheetItemText,
                            selectedLabel === lbl &&
                              styles.sheetItemTextActive,
                            styles.sheetTargetText,
                          ]}
                        >
                          {lbl}
                        </Text>
                        <Text
                          style={[styles.sheetStatusText, { color: statusColor }]}
                        >
                          {statusText}
                        </Text>
                      </View>

                      {count > 0 ? (
                        <Text style={styles.sheetItemMeta}>
                          Samples: {count}
                        </Text>
                      ) : null}

                      {deficits.length > 0 ? (
                        <View style={styles.deficitsWrap}>
                          {deficits.map((d: string, idx: number) => (
                            <Text key={idx} style={styles.deficitText}>
                              • {d}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </BottomSheetScrollView>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: SPACING.SPACE_LG,
  },
  cardContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BG_CARD,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SPACE_SM,
  },
  selectorButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: SPACING.SPACE_MD,
    paddingVertical: SPACING.SPACE_SM,
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
    marginBottom: 2,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandleWrap: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: SPACING.SPACE_XL,
    paddingBottom: SPACING.SPACE_XL,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "800",
    color: "#191C1D",
    marginBottom: SPACING.SPACE_MD,
  },
  sheetList: {
    paddingBottom: SPACING.SPACE_XL,
    gap: SPACING.SPACE_SM,
  },
  sheetListItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sheetItemActive: {
    borderColor: "rgba(230,110,25,0.35)",
    backgroundColor: "rgba(230,110,25,0.08)",
  },
  sheetItemText: {
    fontSize: TYPOGRAPHY.TEXT_MD,
    fontWeight: "700",
    color: "#191C1D",
  },
  sheetItemTextActive: {
    color: ACCENT,
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
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  sheetStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  deficitsWrap: {
    marginTop: 6,
    backgroundColor: "#FEE2E2",
    padding: 6,
    borderRadius: 6,
  },
  deficitText: {
    fontSize: 12,
    color: "#991B1B",
  },
});
