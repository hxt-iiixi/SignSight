import type { MutableRefObject } from "react";

import { MajorityVoteSmoother } from "./smoother";
import type {
  DetectMode,
  HandTrackingFrameResult,
  StreamingRecognitionBuffers,
} from "./streamTypes";

export const LETTER_MOTION_FRAMES = 10;
export const LETTER_MOTION_INTERVAL_MS = 140;
export const GESTURE_FRAMES = 12;
export const WORD_PREDICT_INTERVAL_MS = 140;
export const MIN_PREDICT_FRAMES = 5;
export const LETTER_CONFIDENCE_THRESHOLD = 0.6;
export const WORD_CONFIDENCE_THRESHOLD = 0.55;
export const LETTER_MOTION_CONFIDENCE_THRESHOLD = 0.75;

type SetState<T> = (value: T) => void;

type RecognitionCallbacks = {
  setGestureFramesCount: SetState<number>;
  setLastConf: SetState<number>;
  setLastHandedness: SetState<string | null>;
  setLastLabel: SetState<string>;
  setRawLabel: SetState<string>;
};

type RecognitionRefs = {
  buffersRef: MutableRefObject<StreamingRecognitionBuffers>;
  isMountedRef: MutableRefObject<boolean>;
  isProcessingRef: MutableRefObject<boolean>;
  smootherRef: MutableRefObject<MajorityVoteSmoother>;
};

type RecognitionContext = RecognitionCallbacks &
  RecognitionRefs & {
    apiBase: string;
    detectMode: DetectMode;
    isRecordingGesture: boolean;
    onPredictionAttempt?: (kind: "landmarks" | "gesture") => void;
  };

export function createStreamingRecognitionBuffers(): StreamingRecognitionBuffers {
  return {
    letterMotionFrames: [],
    recordFrames: [],
    predictFrames: [],
    lastLetterMotionAtMs: 0,
    lastGestureAtMs: 0,
    wordMissCount: 0,
  };
}

export function resetStreamingRecognitionState(
  buffersRef: MutableRefObject<StreamingRecognitionBuffers>,
  smootherRef: MutableRefObject<MajorityVoteSmoother>,
  callbacks: Pick<
    RecognitionCallbacks,
    "setGestureFramesCount" | "setLastConf" | "setLastLabel" | "setRawLabel"
  >
) {
  buffersRef.current = createStreamingRecognitionBuffers();
  smootherRef.current = new MajorityVoteSmoother(3);
  callbacks.setRawLabel("?");
  callbacks.setLastLabel("Ready");
  callbacks.setLastConf(0);
  callbacks.setGestureFramesCount(0);
}

export async function processStreamingHandFrame(
  hand: HandTrackingFrameResult,
  context: RecognitionContext
) {
  if (context.isProcessingRef.current) {
    return;
  }

  context.isProcessingRef.current = true;

  try {
    if (!hand.hasHand || !hand.landmarks || hand.landmarks.length !== 21) {
      handleNoHand(context);
      return;
    }

    context.setLastHandedness(hand.handedness ?? null);

    if (context.detectMode === "LETTERS") {
      await processLetterFrame(hand, context);
    } else {
      await processWordFrame(hand, context);
    }
  } finally {
    context.isProcessingRef.current = false;
  }
}

