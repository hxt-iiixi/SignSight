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
export const WORD_NO_HAND_GRACE_MS = 750;
export const STATIC_WORD_CONFIDENCE_THRESHOLD = 0.78;
export const PARTIAL_MODEL_LETTER_CONFIDENCE_THRESHOLD = 0.78;
export const VERY_SMALL_PARTIAL_MODEL_LETTER_CONFIDENCE_THRESHOLD = 0.84;
export const PARTIAL_MODEL_MAX_ACTIVE_LETTERS = 6;
export const VERY_SMALL_PARTIAL_MODEL_MAX_ACTIVE_LETTERS = 4;

type SetState<T> = (value: T) => void;

type RecognitionCallbacks = {
  setLastConf: SetState<number>;
  setLastHandedness: SetState<string | null>;
  setLastLabel: SetState<string>;
  setRawLabel: SetState<string>;
  setLiveGestureFramesCount: SetState<number>;
  setRecordingGestureFramesCount: SetState<number>;
  setWordGraceActive: SetState<boolean>;
  setLastGesturePredictionAtMs: SetState<number | null>;
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
    recordingFrames: [],
    liveWordFrames: [],
    lastLetterMotionAtMs: 0,
    lastWordPredictionAtMs: 0,
    lastWordHandAtMs: 0,
    wordNoHandSinceMs: 0,
    wordMissCount: 0,
  };
}

export function resetStreamingRecognitionState(
  buffersRef: MutableRefObject<StreamingRecognitionBuffers>,
  smootherRef: MutableRefObject<MajorityVoteSmoother>,
  callbacks: Pick<
    RecognitionCallbacks,
    | "setLiveGestureFramesCount"
    | "setRecordingGestureFramesCount"
    | "setWordGraceActive"
    | "setLastConf"
    | "setLastGesturePredictionAtMs"
    | "setLastLabel"
    | "setRawLabel"
  >
) {
  buffersRef.current = createStreamingRecognitionBuffers();
  smootherRef.current = new MajorityVoteSmoother(3);
  callbacks.setRawLabel("?");
  callbacks.setLastLabel("Ready");
  callbacks.setLastConf(0);
  callbacks.setLiveGestureFramesCount(0);
  callbacks.setRecordingGestureFramesCount(0);
  callbacks.setWordGraceActive(false);
  callbacks.setLastGesturePredictionAtMs(null);
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
  label: string,
  metadata: {
    signerId: string;
    captureSessionId: string;
    cameraPosition: "front" | "back";
    deviceId?: string;
    variantTags?: string[];
  }
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
      signer_id: metadata.signerId,
      capture_session_id: metadata.captureSessionId,
      device_id: metadata.deviceId ?? null,
      camera_position: metadata.cameraPosition,
      accepted: true,
      review_status: "approved",
      review_notes: "Approved from developer lab capture.",
      variant_tags: metadata.variantTags ?? [],
      captured_at: new Date().toISOString(),
    }),
  });

  const json = await res.json();
  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error ?? "unknown" };
  }

  return {
    ok: true,
    handedness: hand.handedness ?? null,
    reviewStatus: String(json.review_status ?? "approved"),
  };
}

