import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  StatusBar,
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

import { SPACING } from "../config/spacing";
import { TYPOGRAPHY } from "../config/typography";

const TARGET_CAMERA_FPS = 30;
const TARGET_VIDEO_FORMAT = { width: 640, height: 480 } as const;

type LabScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  showHandOverlay: boolean;
};

export default function LabScreen({
  onBack,
}: LabScreenProps) {
  const { width } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);

  const isSmall = width < 360;
  const isTablet = width >= 768;
  const statusBarInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const translatorTopStrongHeight = Math.max(30, statusBarInset + 8);
  const translatorTopMidHeight = 52;
  const translatorTopFadeHeight =
    translatorTopStrongHeight + translatorTopMidHeight + 14;
  const translatorTopBarTop = translatorTopStrongHeight + 2;

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
      .sort((a, b) => {
        const aPixels = a.videoWidth * a.videoHeight;
        const bPixels = b.videoWidth * b.videoHeight;
        return aPixels !== bPixels ? aPixels - bPixels : a.maxFps - b.maxFps;
      })[0];
  }, [device]);

  const format = preferredFormat ?? fallbackFormat;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted || cancelled) return;
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPermission, requestPermission]);

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
      <View style={styles.cameraSurface}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={true}
          photo={false}
          video={false}
          audio={false}
          torch={torchEnabled ? "on" : "off"}
          resizeMode="cover"
          pixelFormat="rgb"
        />

        <View style={[styles.topFade, { height: translatorTopFadeHeight }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="labTopFadeGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.8} />
                <Stop offset="0.35" stopColor="#000000" stopOpacity={0.30} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#labTopFadeGradient)" />
          </Svg>
        </View>

        <View style={[styles.topBar, { top: translatorTopBarTop, paddingHorizontal: isTablet ? 24 : isSmall ? 14 : 18 }]}>
          <View style={styles.topBarContent}>
            <View style={styles.topBarLeft}>
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
                  pressed && { opacity: 0.8 },
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

            <View style={styles.topBarRight}>
              <Pressable
                onPress={() =>
                  setCameraPosition((p) => (p === "back" ? "front" : "back"))
                }
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    position: "relative",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_SM,
    minWidth: 92,
    zIndex: 10,
  },
  topBarRight: {
    minWidth: 44,
    alignItems: "flex-end",
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: TYPOGRAPHY.TEXT_2XL,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    ...Platform.select({
      ios: {
        lineHeight: 44,
      },
      android: {
        textAlignVertical: "center",
      },
    }),
  },
});
