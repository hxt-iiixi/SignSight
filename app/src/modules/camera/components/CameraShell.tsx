import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import HandLandmarkOverlay from "../../../components/HandLandmarkOverlay";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";
import type { DetectMode, HandTrackingFrameResult } from "../../../ml/streamTypes";
import { CameraTopBar } from "./CameraTopBar";

const BG = "#F8F9FA";
const TEXT = "#191C1D";

export function CameraShell({
  CameraComponent,
  cameraActive = true,
  cameraRef,
  cameraLayout,
  cameraPosition,
  children,
  debugMenuItems,
  device,
  format,
  frameProcessor,
  frozenBackdropUri,
  latestHandFrame,
  onBack,
  onCameraLayout,
  onFlipCamera,
  onToggleTorch,
  orientedFrame,
  overlayVisible = false,
  overlayMode = "LETTERS",
  showFullBodyOverlay = false,
  ready,
  showHandOverlay,
  showFlipCamera = true,
  showTorch = true,
  title,
  topBarTop,
  topBarVariant = "dark",
  topFadeHeight,
  topPadding,
  torchEnabled,
  unsupportedMessage,
}: {
  CameraComponent: typeof import("react-native-vision-camera").Camera;
  cameraActive?: boolean;
  cameraRef?: React.RefObject<any> | null;
  cameraLayout: { width: number; height: number };
  cameraPosition: "back" | "front";
  children?: React.ReactNode;
  debugMenuItems?: Array<{
    id: string;
    icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
    active?: boolean;
    onPress: () => void;
  }>;
  device: any;
  format: any;
  frameProcessor?: any;
  frozenBackdropUri?: string | null;
  latestHandFrame: HandTrackingFrameResult | null;
  onBack: () => void;
  onCameraLayout: (event: any) => void;
  onFlipCamera: () => void;
  onToggleTorch: () => void;
  orientedFrame: { width: number; height: number };
  overlayVisible?: boolean;
  overlayMode?: DetectMode;
  showFullBodyOverlay?: boolean;
  ready: boolean;
  showHandOverlay: boolean;
  showFlipCamera?: boolean;
  showTorch?: boolean;
  title: string;
  topBarTop: number;
  topBarVariant?: "dark" | "light";
  topFadeHeight: number;
  topPadding: number;
  torchEnabled: boolean;
  unsupportedMessage?: string | null;
}) {
  if (!device || !format) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Loading camera…</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Camera permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraSurface} onLayout={onCameraLayout}>
        {frozenBackdropUri && !cameraActive ? (
          <Image
            source={{ uri: frozenBackdropUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <CameraComponent
            ref={cameraRef as any}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={cameraActive}
            photo={true}
            video={false}
            audio={false}
            torch={torchEnabled ? "on" : "off"}
            frameProcessor={frameProcessor}
            isMirrored={cameraPosition === "front"}
            resizeMode="cover"
            pixelFormat="rgb"
          />
        )}

        <HandLandmarkOverlay
          landmarks={latestHandFrame?.hasHand ? latestHandFrame.landmarks : null}
          hands={latestHandFrame?.hasHand ? latestHandFrame.hands ?? null : null}
          upperBody={latestHandFrame?.hasUpperBody ? (latestHandFrame.upperBody as any) : null}
          fullBody={
            latestHandFrame?.hasUpperBody && Array.isArray(latestHandFrame.upperBody)
              ? (latestHandFrame.upperBody as any)
              : null
          }
          landmarkTimestampMs={latestHandFrame?.timestampMs ?? null}
          cameraPosition={cameraPosition}
          previewWidth={cameraLayout.width}
          previewHeight={cameraLayout.height}
          frameWidth={orientedFrame.width}
          frameHeight={orientedFrame.height}
          overlayMode={overlayMode === "WORDS" ? "gesture" : "hand"}
          showFullBody={showFullBodyOverlay}
          onSmoothingChange={() => {}}
          visible={
            showHandOverlay &&
            overlayVisible &&
            ((overlayMode === "WORDS" &&
              (!!latestHandFrame?.hasUpperBody ||
                (!!latestHandFrame?.hasHand &&
                  (latestHandFrame?.landmarks?.length ?? 0) === 21))) ||
              (!!latestHandFrame?.hasHand &&
                (latestHandFrame?.landmarks?.length ?? 0) === 21))
          }
        />

        <View style={[styles.topFade, { height: topFadeHeight }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="cameraShellTopFadeGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.8} />
                <Stop offset="0.35" stopColor="#000000" stopOpacity={0.28} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#cameraShellTopFadeGradient)" />
          </Svg>
        </View>

        <CameraTopBar
          title={title}
          canToggleTorch={!!device?.hasTorch}
          debugMenuItems={debugMenuItems}
          horizontalPadding={topPadding}
          onBack={onBack}
          onFlipCamera={onFlipCamera}
          onToggleTorch={onToggleTorch}
          showFlipCamera={showFlipCamera}
          showTorch={showTorch}
          top={topBarTop}
          torchEnabled={torchEnabled}
          variant={topBarVariant}
        />

        {children}

        {unsupportedMessage ? (
          <View style={styles.unsupportedBanner}>
            <Text style={styles.unsupportedText}>{unsupportedMessage}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  cameraSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    paddingHorizontal: SPACING.SPACE_LG,
  },
  centerText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_MD,
    textAlign: "center",
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  unsupportedBanner: {
    position: "absolute",
    left: SPACING.SPACE_MD,
    right: SPACING.SPACE_MD,
    bottom: SPACING.SPACE_XL,
    padding: SPACING.SPACE_SM,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  unsupportedText: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_XS,
    fontWeight: "700",
    lineHeight: 18,
  },
});
