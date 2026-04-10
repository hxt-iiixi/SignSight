import type {
  HandPoint,
  HandTrackingFrameResult,
  Handedness,
  UpperBodyLandmarks,
} from "../../modules/signsight-hand-tracker";

export type {
  HandPoint,
  HandTrackingFrameResult,
  Handedness,
  UpperBodyLandmarks,
};

export type DetectMode = "LETTERS" | "WORDS";

export type LandmarkSampleFrame = {
  landmarks: HandPoint[];
};

export type GestureV2SampleFrame = {
  handLandmarks: HandPoint[] | null;
  handedness: Handedness | null;
  upperBody: UpperBodyLandmarks | null;
  timestampMs: number;
};

export type StreamingRecognitionBuffers = {
  letterMotionFrames: LandmarkSampleFrame[];
  recordingFrames: LandmarkSampleFrame[];
  liveWordFrames: LandmarkSampleFrame[];
  gestureV2RecordingFrames: GestureV2SampleFrame[];
  gestureV2LiveFrames: GestureV2SampleFrame[];
  lastLetterMotionAtMs: number;
  lastWordPredictionAtMs: number;
  lastWordHandAtMs: number;
  wordNoHandSinceMs: number;
  wordMissCount: number;
};
