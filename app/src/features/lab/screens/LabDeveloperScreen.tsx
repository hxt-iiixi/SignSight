import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StatusBar, useWindowDimensions, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import { API_BASE } from "../../../config/api";
import { BG } from "../../../components/lab/shared/labColors";
import { ASL_LABELS } from "../../../ml/labels";
import { saveStreamingLandmarkSample } from "../../../ml/streamingRecognition";
import { RecognitionOverlay } from "../../../modules/camera/components/RecognitionOverlay";
import { CameraShell } from "../../../modules/camera/components/CameraShell";
import { useCameraRuntime } from "../../../modules/camera/hooks/useCameraRuntime";
import { useRecognitionRuntime } from "../../../modules/camera/hooks/useRecognitionRuntime";
import {
  ModelsTabScreen,
  type ModelManagementItem,
  type TrainingModeValue,
} from "../components/ModelsTabScreen";

type Mode = "letters" | "words";
type ModelItem = ModelManagementItem;

type LabTabParamList = {
  CaptureTab: undefined;
  DatasetTab: undefined;
  ModelsTab: undefined;
  MetricsTab: undefined;
};

type SaveState = "idle" | "saving" | "success" | "error" | "info";
type ActionState = "idle" | "running";

function normalizeModelsResponse(rawModels: any[]): ModelItem[] {
  const registryInfo = rawModels.find(
    (model: any) => model.type === "json" && model.path === "landmark_model_registry.json"
  )?.info;
  const activeVersionId =
    typeof registryInfo?.active_version_id === "string"
      ? registryInfo.active_version_id
      : null;

  return rawModels
    .filter(
      (model: any) =>
        model.type === "json" &&
        (model.path.includes("landmark_versions/") ||
          model.path.includes("archived_models/"))
    )
    .map((model: any) => {
      const info = model.info || {};
      const trainedAt = typeof info.trained_at === "string" ? info.trained_at : null;
      const archivedAt = typeof info.archived_at === "string" ? info.archived_at : null;
      const dateObj = trainedAt ? new Date(trainedAt) : null;
      const detail =
        dateObj && !Number.isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString()
          : typeof info.training_mode === "string"
            ? info.training_mode
            : "";
      const versionId =
        typeof info.version_id === "string"
          ? info.version_id
          : model.path.split("/").pop()?.replace(".json", "") ?? model.path;
      const isArchived = Boolean(model.is_archived || model.path.includes("archived_models/"));
      const accuracy =
        typeof info.accuracy === "number" && Number.isFinite(info.accuracy)
          ? info.accuracy
          : null;

      return {
        id: model.path,
        versionId,
        label:
          typeof info.label === "string"
            ? info.label
            : model.path.split("/").pop()?.replace(".json", "") ?? versionId,
        detail,
        rawInfo: info,
        trainedAt,
        trainingMode: (info.training_mode === "full_reviewed"
          ? "full_reviewed"
          : "bootstrap") as TrainingModeValue,
        isActive: versionId === activeVersionId,
        isArchived,
        accuracy,
        archivedAt,
        activeStaticLetters: Array.isArray(info.active_static_letters)
          ? info.active_static_letters.map(String)
          : [],
        activeStaticWordLabels: Array.isArray(info.active_static_word_labels)
          ? info.active_static_word_labels.map(String)
          : [],
        readyStaticLetters: Array.isArray(info.ready_static_letters)
          ? info.ready_static_letters.map(String)
          : [],
        readyStaticWordLabels: Array.isArray(info.ready_static_word_labels)
          ? info.ready_static_word_labels.map(String)
          : [],
        unreadyStaticLetters: Array.isArray(info.unready_static_letters)
          ? info.unready_static_letters.map(String)
          : [],
        deficitsByLabel:
          info.deficits_by_label && typeof info.deficits_by_label === "object"
            ? info.deficits_by_label
            : {},
        trainingSampleCounts:
          info.training_sample_counts && typeof info.training_sample_counts === "object"
            ? info.training_sample_counts
            : {},
        quotasUsed:
          info.quotas_used && typeof info.quotas_used === "object"
            ? info.quotas_used
            : null,
      };
    })
    .sort((a, b) => {
      const aTime = a.trainedAt ? new Date(a.trainedAt).getTime() : 0;
      const bTime = b.trainedAt ? new Date(b.trainedAt).getTime() : 0;
      return bTime - aTime;
    });
}

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
  onRefreshModels,
  captureSessionId,
  signerId,
  onSignerIdChange,
  variantTag,
  onVariantTagChange,
  saveState,
  saveMessage,
  setSaveFeedback,
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
  onRefreshModels: () => Promise<void>;
  captureSessionId: string;
  signerId: string;
  onSignerIdChange: (value: string) => void;
  variantTag: string;
  onVariantTagChange: (value: string) => void;
  saveState: SaveState;
  saveMessage: string | null;
  setSaveFeedback: (state: SaveState, message: string | null) => void;
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
  const canSaveLetterSample =
    mode === "letters" &&
    normalizedTarget !== "None" &&
    !!recognitionRuntime.latestHandFrame?.hasHand &&
    (recognitionRuntime.latestHandFrame?.landmarks?.length ?? 0) === 21 &&
    !!signerId.trim() &&
    !!captureSessionId;

  async function handleCapturePress() {
    if (mode === "words") {
      setSaveFeedback("info", "Word dataset saving is not enabled yet.");
      return;
    }

    if (normalizedTarget === "None") {
      setSaveFeedback("error", "Select a target before saving.");
      return;
    }

    if (!signerId.trim()) {
      setSaveFeedback("error", "Signer ID is required.");
      return;
    }

    if (!recognitionRuntime.latestHandFrame?.hasHand || (recognitionRuntime.latestHandFrame.landmarks?.length ?? 0) !== 21) {
      setSaveFeedback("error", "No valid hand detected to save.");
      return;
    }

    setSaveFeedback("saving", "Saving sample...");

    const result = await saveStreamingLandmarkSample(
      recognitionRuntime.latestHandFrame,
      API_BASE,
      normalizedTarget,
      {
        signerId: signerId.trim(),
        captureSessionId,
        cameraPosition: cameraRuntime.cameraPosition,
        deviceId: cameraRuntime.device?.id ?? undefined,
        variantTags: variantTag.trim() ? [variantTag.trim()] : [],
      }
    );

    if (!result.ok) {
      setSaveFeedback("error", result.error ?? "Failed to save sample.");
      return;
    }

    setSaveFeedback("success", `Saved ${normalizedTarget}.`);
    await onRefreshModels();
  }

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
        saveState={saveState}
        saveMessage={saveMessage}
      />
      <View style={[styles.captureActionWrap, { bottom: actionButtonBottom }]}>
        <Pressable
          style={[
            styles.captureActionButton,
            (!canSaveLetterSample || saveState === "saving") && styles.captureActionButtonDisabled,
          ]}
          onPress={handleCapturePress}
        >
          <Ionicons
            name={mode === "letters" ? "camera" : "videocam"}
            size={24}
            color="#FFFFFF"
          />
        </Pressable>
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
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [trainingMode, setTrainingMode] = useState<TrainingModeValue>("bootstrap");
  const [trainingState, setTrainingState] = useState<ActionState>("idle");
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingModelId, setArchivingModelId] = useState<string | null>(null);
  const [renamingModelId, setRenamingModelId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;
  const tabBarHeight = 72 + bottomNavPadding;
  const captureSessionId = useMemo(
    () => `${new Date().toISOString().slice(0, 10)}_lab_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  async function fetchModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch(`${API_BASE}/models`);
      const data = await res.json();
      const rawModels = Array.isArray(data.models) ? data.models : [];
      const normalized = normalizeModelsResponse(rawModels);
      const preferredModel =
        normalized.find((model) => model.isActive) ??
        normalized.find((model) => !model.isArchived) ??
        normalized[0] ??
        null;

      setAvailableModels(normalized);

      if (preferredModel) {
        setSelectedModel(preferredModel);
        setActiveModelLabel(preferredModel.label);
      } else {
        setSelectedModel(null);
        setActiveModelLabel("None");
      }
    } catch (err) {
      console.log("Failed to fetch models", err);
      setModelsError("Failed to load landmark models.");
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    void fetchModels();
  }, []);

  async function handleActivateModel(modelId: string) {
    const model = availableModels.find((item) => item.id === modelId);
    if (!model || model.id === selectedModel?.id) {
      return;
    }

    const versionId = model.versionId;
    if (!versionId) {
      return;
    }

    try {
      setModelsError(null);
      const response = await fetch(`${API_BASE}/activate_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        setModelsError(payload?.error ?? "Failed to activate model.");
        return;
      }

      await fetchModels();
    } catch (error) {
      console.log("Failed to activate model", error);
      setModelsError("Failed to activate model.");
    }
  }

  async function handleTrainModel() {
    try {
      setTrainingState("running");
      setTrainingMessage("Retraining landmark model...");
      setModelsError(null);
      const response = await fetch(`${API_BASE}/train_landmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingMode }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        setTrainingMessage(payload?.error ?? "Retraining failed.");
        return;
      }

      const accuracy =
        typeof payload?.accuracy === "number"
          ? `${(payload.accuracy * 100).toFixed(1)}%`
          : "completed";
      setTrainingMessage(`Retraining finished. Holdout accuracy ${accuracy}.`);
      await fetchModels();
    } catch (error) {
      console.log("Failed to train model", error);
      setTrainingMessage("Retraining failed.");
    } finally {
      setTrainingState("idle");
    }
  }

  async function handleRenameModel(modelId: string, nextLabel: string) {
    const model = availableModels.find((item) => item.id === modelId);
    if (!model || !nextLabel.trim()) {
      return;
    }

    try {
      setRenamingModelId(modelId);
      setModelsError(null);
      const response = await fetch(`${API_BASE}/rename_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: model.versionId, label: nextLabel.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        setModelsError(payload?.error ?? "Failed to rename model.");
        return;
      }

      await fetchModels();
    } catch (error) {
      console.log("Failed to rename model", error);
      setModelsError("Failed to rename model.");
    } finally {
      setRenamingModelId(null);
    }
  }

  async function handleArchiveModel(modelId: string) {
    const model = availableModels.find((item) => item.id === modelId);
    if (!model) {
      return;
    }

    try {
      setArchivingModelId(modelId);
      setModelsError(null);
      const response = await fetch(`${API_BASE}/archive_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: model.versionId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        setModelsError(payload?.error ?? "Failed to archive model.");
        return;
      }

      await fetchModels();
    } catch (error) {
      console.log("Failed to archive model", error);
      setModelsError("Failed to archive model.");
    } finally {
      setArchivingModelId(null);
    }
  }

  function setSaveFeedback(nextState: SaveState, message: string | null) {
    setSaveState(nextState);
    setSaveMessage(message);
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
              availableModels={availableModels.filter((model) => !model.isArchived)}
              selectedModel={selectedModel}
              activeModelLabel={activeModelLabel}
              selectedLabel={selectedLabel}
              onSelectLabel={setSelectedLabel}
              onModeChange={(nextMode) => {
                setMode(nextMode);
                setSelectedLabel("N/A");
                setSaveState("idle");
                setSaveMessage(null);
              }}
              onSelectModel={handleActivateModel}
              onRefreshModels={fetchModels}
              captureSessionId={captureSessionId}
              signerId={signerId}
              onSignerIdChange={setSignerId}
              variantTag={variantTag}
              onVariantTagChange={setVariantTag}
              saveState={saveState}
              saveMessage={saveMessage}
              setSaveFeedback={setSaveFeedback}
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
          options={{ title: "Models" }}
        >
          {() => (
            <ModelsTabScreen
              models={availableModels}
              activeModel={availableModels.find((model) => model.isActive) ?? selectedModel}
              loading={modelsLoading}
              error={modelsError}
              trainingMode={trainingMode}
              onTrainingModeChange={setTrainingMode}
              onTrain={handleTrainModel}
              trainingState={trainingState}
              trainingMessage={trainingMessage}
              showArchived={showArchived}
              onToggleArchived={() => setShowArchived((current) => !current)}
              archivingModelId={archivingModelId}
              renamingModelId={renamingModelId}
              onArchiveModel={handleArchiveModel}
              onRenameModel={handleRenameModel}
            />
          )}
        </Tab.Screen>
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
    pointerEvents: "box-none",
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
  captureActionButtonDisabled: {
    opacity: 0.55,
  },
});