export async function saveStreamingLandmarkSample(
  hand: HandTrackingFrameResult | null,
  apiBase: string,
  label: string
) {
  if (!hand?.hasHand || !hand.landmarks || hand.landmarks.length !== 21) {
    return { ok: false, error: "No hand detected (cannot save)" };
  }

  const res = await fetch(`${apiBase}/upload_landmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label,
      landmarks: hand.landmarks,
      handedness: hand.handedness ?? null,
    }),
  });

  const json = await res.json();
  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error ?? "unknown" };
  }

  return {
    ok: true,
    handedness: hand.handedness ?? null,
  };
}

function handleNoHand(context: RecognitionContext) {
  const buffers = context.buffersRef.current;

  if (context.detectMode === "LETTERS") {
    context.smootherRef.current.push("?");
    const stable = context.smootherRef.current.getStableLabel();

    if (context.isMountedRef.current) {
      context.setLastLabel(stable === "?" ? "No hand" : stable);
      context.setLastConf(0);
      context.setRawLabel("—");
    }
  } else {
    buffers.predictFrames = [];
    buffers.lastGestureAtMs = 0;

    if (context.isMountedRef.current) {
      context.setLastLabel("No hand");
      context.setLastConf(0);
      context.setRawLabel("—");
      context.setGestureFramesCount(0);
    }
  }
}

async function processLetterFrame(
  hand: HandTrackingFrameResult,
  context: RecognitionContext
) {
  const buffers = context.buffersRef.current;
  context.onPredictionAttempt?.("landmarks");
  const res = await fetch(`${context.apiBase}/predict_landmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      landmarks: hand.landmarks,
      handedness: hand.handedness ?? null,
    }),
  });

  buffers.letterMotionFrames.push({ landmarks: hand.landmarks! });
  if (buffers.letterMotionFrames.length > LETTER_MOTION_FRAMES) {
    buffers.letterMotionFrames.shift();
  }

  const json = await res.json();
  let finalLabel = String(json.label ?? "?");
  let finalConf = Number(json.confidence ?? 0);

  if (buffers.letterMotionFrames.length >= LETTER_MOTION_FRAMES) {
    const now = Date.now();
    const baseShapeLooksMotionLike =
      finalLabel === "I" ||
      finalLabel === "D" ||
      finalLabel === "Z" ||
      finalLabel === "J";

    if (
      baseShapeLooksMotionLike &&
      now - buffers.lastLetterMotionAtMs >= LETTER_MOTION_INTERVAL_MS
    ) {
      buffers.lastLetterMotionAtMs = now;

      try {
        context.onPredictionAttempt?.("gesture");
        const motionRes = await fetch(`${context.apiBase}/predict_gesture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frames: buffers.letterMotionFrames.map((frame) => frame.landmarks),
            handedness: hand.handedness ?? null,
          }),
        });

        const motionJson = await motionRes.json();
        const motionLabel = String(motionJson.label ?? "?");
        const motionConf = Number(motionJson.confidence ?? 0);

        if (
          (motionLabel === "J" || motionLabel === "Z") &&
          motionConf >= LETTER_MOTION_CONFIDENCE_THRESHOLD
        ) {
          finalLabel = motionLabel;
          finalConf = motionConf;
          buffers.letterMotionFrames = [];
          buffers.lastLetterMotionAtMs = 0;
        }
      } catch {}
    }
  }

  if (finalConf < LETTER_CONFIDENCE_THRESHOLD) {
    context.setRawLabel("—");
    context.smootherRef.current.push("?");

    if (context.isMountedRef.current) {
      context.setLastLabel("No clear sign");
      context.setLastConf(finalConf);
    }
    return;
  }

  context.setRawLabel(finalLabel);
  context.smootherRef.current.push(finalLabel);
  const stable = context.smootherRef.current.getStableLabel();

  if (context.isMountedRef.current) {
    context.setLastLabel(stable);
    context.setLastConf(finalConf);
  }
}

async function processWordFrame(
  hand: HandTrackingFrameResult,
  context: RecognitionContext
) {
  const buffers = context.buffersRef.current;

  if (context.isRecordingGesture) {
    buffers.recordFrames.push({ landmarks: hand.landmarks! });
    if (buffers.recordFrames.length > GESTURE_FRAMES) {
      buffers.recordFrames.shift();
    }

    if (context.isMountedRef.current) {
      context.setGestureFramesCount(buffers.recordFrames.length);
      context.setRawLabel(`${buffers.recordFrames.length}/${GESTURE_FRAMES}`);
      context.setLastLabel("Recording…");
      context.setLastConf(0);
    }
    return;
  }

  buffers.predictFrames.push({ landmarks: hand.landmarks! });
  if (buffers.predictFrames.length > GESTURE_FRAMES) {
    buffers.predictFrames.shift();
  }

  if (context.isMountedRef.current) {
    context.setGestureFramesCount(buffers.predictFrames.length);
  }

  if (buffers.predictFrames.length < MIN_PREDICT_FRAMES) {
    if (context.isMountedRef.current) {
      context.setRawLabel(`${buffers.predictFrames.length}/${GESTURE_FRAMES}`);
      context.setLastConf(0);
    }
    return;
  }

  const now = Date.now();
  if (now - buffers.lastGestureAtMs < WORD_PREDICT_INTERVAL_MS) {
    return;
  }
  buffers.lastGestureAtMs = now;

  context.onPredictionAttempt?.("gesture");
  const res = await fetch(`${context.apiBase}/predict_gesture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frames: buffers.predictFrames.map((frame) => frame.landmarks),
      handedness: hand.handedness ?? null,
    }),
  });

  const json = await res.json();
  const word = String(json.label ?? "?");
  const conf = Number(json.confidence ?? 0);

  buffers.predictFrames = [];
  buffers.lastGestureAtMs = 0;

  if (context.isMountedRef.current) {
    context.setGestureFramesCount(0);
  }

  if (conf < WORD_CONFIDENCE_THRESHOLD) {
    buffers.wordMissCount += 1;

    if (context.isMountedRef.current) {
      context.setRawLabel("…");
      context.setLastConf(conf);

      if (buffers.wordMissCount >= 2) {
        context.setLastLabel("No clear word");
      }
    }
    return;
  }

  buffers.wordMissCount = 0;

  if (context.isMountedRef.current) {
    context.setRawLabel(word);
    context.setLastLabel(word);
    context.setLastConf(conf);
  }
}
