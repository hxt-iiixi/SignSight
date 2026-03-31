import { useMemo, useRef, useState } from "react";
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

export function useStreamingHandTracking({
  enabled,
  onFrameTick,
}: UseStreamingHandTrackingOptions) {
  const [latestHandFrame, setLatestHandFrame] =
    useState<HandTrackingFrameResult | null>(null);
  const lastTimestampRef = useRef<number>(-1);

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

        if (result.timestampMs === lastTimestampRef.current) {
          return;
        }

        lastTimestampRef.current = result.timestampMs;
        setLatestHandFrame(result);
      }),
    []
  );

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
    isSupported: isHandTrackingSupported(),
  };
}
