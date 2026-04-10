import React, { useEffect, useMemo, useState } from "react";
import { Platform, StatusBar, useWindowDimensions } from "react-native";

import { API_BASE } from "../../config/api";
import { CameraShell } from "../../modules/camera/components/CameraShell";
import { TranslatorOverlay } from "../../modules/camera/components/TranslatorOverlay";
import { useCameraRuntime } from "../../modules/camera/hooks/useCameraRuntime";
import { useRecognitionRuntime } from "../../modules/camera/hooks/useRecognitionRuntime";

export type CameraExperienceProps = {
  onBack: () => void;
  debugEnabled?: boolean;
  showHandOverlay?: boolean;
};

type TranslatorMode = "letters" | "words";
type TranslatorModelItem = {
  id: string;
  versionId: string;
  label: string;
  trainedAt: string | null;
  isActive: boolean;
  isArchived: boolean;
};

type GestureHealthResponse = {
  ok?: boolean;
  trained_gestures?: boolean;
  trained_gestures_legacy?: boolean;
  trained_gestures_v2?: boolean;
};

function normalizeTranslatorModels(rawModels: any[]): TranslatorModelItem[] {
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
      const versionId =
        typeof info.version_id === "string"
          ? info.version_id
          : model.path.split("/").pop()?.replace(".json", "") ?? model.path;
      return {
        id: model.path,
        versionId,
        label:
          typeof info.label === "string"
            ? info.label
            : model.path.split("/").pop()?.replace(".json", "") ?? versionId,
        trainedAt: typeof info.trained_at === "string" ? info.trained_at : null,
        isActive: versionId === activeVersionId,
        isArchived: Boolean(model.is_archived || model.path.includes("archived_models/")),
      };
    })
    .filter((model) => !model.isArchived)
    .sort((a, b) => {
      const aTime = a.trainedAt ? new Date(a.trainedAt).getTime() : 0;
      const bTime = b.trainedAt ? new Date(b.trainedAt).getTime() : 0;
      return bTime - aTime;
    });
}

export default function CameraExperience({
  onBack,
  showHandOverlay = false,
}: CameraExperienceProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 24 : isSmall ? 14 : 18;
  const [mode, setMode] = useState<TranslatorMode>("letters");
  const [availableModels, setAvailableModels] = useState<TranslatorModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<TranslatorModelItem | null>(null);
  const [modelStatusMessage, setModelStatusMessage] = useState<string | null>(null);
  const [gestureHealth, setGestureHealth] = useState<GestureHealthResponse | null>(null);

  const cameraRuntime = useCameraRuntime();
  const recognitionRuntime = useRecognitionRuntime({
    enabled: cameraRuntime.ready && !!cameraRuntime.device && !!cameraRuntime.format,
    detectMode: mode === "letters" ? "LETTERS" : "WORDS",
  });

  const statusBarInset =
    Platform.OS === "android"
      ? cameraRuntime.statusBarInset
      : StatusBar.currentHeight ?? 0;
  const topStrongHeight = Math.max(28, statusBarInset + 8);
  const topMidHeight = 52;
  const topFadeHeight = topStrongHeight + topMidHeight + 14;
  const topBarTop = topStrongHeight + 2;
  const selectedModelLabel = selectedModel?.label ?? "None";

  async function fetchModels() {
    try {
      const response = await fetch(`${API_BASE}/models`);
      const payload = await response.json().catch(() => null);
      const rawModels = Array.isArray(payload?.models) ? payload.models : [];
      const normalized = normalizeTranslatorModels(rawModels);
      const preferredModel =
        normalized.find((model) => model.isActive) ?? normalized[0] ?? null;

      setAvailableModels(normalized);
      setSelectedModel(preferredModel);
      setModelStatusMessage(null);
    } catch (error) {
      console.log("Failed to fetch translator models", error);
      setModelStatusMessage("Unable to load models.");
    }
  }

  async function fetchGestureHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const payload = (await response.json()) as GestureHealthResponse;
      if (!response.ok || payload?.ok === false) {
        setGestureHealth(null);
        return;
      }
      setGestureHealth(payload);
    } catch (error) {
      console.log("Failed to fetch gesture health", error);
      setGestureHealth(null);
    }
  }

  useEffect(() => {
    void fetchModels();
    void fetchGestureHealth();
  }, []);

  useEffect(() => {
    if (!modelStatusMessage) {
      return;
    }
    const timeout = setTimeout(() => setModelStatusMessage(null), 2200);
    return () => clearTimeout(timeout);
  }, [modelStatusMessage]);

  async function handleSelectModel(modelId: string) {
    const model = availableModels.find((item) => item.id === modelId);
    if (!model || model.id === selectedModel?.id) {
      return;
    }

    try {
      setModelStatusMessage("Switching model...");
      const response = await fetch(`${API_BASE}/activate_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: model.versionId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        setModelStatusMessage(payload?.error ?? "Failed to switch model.");
        return;
      }

      await fetchModels();
      setModelStatusMessage(`Using ${model.label}.`);
    } catch (error) {
      console.log("Failed to activate translator model", error);
      setModelStatusMessage("Failed to switch model.");
    }
  }

  const hasGestureModel = !!(
    gestureHealth?.trained_gestures_v2 || gestureHealth?.trained_gestures_legacy
  );
  const gestureModelLabel = gestureHealth?.trained_gestures_v2
    ? "Gesture V2"
    : gestureHealth?.trained_gestures_legacy
      ? "Gesture Legacy"
      : "No gesture model";
  const displayedModelLabel = mode === "words" ? gestureModelLabel : selectedModelLabel;
  const displayedModelOptions =
    mode === "words"
      ? []
      : availableModels.map((model, index) => ({
          id: model.id,
          label: model.label,
          isLatest: index === 0,
        }));
  const modelEmptyStateMessage =
    mode === "words" && !hasGestureModel
      ? "No gesture model trained yet. Train one from the lab before using word translation."
      : null;

  return (
    <CameraShell
      CameraComponent={cameraRuntime.Camera}
      cameraLayout={cameraRuntime.cameraLayout}
      cameraPosition={cameraRuntime.cameraPosition}
      device={cameraRuntime.device}
      format={cameraRuntime.format}
      frameProcessor={recognitionRuntime.frameProcessor}
      latestHandFrame={recognitionRuntime.latestHandFrame}
      onBack={onBack}
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
      topPadding={horizontalPadding}
      torchEnabled={cameraRuntime.torchEnabled}
      unsupportedMessage={
        recognitionRuntime.isSupported
          ? null
          : "Streaming hand tracking requires an Android development build with the native hand tracker module."
      }
    >
      <TranslatorOverlay
        prediction={recognitionRuntime.prediction}
        mode={mode}
        onModeChange={setMode}
        modelLabel={displayedModelLabel}
        modelOptions={displayedModelOptions}
        onModelSelect={handleSelectModel}
        modelStatusMessage={modelStatusMessage}
        modelSelectable={mode !== "words"}
        modelEmptyStateMessage={modelEmptyStateMessage}
      />
    </CameraShell>
  );
}
