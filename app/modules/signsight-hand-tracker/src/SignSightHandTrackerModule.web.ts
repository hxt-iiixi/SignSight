import type {
  DetectHandsPluginOptions,
  HandTrackingFrameResult,
  SignSightHandTrackerNativeModule,
} from "./SignSightHandTracker.types";

const SignSightHandTrackerModule: SignSightHandTrackerNativeModule = {
  getPluginName() {
    return "signsightDetectHands";
  },
  isSupported() {
    return false;
  },
};

export function isHandTrackingSupported(): boolean {
  return false;
}

export function detectHands(
  _frame: unknown,
  _options: DetectHandsPluginOptions = {}
): HandTrackingFrameResult | null {
  return null;
}

export default SignSightHandTrackerModule;
