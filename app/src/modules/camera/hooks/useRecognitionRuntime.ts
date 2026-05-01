import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE } from "../../../config/api";
import {
  createStreamingRecognitionBuffers,
  processStreamingHandFrame,
  resetStreamingRecognitionState,
} from "../../../ml/streamingRecognition";
import { MajorityVoteSmoother } from "../../../ml/smoother";
import type { DetectMode } from "../../../ml/streamTypes";
import { useStreamingHandTracking } from "../../../ml/useStreamingHandTracking";
import type { PredictionViewModel } from "../../../shared/types/mobile";

export function useRecognitionRuntime({
  detectMode = "LETTERS",
  enabled,
  isRecordingGesture = false,
}: {
  detectMode?: DetectMode;
  enabled: boolean;
  isRecordingGesture?: boolean;
}) {
  const [prediction, setPrediction] = useState<PredictionViewModel>({
    label: "Ready",
    confidence: 0,
    rawLabel: "?",
    handedness: null,
    hasHand: false,
  });
  const [liveGestureFramesCount, setLiveGestureFramesCount] = useState(0);
  const [recordingGestureFramesCount, setRecordingGestureFramesCount] = useState(0);
  const [wordGraceActive, setWordGraceActive] = useState(false);
  const [lastGesturePredictionAtMs, setLastGesturePredictionAtMs] = useState<number | null>(
    null
  );

  const buffersRef = useRef(createStreamingRecognitionBuffers());
  const smootherRef = useRef(new MajorityVoteSmoother(3));
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  const { debugState, frameProcessor, isSupported, latestHandFrame } =
    useStreamingHandTracking({
      enabled,
      detectMode,
      onFrameTick: () => {},
    });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    resetStreamingRecognitionState(buffersRef, smootherRef, {
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf: (confidence: number) =>
        setPrediction((current) => (current.confidence === confidence ? current : { ...current, confidence })),
      setLastGesturePredictionAtMs,
      setLastLabel: (label: string) =>
        setPrediction((current) => (current.label === label ? current : { ...current, label })),
      setRawLabel: (rawLabel: string) =>
        setPrediction((current) => (current.rawLabel === rawLabel ? current : { ...current, rawLabel })),
    });
  }, [detectMode]);

  useEffect(() => {
    if (enabled) {
      return;
    }

    resetStreamingRecognitionState(buffersRef, smootherRef, {
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf: (confidence: number) =>
        setPrediction((current) => (current.confidence === confidence ? current : { ...current, confidence })),
      setLastGesturePredictionAtMs,
      setLastLabel: (label: string) =>
        setPrediction((current) => (current.label === label ? current : { ...current, label })),
      setRawLabel: (rawLabel: string) =>
        setPrediction((current) => (current.rawLabel === rawLabel ? current : { ...current, rawLabel })),
    });
  }, [enabled]);

  useEffect(() => {
    setPrediction((current) => ({
      ...current,
      hasHand: !!latestHandFrame?.hasHand,
    }));

    if (!latestHandFrame) return;

    void processStreamingHandFrame(latestHandFrame, {
      apiBase: API_BASE,
      buffersRef,
      detectMode,
      isMountedRef,
      isProcessingRef,
      isRecordingGesture,
      setLiveGestureFramesCount,
      setRecordingGestureFramesCount,
      setWordGraceActive,
      setLastConf: (confidence: number) =>
        setPrediction((current) => (current.confidence === confidence ? current : { ...current, confidence })),
      setLastGesturePredictionAtMs,
      setLastHandedness: (handedness: string | null) =>
        setPrediction((current) => (current.handedness === handedness ? current : {
          ...current,
          handedness: handedness as PredictionViewModel["handedness"],
        })),
      setLastLabel: (label: string) =>
        setPrediction((current) => (current.label === label ? current : { ...current, label })),
      setRawLabel: (rawLabel: string) =>
        setPrediction((current) => (current.rawLabel === rawLabel ? current : { ...current, rawLabel })),
      smootherRef,
      onPredictionAttempt: () => {},
    });
  }, [latestHandFrame, detectMode, isRecordingGesture]);

  const resetGestureRecording = useCallback(() => {
    buffersRef.current.recordingFrames = [];
    buffersRef.current.gestureV2RecordingFrames = [];
    setRecordingGestureFramesCount(0);
  }, []);

  return {
    debugState,
    frameProcessor,
    getGestureRecordingFrames: () => [...buffersRef.current.recordingFrames],
    getGestureRecordingFramesV2: () => [...buffersRef.current.gestureV2RecordingFrames],
    isSupported,
    lastGesturePredictionAtMs,
    liveGestureFramesCount,
    latestHandFrame,
    prediction,
    recordingGestureFramesCount,
    resetGestureRecording,
    wordGraceActive,
  };
}
