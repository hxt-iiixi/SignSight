import React, { useCallback, useEffect, useState } from "react";
import { Platform, StatusBar, useWindowDimensions, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import { API_BASE } from "../../../config/api";
import { CameraShell } from "../../../modules/camera/components/CameraShell";
import { useCameraRuntime } from "../../../modules/camera/hooks/useCameraRuntime";
import { useRecognitionRuntime } from "../../../modules/camera/hooks/useRecognitionRuntime";
import LabScreen from "../../../screens/LabScreen";
import { CaptureCard, type Mode, type ModelItem } from "../components/CaptureCard";
import { useLabCaptureStore } from "../state/useLabCaptureStore";

type LabTabParamList = {
  CaptureTab: undefined;
  DatasetTab: undefined;
  ModelsTab: undefined;
  MetricsTab: undefined;
};

const Tab = createBottomTabNavigator<LabTabParamList>();

function CaptureTabScreen({
  mode,
  cameraPaused,
  recognitionPaused,
}: {
  mode: Mode;
  cameraPaused: boolean;
  recognitionPaused: boolean;
}) {
  const navigation = useNavigation<any>();
  const { showHandOverlay } = useAppSettings();
  const setPrediction = useLabCaptureStore((state) => state.setPrediction);
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const cameraRuntime = useCameraRuntime();
  const recognitionRuntime = useRecognitionRuntime({
    enabled:
      cameraRuntime.ready &&
      !!cameraRuntime.device &&
      !!cameraRuntime.format &&
      !recognitionPaused,
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

  useEffect(() => {
    setPrediction(recognitionRuntime.prediction);
  }, [recognitionRuntime.prediction, setPrediction]);

  return (
    <CameraShell
      CameraComponent={cameraRuntime.Camera}
      cameraActive={!cameraPaused}
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
    />
  );
}

function LabTabContentScreen() {
  const navigation = useNavigation<any>();
  const { debugEnabled, showHandOverlay } = useAppSettings();

  return (
    <LabScreen
      onBack={() => navigation.goBack()}
      debugEnabled={debugEnabled}
      showHandOverlay={showHandOverlay}
    />
  );
}

function getLabTabIcon(routeName: keyof LabTabParamList) {
  if (routeName === "CaptureTab") return "camera-outline" as const;
  if (routeName === "DatasetTab") return "albums-outline" as const;
  if (routeName === "ModelsTab") return "cube-outline" as const;
  return "stats-chart-outline" as const;
}

export default function LabDeveloperScreen() {
  const [activeTab, setActiveTab] = useState<keyof LabTabParamList>("CaptureTab");
  const [mode, setMode] = useState<Mode>("letters");
  const [activeModelLabel, setActiveModelLabel] = useState<string>("None");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isActivatingModel, setIsActivatingModel] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const prediction = useLabCaptureStore((state) => state.prediction);
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;
  const tabBarHeight = 72 + bottomNavPadding;

  const handleActivateModel = useCallback(async (model: ModelItem) => {
    const versionId = model.rawInfo?.version_id;
    if (!versionId) {
      setActivationError("The selected model is missing a version id.");
      return false;
    }

    try {
      setIsActivatingModel(true);
      setActivationError(null);

      const response = await fetch(`${API_BASE}/activate_landmark_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        setActivationError(payload?.error ?? `Failed to activate model (${response.status}).`);
        return false;
      }

      setActiveModelLabel(model.label);
      return true;
    } catch (error: any) {
      setActivationError(error?.message ?? "Failed to activate model.");
      return false;
    } finally {
      setIsActivatingModel(false);
    }
  }, []);

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
          listeners={{ focus: () => setActiveTab("CaptureTab") }}
          options={{ title: "Capture" }}
        >
          {() => (
            <CaptureTabScreen
              mode={mode}
              cameraPaused={isSheetOpen}
              recognitionPaused={isSheetOpen}
            />
          )}
        </Tab.Screen>
        
        <Tab.Screen
          name="DatasetTab"
          component={LabTabContentScreen}
          listeners={{ focus: () => setActiveTab("DatasetTab") }}
          options={{ title: "Dataset" }}
        />
        <Tab.Screen
          name="ModelsTab"
          component={LabTabContentScreen}
          listeners={{ focus: () => setActiveTab("ModelsTab") }}
          options={{ title: "Models" }}
        />
        <Tab.Screen
          name="MetricsTab"
          component={LabTabContentScreen}
          listeners={{ focus: () => setActiveTab("MetricsTab") }}
          options={{ title: "Metrics" }}
        />
      </Tab.Navigator>

      {activeTab === "CaptureTab" ? (
        <CaptureCard
          mode={mode}
          onModeChange={setMode}
          prediction={prediction}
          activeModelLabel={activeModelLabel}
          activationError={activationError}
          isActivatingModel={isActivatingModel}
          onActivateModel={handleActivateModel}
          bottomOffset={tabBarHeight}
          onSheetOpenChange={setIsSheetOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
