import { useEffect, useMemo, useRef, useState } from "react";
import { useFrameProcessor } from "react-native-vision-camera";
import { Worklets, useSharedValue } from "react-native-worklets-core";

import {
  detectHands,
  isHandTrackingSupported,
  type HandTrackingFrameResult,
} from "../../modules/signsight-hand-tracker";
import type { UpperBodyLandmarks } from "./streamTypes";

import type { DetectMode } from "./streamTypes";

type UseStreamingHandTrackingOptions = {
  enabled: boolean;
  detectMode?: DetectMode;
  onFrameTick?: () => void;
};

const HAND_PRESENCE_GRACE_MS = 400;

function normalizeUpperBody(
  upperBody: HandTrackingFrameResult["upperBody"]
): UpperBodyLandmarks | null {
  if (!upperBody) {
    return null;
  }

  if (Array.isArray(upperBody)) {
    const map: UpperBodyLandmarks = {};
    upperBody.forEach((entry) => {
      if (!entry?.name) {
        return;
      }
      map[entry.name] = {
        x: entry.x,
        y: entry.y,
        z: entry.z,
        visibility: entry.visibility ?? null,
      };
    });
    return Object.keys(map).length > 0 ? map : null;
  }

  return upperBody as UpperBodyLandmarks;
}

export type StreamingHandTrackingDebugState = {
  hasHand: boolean;
  hasUpperBody: boolean;
  upperBodyPointCount: number;
  landmarkCount: number;
  lastTimestampMs: number | null;
  lastValidTimestampMs: number | null;
  handLossGraceMs: number;
  approxFps: number | null;
};

