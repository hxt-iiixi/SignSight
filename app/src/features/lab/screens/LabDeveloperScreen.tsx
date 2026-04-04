import React, { useEffect, useState } from "react";
import { Platform, StatusBar, useWindowDimensions, View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import { API_BASE } from "../../../config/api";
import { BG } from "../../../components/lab/shared/labColors";
import { ASL_LABELS } from "../../../ml/labels";
import { RecognitionOverlay } from "../../../modules/camera/components/RecognitionOverlay";
import { CameraShell } from "../../../modules/camera/components/CameraShell";
import { useCameraRuntime } from "../../../modules/camera/hooks/useCameraRuntime";
import { useRecognitionRuntime } from "../../../modules/camera/hooks/useRecognitionRuntime";

type Mode = "letters" | "words";

type ModelItem = {
  id: string;
  label: string;
  detail?: string;
  rawInfo?: any;
};

type LabTabParamList = {
  CaptureTab: undefined;
  DatasetTab: undefined;
  ModelsTab: undefined;
  MetricsTab: undefined;
};

const Tab = createBottomTabNavigator<LabTabParamList>();

function CaptureTabScreen({
  mode,
  bottomOffset,
  availableModels,
  selectedModel,
  activeModelLabel,
  selectedLabel,
  onSelectLabel,
  onModeChange,
  onSelectModel,
  signerId,
  onSignerIdChange,
  variantTag,
  onVariantTagChange,
}: {
  mode: Mode;
  bottomOffset: number;
  availableModels: ModelItem[];
  selectedModel: ModelItem | null;
  activeModelLabel: string;
  selectedLabel: string;
  onSelectLabel: (value: string) => void;
  onModeChange: (value: Mode) => void;
  onSelectModel: (modelId: string) => void;
  signerId: string;
  onSignerIdChange: (value: string) => void;
  variantTag: string;
  onVariantTagChange: (value: string) => void;
}) {
  const navigation = useNavigation<any>();
  const { showHandOverlay } = useAppSettings();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const cameraRuntime = useCameraRuntime();
  const recognitionRuntime = useRecognitionRuntime({
    enabled:
      cameraRuntime.ready &&
      !!cameraRuntime.device &&
      !!cameraRuntime.format,
    detectMode: mode === "letters" ? "LETTERS" : "WORDS",
  });

  const statusBarInset =
    Platform.OS === "android"
      ? cameraRuntime.statusBarInset
      : StatusBar.currentHeight ?? 0;
  const topStrongHeight = Math.max(30, statusBarInset + 8);
  const topMidHeight = 52;
  const topFadeHeight = topStrongHeight + topMidHeight + 14;
  const topBarTop = topStrongHeight + 2;
  const selectedModelLabel = activeModelLabel || selectedModel?.label || "None";
  const resultCardTop = topBarTop + 56;
  const actionButtonBottom = Math.max(2, bottomOffset - 110);
  const normalizedTarget = selectedLabel === "N/A" ? "None" : selectedLabel;
  const currentTargets =
    mode === "letters"
      ? [...ASL_LABELS]
      : [
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
  const selectedModelInfo = selectedModel?.rawInfo ?? {};
  const sampleCount =
    normalizedTarget !== "None"
      ? Number(selectedModelInfo.training_sample_counts?.[normalizedTarget] ?? 0)
      : 0;
  const quotaTarget =
    Number(selectedModelInfo.quotas_used?.min_approved_per_hand) ||
    Number(selectedModelInfo.quotas_used?.min_approved_samples_per_label) ||
    0;
  const quotaLabel =
    normalizedTarget === "None" || quotaTarget <= 0 ? "—" : `${sampleCount}/${quotaTarget}`;

  return (
    <CameraShell
      CameraComponent={cameraRuntime.Camera}
      cameraRef={cameraRuntime.cameraRef}
      cameraLayout={cameraRuntime.cameraLayout}
      cameraPosition={cameraRuntime.cameraPosition}
      device={cameraRuntime.device}
      format={cameraRuntime.format}
      frameProcessor={recognitionRuntime.frameProcessor}
      latestHandFrame={recognitionRuntime.latestHandFrame}
      onBack={() => navigation.goBack()}
      onCameraLayout={cameraRuntime.onCameraLayout}
      onFlipCamera={cameraRuntime.flipCamera}
      onToggleTorch={cameraRuntime.toggleTorch}
      orientedFrame={cameraRuntime.orientedFrame}
      overlayVisible={true}
      ready={cameraRuntime.ready}
      showHandOverlay={showHandOverlay}
      title="SignSight"
      topBarTop={topBarTop}
      topFadeHeight={topFadeHeight}
      topPadding={isTablet ? 24 : isSmall ? 14 : 18}
      torchEnabled={cameraRuntime.torchEnabled}
      unsupportedMessage={
        recognitionRuntime.isSupported
          ? null
          : "Streaming hand tracking requires an Android development build with the native hand tracker module."
      }
    >
      <RecognitionOverlay
        prediction={recognitionRuntime.prediction}
        topOffset={resultCardTop}
        collapsible
        targetLabel={normalizedTarget}
        targetOptions={currentTargets}
        onTargetSelect={onSelectLabel}
        modeValue={mode}
        onModeChange={onModeChange}
        modelLabel={selectedModelLabel}
        modelOptions={availableModels}
        onModelSelect={onSelectModel}
        quotaLabel={quotaLabel}
        signerId={signerId}
        onSignerIdChange={onSignerIdChange}
        variantTag={variantTag}
        onVariantTagChange={onVariantTagChange}
      />
      <View style={[styles.captureActionWrap, { bottom: actionButtonBottom }]}>
        <View style={styles.captureActionButton}>
          <Ionicons
            name={mode === "letters" ? "camera" : "videocam"}
            size={24}
            color="#FFFFFF"
          />
        </View>
      </View>
    </CameraShell>
  );
}

function StaticLabTabScreen() {
  return (
    <View style={styles.staticTabScreen}>
      <View style={styles.staticTabTopBar} />
    </View>
  );
}

function getLabTabIcon(routeName: keyof LabTabParamList) {
  if (routeName === "CaptureTab") return "camera-outline" as const;
  if (routeName === "DatasetTab") return "albums-outline" as const;
  if (routeName === "ModelsTab") return "cube-outline" as const;
  return "stats-chart-outline" as const;
}

export default function LabDeveloperScreen() {
  const [mode, setMode] = useState<Mode>("letters");
  const [selectedLabel, setSelectedLabel] = useState("N/A");
  const [signerId, setSignerId] = useState("person_01");
  const [variantTag, setVariantTag] = useState("neutral");
  const [availableModels, setAvailableModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null);
  const [activeModelLabel, setActiveModelLabel] = useState<string>("None");
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;
  const tabBarHeight = 72 + bottomNavPadding;

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch(`${API_BASE}/models`);
        const data = await res.json();
        const rawModels = Array.isArray(data.models) ? data.models : [];
        const registryInfo = rawModels.find(
          (model: any) => model.type === "json" && model.path === "landmark_model_registry.json"
        )?.info;
        const activeVersionId =
          typeof registryInfo?.active_version_id === "string"
            ? registryInfo.active_version_id
            : null;

        if (rawModels.length > 0) {
          const activeVersions = rawModels
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

          const preferredModel =
            activeVersions.find(
              (model) => model.rawInfo?.version_id === activeVersionId
            ) ?? activeVersions[0];

          setAvailableModels(activeVersions);

          if (preferredModel) {
            setSelectedModel(preferredModel);
            setActiveModelLabel(preferredModel.label);
          }
        }

      } catch (err) {
        console.log("Failed to fetch models", err);
      }
    }

    void fetchModels();
  }, []);

  async function handleActivateModel(modelId: string) {
    const model = availableModels.find((item) => item.id === modelId);
    if (!model || model.id === selectedModel?.id) {
      return;
    }

    const versionId = model.rawInfo?.version_id;
    if (!versionId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/activate_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        return;
      }

      setSelectedModel(model);
      setActiveModelLabel(model.label);
    } catch (error) {
      console.log("Failed to activate model", error);
    }
  }

  return (
    <View style={styles.container}>
      <Tab.Navigator
        id="lab-tabs"
        screenOptions={({ route }) => ({
          headerShown: false,
        tabBarStyle: {
          height: 72 + bottomNavPadding,
          paddingBottom: bottomNavPadding,
          paddingTop: 10,
          borderTopWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        },
          tabBarActiveTintColor: "#E66E19",
          tabBarInactiveTintColor: "#737373",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={getLabTabIcon(route.name as keyof LabTabParamList)}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen
          name="CaptureTab"
          options={{ title: "Capture" }}
        >
          {() => (
            <CaptureTabScreen
              mode={mode}
              bottomOffset={tabBarHeight}
              availableModels={availableModels}
              selectedModel={selectedModel}
              activeModelLabel={activeModelLabel}
              selectedLabel={selectedLabel}
              onSelectLabel={setSelectedLabel}
              onModeChange={(nextMode) => {
                setMode(nextMode);
                setSelectedLabel("N/A");
              }}
              onSelectModel={handleActivateModel}
              signerId={signerId}
              onSignerIdChange={setSignerId}
              variantTag={variantTag}
              onVariantTagChange={setVariantTag}
            />
          )}
        </Tab.Screen>
        
        <Tab.Screen
          name="DatasetTab"
          component={StaticLabTabScreen}
          options={{ title: "Dataset" }}
        />
        <Tab.Screen
          name="ModelsTab"
          component={StaticLabTabScreen}
          options={{ title: "Models" }}
        />
        <Tab.Screen
          name="MetricsTab"
          component={StaticLabTabScreen}
          options={{ title: "Metrics" }}
        />
      </Tab.Navigator>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  staticTabScreen: {
    flex: 1,
    backgroundColor: BG,
  },
  staticTabTopBar: {
    height: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 56 : 56,
  },
  captureActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 16,
    pointerEvents: "none",
  },
  captureActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E66E19",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E66E19",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
});
