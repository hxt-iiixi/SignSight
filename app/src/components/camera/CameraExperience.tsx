import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  Camera,
  type CameraDeviceFormat,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from "react-native-vision-camera";

import HandLandmarkOverlay from "../HandLandmarkOverlay";
import { API_BASE } from "../../config/api";
import { createStreamingRecognitionBuffers, processStreamingHandFrame, resetStreamingRecognitionState } from "../../ml/streamingRecognition";
import { MajorityVoteSmoother } from "../../ml/smoother";
import type { DetectMode } from "../../ml/streamTypes";
import { useStreamingHandTracking } from "../../ml/useStreamingHandTracking";
import { SPACING } from "../../config/spacing";
import { TYPOGRAPHY } from "../../config/typography";

export type CameraExperienceProps = {
  onBack: () => void;
  debugEnabled?: boolean;
  showHandOverlay?: boolean;
};

const BG = "#F8F9FA";
const TEXT = "#191C1D";
const TARGET_CAMERA_FPS = 30;
const TARGET_VIDEO_FORMAT = { width: 640, height: 480 } as const;

export default function CameraExperience(props: CameraExperienceProps) {
  const { onBack, showHandOverlay = false } = props;
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 24 : isSmall ? 14 : 18;
  const statusBarInset = StatusBar.currentHeight ?? 0;

  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });

  const [, setLastLabel] = useState("Ready");
  const [, setLastConf] = useState(0);
  const [, setRawLabel] = useState("?");
  const [, setLastHandedness] = useState<string | null>(null);
  const [, setLiveGestureFramesCount] = useState(0);
  const [, setRecordingGestureFramesCount] = useState(0);
  const [, setWordGraceActive] = useState(false);
  const [, setLastGesturePredictionAtMs] = useState<number | null>(null);

  const detectMode: DetectMode = "LETTERS";
  const isRecordingGesture = false;
  const buffersRef = useRef(createStreamingRecognitionBuffers());
  const smootherRef = useRef(new MajorityVoteSmoother(3));
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  const device = useCameraDevice(cameraPosition);
  const preferredFormat = useCameraFormat(device, [
    { fps: TARGET_CAMERA_FPS },
    { videoResolution: TARGET_VIDEO_FORMAT },
    { videoAspectRatio: TARGET_VIDEO_FORMAT.width / TARGET_VIDEO_FORMAT.height },
  ]);

  const fallbackFormat = useMemo<CameraDeviceFormat | undefined>(() => {
    if (!device) return undefined;
    return [...device.formats]
      .filter((candidate) => candidate.maxFps >= TARGET_CAMERA_FPS)
      .sort((left, right) => {
        const leftPixels = left.videoWidth * left.videoHeight;
        const rightPixels = right.videoWidth * right.videoHeight;
        return leftPixels !== rightPixels ? leftPixels - rightPixels : left.maxFps - right.maxFps;
      })[0];
  }, [device]);

  const format = preferredFormat ?? fallbackFormat;

  const { frameProcessor, latestHandFrame, isSupported } = useStreamingHandTracking({
    enabled: ready && !!device && !!format,
    onFrameTick: () => {},
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
      }
      setReady(true);
    })();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    resetStreamingRecognitionState(buffersRef, smootherRef, {
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf,
      setLastGesturePredictionAtMs,
      setLastLabel,
      setRawLabel,
    });
  }, []);

  useEffect(() => {
    if (!latestHandFrame) return;

    void processStreamingHandFrame(latestHandFrame, {
      apiBase: API_BASE,
      buffersRef,
      detectMode,
      isMountedRef,
      isProcessingRef,
      isRecordingGesture,
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf,
      setLastGesturePredictionAtMs,
      setLastHandedness,
      setLastLabel,
      setRawLabel,
      smootherRef,
      onPredictionAttempt: () => {},
    });
  }, [latestHandFrame]);

  const onCameraLayout = (event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setCameraLayout((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : { width: nextWidth, height: nextHeight }
    );
  };

  const orientedFrame = useMemo(() => {
    if (!format) return { width: 0, height: 0 };
    const previewIsPortrait = cameraLayout.height >= cameraLayout.width;
    const formatIsPortrait = format.videoHeight >= format.videoWidth;
    if (previewIsPortrait !== formatIsPortrait) {
      return { width: format.videoHeight, height: format.videoWidth };
    }
    return { width: format.videoWidth, height: format.videoHeight };
  }, [cameraLayout.height, cameraLayout.width, format]);

  const topStrongHeight = Math.max(28, statusBarInset + 8);
  const topMidHeight = 52;
  const topFadeHeight = topStrongHeight + topMidHeight + 14;
  const topBarTop = topStrongHeight + 2;

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
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={true}
          photo={false}
          video={false}
          audio={false}
          torch={torchEnabled ? "on" : "off"}
          frameProcessor={frameProcessor}
          isMirrored={cameraPosition === "front"}
          resizeMode="cover"
          pixelFormat="rgb"
        />

        <HandLandmarkOverlay
          landmarks={latestHandFrame?.hasHand ? latestHandFrame.landmarks : null}
          landmarkTimestampMs={latestHandFrame?.timestampMs ?? null}
          cameraPosition={cameraPosition}
          previewWidth={cameraLayout.width}
          previewHeight={cameraLayout.height}
          frameWidth={orientedFrame.width}
          frameHeight={orientedFrame.height}
          onSmoothingChange={() => {}}
          visible={
            showHandOverlay &&
            !!latestHandFrame?.hasHand &&
            (latestHandFrame?.landmarks?.length ?? 0) === 21
          }
        />

        <View style={[styles.topFade, { height: topFadeHeight }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="cameraTopFadeGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.8} />
                <Stop offset="0.35" stopColor="#000000" stopOpacity={0.28} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#cameraTopFadeGradient)" />
          </Svg>
        </View>

        <View style={[styles.topBar, { top: topBarTop, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.topBarContent}>
            <View style={styles.topBarSide}>
              <Pressable onPress={onBack} style={styles.iconButton}>
                <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!device?.hasTorch) return;
                  setTorchEnabled((value) => !value);
                }}
                style={({ pressed }) => [
                  styles.iconButton,
                  !device?.hasTorch && styles.iconButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={torchEnabled ? "flash" : "flash-off"}
                  size={24}
                  color={torchEnabled ? "#FDE68A" : "#FFFFFF"}
                />
              </Pressable>
            </View>

            <Text style={styles.title}>SignSight</Text>

            <View style={[styles.topBarSide, styles.topBarSideRight]}>
              <Pressable
                onPress={() => setCameraPosition((value) => (value === "back" ? "front" : "back"))}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {!isSupported ? (
          <View style={styles.unsupportedBanner}>
            <Text style={styles.unsupportedText}>
              Streaming hand tracking requires an Android development build with the native hand tracker module.
            </Text>
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
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBarContent: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarSide: {
    position: "absolute",
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
  },
  topBarSideRight: {
    left: undefined,
    right: 0,
  },
  title: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.TEXT_2XL,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
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
