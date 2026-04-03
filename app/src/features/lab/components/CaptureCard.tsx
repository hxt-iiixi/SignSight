export interface ModelItem { id: string; label: string; detail?: string; }
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ACCENT, BG_CARD, PRIMARY_CONTAINER } from "../../../components/lab/shared/labColors";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import { ASL_LABELS } from "../../../ml/labels";
import { API_BASE } from "../../../config/api";

type Mode = "letters" | "words";

export function CaptureCard() {
  const [mode, setMode] = useState<Mode>("letters");
  const [selectedLabel, setSelectedLabel] = useState<string>("N/A");
  const [isSheetVisible, setSheetVisible] = useState(false);

  
  const [isModelSheetVisible, setModelSheetVisible] = useState(false);
  

const [availableModels, setAvailableModels] = useState<ModelItem[]>([{ id: "None", label: "None" }]);
const [selectedModelObj, setSelectedModelObj] = useState<ModelItem>({ id: "None", label: "None" });

  const letterLabels = [...ASL_LABELS];
  const wordLabels = ["HELLO", "THANK_YOU", "PLEASE", "SORRY", "YES", "NO", "HELP", "I_LOVE_YOU", "WHERE", "GOODBYE"];

  const currentLabels = mode === "letters" ? letterLabels : wordLabels;

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch(`${API_BASE}/models`);
        const data = await res.json();
        
        let modelsList: ModelItem[] = [{ id: "None", label: "None" }];
        if (data.models && Array.isArray(data.models)) {
          const activeVersions = data.models
            .filter((m: any) => m.type === "json" && m.path.includes("landmark_versions/") && !m.path.includes("archived_models"))
            .map((m: any) => {
              const info = m.info || {};
              const label = info.label || m.path.split("/").pop()?.replace(".json", "");
              const dateObj = info.trained_at ? new Date(info.trained_at) : null;
              const detail = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : (info.training_mode || "");
              return { id: m.path, label: label, detail, _tempDate: dateObj && !isNaN(dateObj.getTime()) ? dateObj.getTime() : 0 };
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

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedLabel("N/A");
  };

  return (
    <View style={styles.wrapper}>
      {/* Action button floating outside */}
      <TouchableOpacity style={styles.captureBtnFloating}>
        <Ionicons
          name={mode === "letters" ? "camera" : "videocam"}
          size={36}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      <View style={styles.cardContainer}>
        <View style={styles.cardContent}>
          {/* Header / Mode Switcher */}
          <View style={styles.header}>
            <Text style={styles.title}>Data Collector</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, mode === "letters" && styles.modeButtonActive]}
                onPress={() => handleModeChange("letters")}
              >
                <Text style={[styles.modeText, mode === "letters" && styles.modeTextActive]}>
                  Ltr
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === "words" && styles.modeButtonActive]}
                onPress={() => handleModeChange("words")}
              >
                <Text style={[styles.modeText, mode === "words" && styles.modeTextActive]}>
                  Wrd
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Selectors Row */}
          <View style={styles.selectorsRow}>
            {/* Target Selector Button */}
            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setSheetVisible(true)}
            >
              <View style={styles.selectorTextContainer}>
                <Text style={styles.selectorLabel}>Target</Text>
                <Text style={styles.selectorValue} numberOfLines={1} adjustsFontSizeToFit>
                  {selectedLabel}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#737373" />
            </TouchableOpacity>

            {/* Model Selector Button */}
            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setModelSheetVisible(true)}
            >
              <View style={styles.selectorTextContainer}>
                <Text style={styles.selectorLabel}>Model</Text>
                <Text style={styles.selectorValue} numberOfLines={1} adjustsFontSizeToFit>
                  {selectedModelObj.label}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#737373" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Target Selector Bottom Sheet */}
        <Modal
          visible={isSheetVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSheetVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSheetVisible(false)}>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Select Target</Text>

              <ScrollView contentContainerStyle={styles.sheetGrid}>
                {currentLabels.map((lbl: string) => (
                  <TouchableOpacity
                    key={lbl}
                    style={[
                      styles.sheetItem,
                      selectedLabel === lbl && styles.sheetItemActive,
                    ]}
                    onPress={() => {
                      setSelectedLabel(lbl);
                      setSheetVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.sheetItemText,
                        selectedLabel === lbl && styles.sheetItemTextActive,
                      ]}
                    >
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        {/* Model Selector Bottom Sheet */}
        <Modal
          visible={isModelSheetVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModelSheetVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModelSheetVisible(false)}>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Select Model</Text>

              <ScrollView contentContainerStyle={styles.sheetList}>
                {availableModels.map((m: ModelItem) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.sheetListItem,
                      selectedModelObj.id === m.id && styles.sheetItemActive,
                    ]}
                    onPress={() => {
                      setSelectedModelObj(m);
                      setModelSheetVisible(false);
                    }}
                  >
                    <View>
                      <Text
                        style={[
                          styles.sheetItemText,
                          selectedModelObj.id === m.id && styles.sheetItemTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {m.label}
                      </Text>
                      {m.detail ? (
                        <Text style={{ fontSize: 12, color: "#737373", marginTop: 4 }}>
                          {m.detail}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 20,
    left: SPACING.SPACE_MD,
    right: SPACING.SPACE_MD,
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
    borderRadius: 24,
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
    marginBottom: 0,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.SPACE_XL,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginBottom: SPACING.SPACE_LG,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.TEXT_LG,
    fontWeight: "800",
    color: "#191C1D",
    marginBottom: SPACING.SPACE_MD,
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SPACE_SM,
    paddingBottom: SPACING.SPACE_XL,
  },
  sheetItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: SPACING.SPACE_SM,
  },
  sheetList: {
    flexDirection: "column",
    gap: SPACING.SPACE_SM,
    paddingBottom: SPACING.SPACE_XL,
  },
  sheetListItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    width: "100%",
  },
  sheetItemActive: {
    backgroundColor: PRIMARY_CONTAINER,
    borderColor: PRIMARY_CONTAINER,
  },
  sheetItemText: {
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "600",
    color: "#4A4A4A",
  },
  sheetItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
