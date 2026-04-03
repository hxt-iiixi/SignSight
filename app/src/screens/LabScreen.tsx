import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Camera,
  type CameraDeviceFormat,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from "react-native-vision-camera";

const TARGET_CAMERA_FPS = 30;
const TARGET_VIDEO_FORMAT = { width: 640, height: 480 } as const;

type LabScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  showHandOverlay: boolean;
};

export default function LabScreen({
  onBack: _onBack,
  debugEnabled: _debugEnabled,
  showHandOverlay: _showHandOverlay,
}: LabScreenProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);
  const device = useCameraDevice("back");

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
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={true}
        photo={false}
        video={false}
        audio={false}
        resizeMode="cover"
        pixelFormat="rgb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
});
