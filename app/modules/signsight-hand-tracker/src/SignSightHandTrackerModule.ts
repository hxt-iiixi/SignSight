import { requireOptionalNativeModule } from "expo-modules-core";
import { VisionCameraProxy, type Frame } from "react-native-vision-camera";

import type {
  DetectHandsPluginOptions,
  HandTrackingFrameResult,
  SignSightHandTrackerNativeModule,
} from "./SignSightHandTracker.types";

const nativeModule =
  requireOptionalNativeModule<SignSightHandTrackerNativeModule>(
    "SignSightHandTracker"
  );

const pluginName = nativeModule?.getPluginName?.() ?? "signsightDetectHands";
const plugin = VisionCameraProxy.initFrameProcessorPlugin(pluginName, {});

export function isHandTrackingSupported(): boolean {
  return nativeModule?.isSupported?.() === true && plugin != null;
}

export function detectHands(
  frame: Frame,
  options: DetectHandsPluginOptions = {}
): HandTrackingFrameResult | null {
  "worklet";

  if (plugin == null) {
    return null;
  }

  const result = plugin.call(frame, options) as unknown as
    | HandTrackingFrameResult
    | null
    | undefined;

  return result ?? null;
}

export default nativeModule;
