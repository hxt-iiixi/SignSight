import { useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StatusBar } from "react-native";
import {
  Camera,
  type CameraDeviceFormat,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from "react-native-vision-camera";

const TARGET_CAMERA_FPS = 30;
const TARGET_VIDEO_FORMAT = { width: 640, height: 480 } as const;

export function useCameraRuntime() {
  const cameraRef = useRef<any>(null);
  const statusBarInset = StatusBar.currentHeight ?? 0;
  const { hasPermission, requestPermission } = useCameraPermission();
  const [ready, setReady] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });

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

  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
      }
      setReady(true);
    })();
  }, [hasPermission, requestPermission]);

  const onCameraLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCameraLayout((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height }
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

  const toggleTorch = () => {
    if (!device?.hasTorch) return;
    setTorchEnabled((value) => !value);
  };

  const flipCamera = () => {
    setCameraPosition((value) => (value === "back" ? "front" : "back"));
  };

  return {
    Camera,
    cameraRef,
    cameraLayout,
    cameraPosition,
    device,
    format,
    flipCamera,
    onCameraLayout,
    orientedFrame,
    ready,
    statusBarInset,
    toggleTorch,
    torchEnabled,
  };
}