export async function saveStreamingStaticWordLandmarkSample(
  hand: HandTrackingFrameResult | null,
  apiBase: string,
  label: string,
  metadata: {
    signerId: string;
    captureSessionId: string;
    cameraPosition: "front" | "back";
    deviceId?: string;
    variantTags?: string[];
  }
) {
  if (!hand?.hasHand || !hand.landmarks || hand.landmarks.length !== 21) {
    return { ok: false, error: "No hand detected (cannot save)" };
  }

  const res = await fetch(`${apiBase}/upload_static_word_landmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label,
      landmarks: hand.landmarks,
      handedness: hand.handedness ?? null,
      signer_id: metadata.signerId,
      capture_session_id: metadata.captureSessionId,
      device_id: metadata.deviceId ?? null,
      camera_position: metadata.cameraPosition,
      accepted: true,
      review_status: "approved",
      review_notes: "Approved static word capture from developer lab.",
      variant_tags: metadata.variantTags ?? [],
      captured_at: new Date().toISOString(),
    }),
  });

  const json = await res.json();
  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error ?? "unknown" };
  }

  return {
    ok: true,
    handedness: hand.handedness ?? null,
    reviewStatus: String(json.review_status ?? "approved"),
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
    const now = Date.now();
    if (buffers.wordNoHandSinceMs === 0) {
      buffers.wordNoHandSinceMs = now;
    }

    const lastWordHandAtMs = buffers.lastWordHandAtMs || buffers.wordNoHandSinceMs;
    const withinGrace = now - lastWordHandAtMs <= WORD_NO_HAND_GRACE_MS;

    if (withinGrace) {
      if (context.isMountedRef.current) {
        context.setWordGraceActive(true);
      }
      return;
    }

    buffers.liveWordFrames = [];
    buffers.lastWordPredictionAtMs = 0;
    buffers.lastWordHandAtMs = 0;
    buffers.wordNoHandSinceMs = 0;
    buffers.wordMissCount = 0;

    if (context.isMountedRef.current) {
      context.setWordGraceActive(false);
      context.setLastLabel("No hand");
      context.setLastConf(0);
      context.setRawLabel("—");
      context.setLiveGestureFramesCount(0);
      context.setLastGesturePredictionAtMs(null);
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
  const acceptedPrediction =
    typeof json.accepted_prediction === "boolean"
      ? json.accepted_prediction
      : null;
  const activeStaticLetters = Array.isArray(json.active_static_letters)
    ? json.active_static_letters.map(String)
    : [];

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

  let localThreshold = LETTER_CONFIDENCE_THRESHOLD;
  if (activeStaticLetters.length > 0) {
    if (activeStaticLetters.length <= VERY_SMALL_PARTIAL_MODEL_MAX_ACTIVE_LETTERS) {
      localThreshold = VERY_SMALL_PARTIAL_MODEL_LETTER_CONFIDENCE_THRESHOLD;
    } else if (activeStaticLetters.length <= PARTIAL_MODEL_MAX_ACTIVE_LETTERS) {
      localThreshold = PARTIAL_MODEL_LETTER_CONFIDENCE_THRESHOLD;
    }
  }

  if (acceptedPrediction === false || finalConf < localThreshold) {
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
  const now = Date.now();
  buffers.lastWordHandAtMs = now;
  buffers.wordNoHandSinceMs = 0;

  if (context.isMountedRef.current) {
    context.setWordGraceActive(false);
  }

  if (context.isRecordingGesture) {
    buffers.recordingFrames.push({ landmarks: hand.landmarks! });
    if (buffers.recordingFrames.length > GESTURE_FRAMES) {
      buffers.recordingFrames.shift();
    }

    if (context.isMountedRef.current) {
      context.setRecordingGestureFramesCount(buffers.recordingFrames.length);
      context.setRawLabel(`${buffers.recordingFrames.length}/${GESTURE_FRAMES}`);
      context.setLastLabel("Recording…");
      context.setLastConf(0);
    }
    return;
  }

  try {
    context.onPredictionAttempt?.("landmarks");
    const landmarkRes = await fetch(`${context.apiBase}/predict_landmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        landmarks: hand.landmarks,
        handedness: hand.handedness ?? null,
        labelSpace: "words",
      }),
    });

    const landmarkJson = await landmarkRes.json();
    const landmarkLabel = String(landmarkJson.label ?? "?");
    const landmarkConf = Number(landmarkJson.confidence ?? 0);
    const landmarkAccepted =
      typeof landmarkJson.accepted_prediction === "boolean"
        ? landmarkJson.accepted_prediction
        : landmarkConf >= STATIC_WORD_CONFIDENCE_THRESHOLD;

    if (landmarkAccepted && landmarkLabel === "I_LOVE_YOU") {
      buffers.wordMissCount = 0;
      if (context.isMountedRef.current) {
        context.setRawLabel(landmarkLabel);
        context.setLastLabel(landmarkLabel);
        context.setLastConf(landmarkConf);
      }
      return;
    }
  } catch {}

  buffers.liveWordFrames.push({ landmarks: hand.landmarks! });
  if (buffers.liveWordFrames.length > GESTURE_FRAMES) {
    buffers.liveWordFrames.shift();
  }

  if (context.isMountedRef.current) {
    context.setLiveGestureFramesCount(buffers.liveWordFrames.length);
  }

  if (buffers.liveWordFrames.length < MIN_PREDICT_FRAMES) {
    if (context.isMountedRef.current) {
      context.setRawLabel(`${buffers.liveWordFrames.length}/${GESTURE_FRAMES}`);
      context.setLastConf(0);
    }
    return;
  }

  if (now - buffers.lastWordPredictionAtMs < WORD_PREDICT_INTERVAL_MS) {
    return;
  }
  buffers.lastWordPredictionAtMs = now;
  context.setLastGesturePredictionAtMs(now);

  context.onPredictionAttempt?.("gesture");
  const res = await fetch(`${context.apiBase}/predict_gesture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frames: buffers.liveWordFrames.map((frame) => frame.landmarks),
      handedness: hand.handedness ?? null,
    }),
  });

  const json = await res.json();
  const word = String(json.label ?? "?");
  const conf = Number(json.confidence ?? 0);

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
