import React from "react";
import { Platform, StatusBar, useWindowDimensions } from "react-native";

import { CameraShell } from "../modules/camera/components/CameraShell";
import { useCameraRuntime } from "../modules/camera/hooks/useCameraRuntime";

type LabScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  showHandOverlay: boolean;
  children?: React.ReactNode;
};

export default function LabScreen({
  onBack,
  showHandOverlay,
  children,
}: LabScreenProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const cameraRuntime = useCameraRuntime();

  const statusBarInset =
    Platform.OS === "android"
      ? cameraRuntime.statusBarInset
      : StatusBar.currentHeight ?? 0;
  const topStrongHeight = Math.max(30, statusBarInset + 8);
  const topMidHeight = 52;
  const topFadeHeight = topStrongHeight + topMidHeight + 14;
  const topBarTop = topStrongHeight + 2;

  return (
    <CameraShell
      CameraComponent={cameraRuntime.Camera}
      cameraLayout={cameraRuntime.cameraLayout}
      cameraPosition={cameraRuntime.cameraPosition}
      device={cameraRuntime.device}
      format={cameraRuntime.format}
      latestHandFrame={null}
      onBack={onBack}
      onCameraLayout={cameraRuntime.onCameraLayout}
      onFlipCamera={cameraRuntime.flipCamera}
      onToggleTorch={cameraRuntime.toggleTorch}
      orientedFrame={cameraRuntime.orientedFrame}
      ready={cameraRuntime.ready}
      showHandOverlay={showHandOverlay}
      title="SignSight"
      topBarTop={topBarTop}
      topFadeHeight={topFadeHeight}
      topPadding={isTablet ? 24 : isSmall ? 14 : 18}
      torchEnabled={cameraRuntime.torchEnabled}
    >
      {children}
    </CameraShell>
  );
}
