import type {
  HandPoint,
  HandTrackingFrameResult,
  Handedness,
} from "../../modules/signsight-hand-tracker";

export type { HandPoint, HandTrackingFrameResult, Handedness };

export type DetectMode = "LETTERS" | "WORDS";

export type LandmarkSampleFrame = {
  landmarks: HandPoint[];
};

export type StreamingRecognitionBuffers = {
  letterMotionFrames: LandmarkSampleFrame[];
  recordingFrames: LandmarkSampleFrame[];
  liveWordFrames: LandmarkSampleFrame[];
  lastLetterMotionAtMs: number;
  lastWordPredictionAtMs: number;
  lastWordHandAtMs: number;
  wordNoHandSinceMs: number;
  wordMissCount: number;
};
