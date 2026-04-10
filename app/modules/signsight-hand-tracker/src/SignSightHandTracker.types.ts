export type HandPoint = {
  x: number;
  y: number;
  z: number;
};

export type UpperBodyKeypointName =
  | "nose"
  | "leftEar"
  | "rightEar"
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "leftHip"
  | "rightHip";

export type UpperBodyPoint = {
  x: number;
  y: number;
  z: number;
  visibility?: number | null;
};

export type UpperBodyLandmarks = Partial<
  Record<UpperBodyKeypointName, UpperBodyPoint | null>
>;

export type Handedness = "Left" | "Right";

export type SignSightTrackingCapabilities = {
  hands: boolean;
  upperBody: boolean;
  gestureV2: boolean;
};

export type HandTrackingFrameResult = {
  landmarks: HandPoint[] | null;
  handedness: Handedness | null;
  upperBody: UpperBodyLandmarks | null;
  hasUpperBody: boolean;
  timestampMs: number;
  hasHand: boolean;
  sequenceId?: number;
};

export type DetectHandsPluginOptions = {
  minProcessIntervalMs?: number;
  maxResultAgeMs?: number;
};

export type SignSightHandTrackerNativeModule = {
  getPluginName(): string;
  isSupported(): boolean;
  getTrackingCapabilities(): SignSightTrackingCapabilities;
};