export function useStreamingHandTracking({
  enabled,
  detectMode,
  onFrameTick,
}: UseStreamingHandTrackingOptions) {
  const [latestHandFrame, setLatestHandFrame] =
    useState<HandTrackingFrameResult | null>(null);
  const [debugState, setDebugState] = useState<StreamingHandTrackingDebugState>(
    {
      hasHand: false,
      hasUpperBody: false,
      upperBodyPointCount: 0,
      landmarkCount: 0,
      lastTimestampMs: null,
      lastValidTimestampMs: null,
      handLossGraceMs: HAND_PRESENCE_GRACE_MS,
      approxFps: null,
    }
  );
  const lastTimestampRef = useRef<number>(-1);
  const lastValidHandRef = useRef<HandTrackingFrameResult | null>(null);
  const emptyFrames = useSharedValue(0);

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

        const normalizedUpperBody = normalizeUpperBody(result.upperBody);
        const normalizedResult: HandTrackingFrameResult = {
          ...result,
          upperBody: normalizedUpperBody,
          hasUpperBody: result.hasUpperBody && !!normalizedUpperBody,
        };

        if (
          result.timestampMs === lastTimestampRef.current &&
          normalizedResult.hasHand === latestHandFrame?.hasHand &&
          normalizedResult.hasUpperBody === latestHandFrame?.hasUpperBody
        ) {
          return;
        }

        const previousTimestamp = lastTimestampRef.current;
        const approxFps =
          previousTimestamp > 0 && result.timestampMs > previousTimestamp
            ? Math.round(1000 / (result.timestampMs - previousTimestamp))
            : null;

        const landmarkCount = result.landmarks?.length ?? 0;
        const upperBodyPointCount =
          typeof normalizedResult.upperBodyCount === "number"
            ? normalizedResult.upperBodyCount
            : normalizedUpperBody
              ? Object.values(normalizedUpperBody).filter(Boolean).length
              : 0;
        const hasUsableHand = result.hasHand && landmarkCount === 21;
        const lastValidHand = lastValidHandRef.current;

        if (hasUsableHand) {
          lastValidHandRef.current = normalizedResult;
          lastTimestampRef.current = normalizedResult.timestampMs;
          setLatestHandFrame(normalizedResult);
          setDebugState({
            hasHand: true,
            hasUpperBody: normalizedResult.hasUpperBody,
            upperBodyPointCount,
            landmarkCount,
            lastTimestampMs: normalizedResult.timestampMs,
            lastValidTimestampMs: normalizedResult.timestampMs,
            handLossGraceMs: HAND_PRESENCE_GRACE_MS,
            approxFps,
          });
          return;
        }

        if (
          lastValidHand &&
          normalizedResult.timestampMs - lastValidHand.timestampMs <= HAND_PRESENCE_GRACE_MS
        ) {
          const mergedResult: HandTrackingFrameResult = {
            ...lastValidHand,
            upperBody: normalizedResult.hasUpperBody
              ? normalizedUpperBody
              : lastValidHand.upperBody,
            hasUpperBody: normalizedResult.hasUpperBody || lastValidHand.hasUpperBody,
            upperBodyCount: normalizedResult.upperBodyCount ?? lastValidHand.upperBodyCount,
            timestampMs: normalizedResult.timestampMs,
            sequenceId: normalizedResult.sequenceId ?? lastValidHand.sequenceId,
          };
          lastTimestampRef.current = normalizedResult.timestampMs;
          setLatestHandFrame(mergedResult);
          setDebugState({
            hasHand: true,
            hasUpperBody: mergedResult.hasUpperBody,
            upperBodyPointCount:
              typeof mergedResult.upperBodyCount === "number"
                ? mergedResult.upperBodyCount
                : mergedResult.upperBody
                  ? Object.values(mergedResult.upperBody).filter(Boolean).length
                  : 0,
            landmarkCount: lastValidHand.landmarks?.length ?? 0,
            lastTimestampMs: normalizedResult.timestampMs,
            lastValidTimestampMs: lastValidHand.timestampMs,
            handLossGraceMs: HAND_PRESENCE_GRACE_MS,
            approxFps,
          });
          return;
        }

        lastTimestampRef.current = normalizedResult.timestampMs;
        lastValidHandRef.current = null;
        setLatestHandFrame(normalizedResult);
        setDebugState({
          hasHand: false,
          hasUpperBody: normalizedResult.hasUpperBody,
          upperBodyPointCount,
          landmarkCount,
          lastTimestampMs: normalizedResult.timestampMs,
          lastValidTimestampMs: null,
          handLossGraceMs: HAND_PRESENCE_GRACE_MS,
          approxFps,
        });
      }),
    [latestHandFrame?.hasHand]
  );

  useEffect(() => {
    if (enabled) {
      return;
    }

    emptyFrames.value = 0;
    lastTimestampRef.current = -1;
    lastValidHandRef.current = null;
    setLatestHandFrame(null);
    setDebugState({
      hasHand: false,
      hasUpperBody: false,
      upperBodyPointCount: 0,
      landmarkCount: 0,
      lastTimestampMs: null,
      lastValidTimestampMs: null,
      handLossGraceMs: HAND_PRESENCE_GRACE_MS,
      approxFps: null,
    });
  }, [enabled]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      if (!enabled) {
        return;
      }

      onFrameTickJS?.();

      // Adaptive frame interval logic
      // ~33 FPS during active use, ~10 FPS when idle
      const intervalMs = emptyFrames.value > 15 ? 100 : 30;

      const result = detectHands(frame, {
        minProcessIntervalMs: intervalMs,
        maxResultAgeMs: 450,
        runPoseLandmarker: detectMode === "WORDS",
      });

      if (result) {
        if (result.hasHand || result.hasUpperBody) {
          emptyFrames.value = 0;
        } else {
          emptyFrames.value = emptyFrames.value + 1;
        }
        onNativeResultJS(result);
      }
    },
    [enabled, detectMode, onFrameTickJS, onNativeResultJS, emptyFrames]
  );

  return {
    frameProcessor,
    latestHandFrame,
    debugState,
    isSupported: isHandTrackingSupported(),
  };
}
