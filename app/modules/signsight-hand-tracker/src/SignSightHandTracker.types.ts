export type HandPoint = {
  x: number;
  y: number;
  z: number;
};

export type Handedness = "Left" | "Right";

export type HandTrackingFrameResult = {
  landmarks: HandPoint[] | null;
  handedness: Handedness | null;
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
};
