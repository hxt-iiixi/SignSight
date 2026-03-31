import { useEffect, useMemo, useRef, useState } from "react";
import { useFrameProcessor } from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";

import {
  detectHands,
  isHandTrackingSupported,
  type HandTrackingFrameResult,
} from "../../modules/signsight-hand-tracker";

type UseStreamingHandTrackingOptions = {
  enabled: boolean;
  onFrameTick?: () => void;
};

const HAND_PRESENCE_GRACE_MS = 400;

export type StreamingHandTrackingDebugState = {
  hasHand: boolean;
  landmarkCount: number;
  lastTimestampMs: number | null;
  lastValidTimestampMs: number | null;
  handLossGraceMs: number;
};

export function useStreamingHandTracking({
  enabled,
  onFrameTick,
}: UseStreamingHandTrackingOptions) {
  const [latestHandFrame, setLatestHandFrame] =
    useState<HandTrackingFrameResult | null>(null);
  const [debugState, setDebugState] = useState<StreamingHandTrackingDebugState>(
    {
      hasHand: false,
      landmarkCount: 0,
      lastTimestampMs: null,
      lastValidTimestampMs: null,
      handLossGraceMs: HAND_PRESENCE_GRACE_MS,
    }
  );
  const lastTimestampRef = useRef<number>(-1);
  const lastValidHandRef = useRef<HandTrackingFrameResult | null>(null);

  const onFrameTickJS = useMemo(
    () => (onFrameTick ? Worklets.createRunOnJS(onFrameTick) : null),
    [onFrameTick]
  );

  const onNativeResultJS = useMemo(
    () =>
      Worklets.createRunOnJS((result: HandTrackingFrameResult | null) => {
        if (!result) {
          return;
        }

        if (
          result.timestampMs === lastTimestampRef.current &&
          result.hasHand === latestHandFrame?.hasHand
        ) {
          return;
        }

        const landmarkCount = result.landmarks?.length ?? 0;
        const hasUsableHand = result.hasHand && landmarkCount === 21;
        const lastValidHand = lastValidHandRef.current;

        if (hasUsableHand) {
          lastValidHandRef.current = result;
          lastTimestampRef.current = result.timestampMs;
          setLatestHandFrame(result);
          setDebugState({
            hasHand: true,
            landmarkCount,
            lastTimestampMs: result.timestampMs,
            lastValidTimestampMs: result.timestampMs,
            handLossGraceMs: HAND_PRESENCE_GRACE_MS,
          });
          return;
        }

        if (
          lastValidHand &&
          result.timestampMs - lastValidHand.timestampMs <= HAND_PRESENCE_GRACE_MS
        ) {
          lastTimestampRef.current = result.timestampMs;
          setDebugState({
            hasHand: true,
            landmarkCount: lastValidHand.landmarks?.length ?? 0,
            lastTimestampMs: result.timestampMs,
            lastValidTimestampMs: lastValidHand.timestampMs,
            handLossGraceMs: HAND_PRESENCE_GRACE_MS,
          });
          return;
        }

        lastTimestampRef.current = result.timestampMs;
        lastValidHandRef.current = null;
        setLatestHandFrame(result);
        setDebugState({
          hasHand: false,
          landmarkCount,
          lastTimestampMs: result.timestampMs,
          lastValidTimestampMs: null,
          handLossGraceMs: HAND_PRESENCE_GRACE_MS,
        });
      }),
    [latestHandFrame?.hasHand]
  );

  useEffect(() => {
    if (enabled) {
      return;
    }

    lastTimestampRef.current = -1;
    lastValidHandRef.current = null;
    setLatestHandFrame(null);
    setDebugState({
      hasHand: false,
      landmarkCount: 0,
      lastTimestampMs: null,
      lastValidTimestampMs: null,
      handLossGraceMs: HAND_PRESENCE_GRACE_MS,
    });
  }, [enabled]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      if (!enabled) {
        return;
      }

      onFrameTickJS?.();

      const result = detectHands(frame, {
        minProcessIntervalMs: 24,
        maxResultAgeMs: 450,
      });

      if (result) {
        onNativeResultJS(result);
      }
    },
    [enabled, onFrameTickJS, onNativeResultJS]
  );

  return {
    frameProcessor,
    latestHandFrame,
    debugState,
    isSupported: isHandTrackingSupported(),
  };
}
