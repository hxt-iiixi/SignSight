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

export type UpperBodyEntry = {
  name: UpperBodyKeypointName;
  x: number;
  y: number;
  z: number;
  visibility?: number | null;
};

export type Handedness = "Left" | "Right";

export type DetectedHand = {
  landmarks: HandPoint[];
  handedness: Handedness | null;
  score?: number | null;
  area?: number | null;
};

export type SignSightTrackingCapabilities = {
  hands: boolean;
  upperBody: boolean;
  gestureV2: boolean;
};

export type HandTrackingFrameResult = {
  landmarks: HandPoint[] | null;
  handedness: Handedness | null;
  hands?: DetectedHand[] | null;
  upperBody: UpperBodyLandmarks | UpperBodyEntry[] | null;
  hasUpperBody: boolean;
  upperBodyCount?: number | null;
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
