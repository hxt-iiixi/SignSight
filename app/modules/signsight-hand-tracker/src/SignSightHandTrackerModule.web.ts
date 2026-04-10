import type {
  DetectHandsPluginOptions,
  HandTrackingFrameResult,
  SignSightTrackingCapabilities,
  SignSightHandTrackerNativeModule,
} from "./SignSightHandTracker.types";

const SignSightHandTrackerModule: SignSightHandTrackerNativeModule = {
  getPluginName() {
    return "signsightDetectHands";
  },
  isSupported() {
    return false;
  },
  getTrackingCapabilities() {
    return {
      hands: false,
      upperBody: false,
      gestureV2: false,
    };
  },
};

export function isHandTrackingSupported(): boolean {
  return false;
}

export function getTrackingCapabilities(): SignSightTrackingCapabilities {
  return {
    hands: false,
    upperBody: false,
    gestureV2: false,
  };
}

export function isUpperBodyTrackingSupported(): boolean {
  return false;
}

export function detectHands(
  _frame: unknown,
  _options: DetectHandsPluginOptions = {}
): HandTrackingFrameResult | null {
  return null;
}

export default SignSightHandTrackerModule;
