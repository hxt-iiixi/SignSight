import React from "react";
import { Platform, StatusBar, useWindowDimensions } from "react-native";

import { CameraShell } from "../../modules/camera/components/CameraShell";
import { RecognitionOverlay } from "../../modules/camera/components/RecognitionOverlay";
import { useCameraRuntime } from "../../modules/camera/hooks/useCameraRuntime";
import { useRecognitionRuntime } from "../../modules/camera/hooks/useRecognitionRuntime";

export type CameraExperienceProps = {
  onBack: () => void;
  debugEnabled?: boolean;
  showHandOverlay?: boolean;
};

export default function CameraExperience({
  onBack,
  showHandOverlay = false,
}: CameraExperienceProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 24 : isSmall ? 14 : 18;

  const cameraRuntime = useCameraRuntime();
  const recognitionRuntime = useRecognitionRuntime({
    enabled: cameraRuntime.ready && !!cameraRuntime.device && !!cameraRuntime.format,
    detectMode: "LETTERS",
  });

  const statusBarInset =
    Platform.OS === "android"
      ? cameraRuntime.statusBarInset
      : StatusBar.currentHeight ?? 0;
  const topStrongHeight = Math.max(28, statusBarInset + 8);
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
      <RecognitionOverlay prediction={recognitionRuntime.prediction} />
    </CameraShell>
  );
}
