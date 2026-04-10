import React, { useEffect, useMemo, useRef, useState } from "react";
import Svg, { Circle, Line } from "react-native-svg";

import type {
  DetectedHand,
  HandPoint,
  UpperBodyLandmarks,
  UpperBodyKeypointName,
} from "../ml/streamTypes";

type HandRegion = "palm" | "thumb" | "index" | "middle" | "ring" | "pinky";
type UpperBodyRegion = "head" | "torso" | "arm";

const HAND_REGION_COLORS: Record<HandRegion, string> = {
  palm: "#D0E7F7",
  thumb: "#2F80ED",
  index: "#22C55E",
  middle: "#FACC15",
  ring: "#A855F7",
  pinky: "#FB7185",
};

const HAND_CONNECTIONS: Array<{
  start: number;
  end: number;
  region: HandRegion;
}> = [
  { start: 0, end: 1, region: "palm" },
  { start: 1, end: 2, region: "thumb" },
  { start: 2, end: 3, region: "thumb" },
  { start: 3, end: 4, region: "thumb" },
  { start: 0, end: 5, region: "palm" },
  { start: 5, end: 6, region: "index" },
  { start: 6, end: 7, region: "index" },
  { start: 7, end: 8, region: "index" },
  { start: 5, end: 9, region: "palm" },
  { start: 9, end: 10, region: "middle" },
  { start: 10, end: 11, region: "middle" },
  { start: 11, end: 12, region: "middle" },
  { start: 9, end: 13, region: "palm" },
  { start: 13, end: 14, region: "ring" },
  { start: 14, end: 15, region: "ring" },
  { start: 15, end: 16, region: "ring" },
  { start: 13, end: 17, region: "palm" },
  { start: 0, end: 17, region: "palm" },
  { start: 17, end: 18, region: "pinky" },
  { start: 18, end: 19, region: "pinky" },
  { start: 19, end: 20, region: "pinky" },
];

const LANDMARK_REGION_MAP: Record<number, HandRegion> = {
  0: "palm",
  1: "palm",
  2: "thumb",
  3: "thumb",
  4: "thumb",
  5: "palm",
  6: "index",
  7: "index",
  8: "index",
  9: "palm",
  10: "middle",
  11: "middle",
  12: "middle",
  13: "palm",
  14: "ring",
  15: "ring",
  16: "ring",
  17: "palm",
  18: "pinky",
  19: "pinky",
  20: "pinky",
};

const UPPER_BODY_REGION_COLORS: Record<UpperBodyRegion, string> = {
  head: "#60A5FA",
  torso: "#F97316",
  arm: "#A78BFA",
};

const UPPER_BODY_CONNECTIONS: Array<{
  start: UpperBodyKeypointName;
  end: UpperBodyKeypointName;
  region: UpperBodyRegion;
}> = [
  { start: "leftShoulder", end: "rightShoulder", region: "torso" },
  { start: "leftShoulder", end: "leftHip", region: "torso" },
  { start: "rightShoulder", end: "rightHip", region: "torso" },
  { start: "leftHip", end: "rightHip", region: "torso" },
  { start: "nose", end: "leftShoulder", region: "head" },
  { start: "nose", end: "rightShoulder", region: "head" },
  { start: "nose", end: "leftEar", region: "head" },
  { start: "nose", end: "rightEar", region: "head" },
  { start: "leftShoulder", end: "leftElbow", region: "arm" },
  { start: "leftElbow", end: "leftWrist", region: "arm" },
  { start: "rightShoulder", end: "rightElbow", region: "arm" },
  { start: "rightElbow", end: "rightWrist", region: "arm" },
];

type HandLandmarkOverlayProps = {
  landmarks: HandPoint[] | null;
  hands?: DetectedHand[] | null;
  upperBody?: UpperBodyLandmarks | null;
  landmarkTimestampMs?: number | null;
  cameraPosition: "back" | "front";
  previewWidth: number;
  previewHeight: number;
  frameWidth: number;
  frameHeight: number;
  visible: boolean;
  overlayMode?: "hand" | "gesture";
  onSmoothingChange?: (isSmoothing: boolean) => void;
};

type ScreenPoint = {
  x: number;
  y: number;
};

const MIN_INTERPOLATION_MS = 12;
const MAX_INTERPOLATION_MS = 32;
const FALLBACK_INTERPOLATION_MS = 18;
const SNAP_MAX_DELTA_PX = 22;
const SNAP_AVERAGE_DELTA_PX = 10;
const REDUCED_SMOOTHING_MAX_DELTA_PX = 12;

function projectLandmarkToPreview(
  point: HandPoint,
  previewWidth: number,
  previewHeight: number,
  frameWidth: number,
  frameHeight: number,
  cameraPosition: "back" | "front"
) {
  const normalizedX = cameraPosition === "front" ? 1 - point.x : point.x;
  const frameX = normalizedX * frameWidth;
  const frameY = point.y * frameHeight;
  const scale = Math.max(previewWidth / frameWidth, previewHeight / frameHeight);
  const scaledWidth = frameWidth * scale;
  const scaledHeight = frameHeight * scale;
  const offsetX = (previewWidth - scaledWidth) / 2;
  const offsetY = (previewHeight - scaledHeight) / 2;

  return {
    x: frameX * scale + offsetX,
    y: frameY * scale + offsetY,
  };
}

export function HandLandmarkOverlay({
  landmarks,
  hands,
  upperBody,
  landmarkTimestampMs,
  cameraPosition,
  previewWidth,
  previewHeight,
  frameWidth,
  frameHeight,
  visible,
  overlayMode = "hand",
  onSmoothingChange,
}: HandLandmarkOverlayProps) {
  const [displayPoints, setDisplayPoints] = useState<ScreenPoint[] | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const displayPointsRef = useRef<ScreenPoint[] | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastTargetPointsRef = useRef<ScreenPoint[] | null>(null);
  const smoothingStateRef = useRef(false);

  const reportSmoothingState = (isSmoothing: boolean) => {
    if (smoothingStateRef.current === isSmoothing) {
      return;
    }

    smoothingStateRef.current = isSmoothing;
    onSmoothingChange?.(isSmoothing);
  };

  const targetPoints = useMemo(() => {
    if (
      !visible ||
      !landmarks ||
      landmarks.length !== 21 ||
      previewWidth <= 0 ||
      previewHeight <= 0 ||
      frameWidth <= 0 ||
      frameHeight <= 0
    ) {
      return null;
    }

    return landmarks.map((point) =>
      projectLandmarkToPreview(
        point,
        previewWidth,
        previewHeight,
        frameWidth,
        frameHeight,
        cameraPosition
      )
    );
  }, [
    cameraPosition,
    frameHeight,
    frameWidth,
    landmarks,
    previewHeight,
    previewWidth,
    visible,
  ]);

  const multiHandPoints = useMemo(() => {
    if (
      !visible ||
      !hands ||
      hands.length === 0 ||
      previewWidth <= 0 ||
      previewHeight <= 0 ||
      frameWidth <= 0 ||
      frameHeight <= 0
    ) {
      return [];
    }

    return hands
      .map((hand) => {
        if (!hand.landmarks || hand.landmarks.length !== 21) {
          return null;
        }

        return hand.landmarks.map((point) =>
          projectLandmarkToPreview(
            point,
            previewWidth,
            previewHeight,
            frameWidth,
            frameHeight,
            cameraPosition
          )
        );
      })
      .filter((points): points is ScreenPoint[] => Array.isArray(points));
  }, [
    cameraPosition,
    frameHeight,
    frameWidth,
    hands,
    previewHeight,
    previewWidth,
    visible,
  ]);

  const upperBodyPoints = useMemo(() => {
    if (
      !visible ||
      overlayMode !== "gesture" ||
      !upperBody ||
      previewWidth <= 0 ||
      previewHeight <= 0 ||
      frameWidth <= 0 ||
      frameHeight <= 0
    ) {
      return null;
    }

    const entries = Object.entries(upperBody)
      .filter(([, point]) => point != null)
      .map(([key, point]) => [
        key as UpperBodyKeypointName,
        projectLandmarkToPreview(
          point as HandPoint,
          previewWidth,
          previewHeight,
          frameWidth,
          frameHeight,
          cameraPosition
        ),
      ]);

    return Object.fromEntries(entries) as Partial<
      Record<UpperBodyKeypointName, ScreenPoint>
    >;
  }, [
    cameraPosition,
    frameHeight,
    frameWidth,
    overlayMode,
    previewHeight,
    previewWidth,
    upperBody,
    visible,
  ]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      reportSmoothingState(false);
    };
  }, []);

  useEffect(() => {
    if (!targetPoints) {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      reportSmoothingState(false);
      displayPointsRef.current = null;
      setDisplayPoints(null);
      lastTargetPointsRef.current = null;
      lastTimestampRef.current = null;
      return;
    }

    const previousDisplay = displayPointsRef.current;
    const previousTarget = lastTargetPointsRef.current;
    const hasRenderablePrevious =
      previousDisplay != null &&
      previousDisplay.length === targetPoints.length &&
      previousTarget != null &&
      previousTarget.length === targetPoints.length;

    if (!hasRenderablePrevious) {
      reportSmoothingState(false);
      displayPointsRef.current = targetPoints;
      setDisplayPoints(targetPoints);
      lastTargetPointsRef.current = targetPoints;
      lastTimestampRef.current = landmarkTimestampMs ?? null;
      return;
    }

    const deltaSummary = previousDisplay.reduce(
      (summary, point, index) => {
        const deltaX = targetPoints[index].x - point.x;
        const deltaY = targetPoints[index].y - point.y;
        const distance = Math.hypot(deltaX, deltaY);

        return {
          maxDistance: Math.max(summary.maxDistance, distance),
          totalDistance: summary.totalDistance + distance,
        };
      },
      { maxDistance: 0, totalDistance: 0 }
    );
    const averageDistance = deltaSummary.totalDistance / targetPoints.length;

    if (
      deltaSummary.maxDistance >= SNAP_MAX_DELTA_PX ||
      averageDistance >= SNAP_AVERAGE_DELTA_PX
    ) {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      reportSmoothingState(false);
      displayPointsRef.current = targetPoints;
      setDisplayPoints(targetPoints);
      lastTargetPointsRef.current = targetPoints;
      lastTimestampRef.current = landmarkTimestampMs ?? null;
      return;
    }

    const previousTimestamp = lastTimestampRef.current;
    const nextTimestamp = landmarkTimestampMs ?? previousTimestamp ?? Date.now();
    const rawDuration =
      previousTimestamp == null ? FALLBACK_INTERPOLATION_MS : nextTimestamp - previousTimestamp;
    const baseDurationMs = Math.min(
      MAX_INTERPOLATION_MS,
      Math.max(MIN_INTERPOLATION_MS, rawDuration || FALLBACK_INTERPOLATION_MS)
    );
    const durationMs =
      deltaSummary.maxDistance >= REDUCED_SMOOTHING_MAX_DELTA_PX
        ? MIN_INTERPOLATION_MS
        : baseDurationMs;

    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const fromPoints = previousDisplay.map((point) => ({ ...point }));
    const toPoints = targetPoints;
    const animationStart = Date.now();
    reportSmoothingState(true);

    const tick = () => {
      const elapsed = Date.now() - animationStart;
      const t = Math.min(1, elapsed / durationMs);
      const nextPoints = fromPoints.map((point, index) => ({
        x: point.x + (toPoints[index].x - point.x) * t,
        y: point.y + (toPoints[index].y - point.y) * t,
      }));
      displayPointsRef.current = nextPoints;
      setDisplayPoints(nextPoints);

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
        reportSmoothingState(false);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    lastTargetPointsRef.current = targetPoints;
    lastTimestampRef.current = nextTimestamp;
  }, [landmarkTimestampMs, targetPoints]);

  const primaryHandPoints =
    !!targetPoints && !!displayPoints && displayPoints.length === 21 ? displayPoints : null;
  const renderedHandSets =
    multiHandPoints.length > 0 ? multiHandPoints : primaryHandPoints ? [primaryHandPoints] : [];
  const hasHandPoints = renderedHandSets.length > 0;
  const hasUpperBodyPoints =
    overlayMode === "gesture" &&
    !!upperBodyPoints &&
    Object.keys(upperBodyPoints).length > 0;

  if (!hasHandPoints && !hasUpperBodyPoints) {
    return null;
  }

  return (
    <Svg
      pointerEvents="none"
      width={previewWidth}
      height={previewHeight}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {hasUpperBodyPoints
        ? UPPER_BODY_CONNECTIONS.map(({ start: startKey, end: endKey, region }) => {
            const start = upperBodyPoints?.[startKey];
            const end = upperBodyPoints?.[endKey];
            if (!start || !end) return null;
            const strokeColor = UPPER_BODY_REGION_COLORS[region];
            return (
              <React.Fragment key={`${startKey}-${endKey}`}>
                <Line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={strokeColor}
                  strokeWidth={3.4}
                  strokeOpacity={0.92}
                />
                <Line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#0B0F14"
                  strokeWidth={1.1}
                  strokeOpacity={0.42}
                />
              </React.Fragment>
            );
          })
        : null}

      {hasUpperBodyPoints
        ? Object.entries(upperBodyPoints ?? {}).map(([key, point]) => {
            if (!point) return null;
            return (
              <React.Fragment key={key}>
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={5}
                  fill="#F97316"
                  fillOpacity={0.88}
                />
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={2.1}
                  fill="#FFF7ED"
                  fillOpacity={0.96}
                />
              </React.Fragment>
            );
          })
        : null}

      {hasHandPoints
        ? renderedHandSets.map((handPoints, handIndex) =>
            HAND_CONNECTIONS.map(({ start: startIndex, end: endIndex, region }) => {
              const start = handPoints[startIndex];
              const end = handPoints[endIndex];
              const strokeColor = HAND_REGION_COLORS[region];
              return (
                <React.Fragment key={`hand-${handIndex}-${startIndex}-${endIndex}`}>
                  <Line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={strokeColor}
                    strokeWidth={3}
                    strokeOpacity={0.95}
                  />
                  <Line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#0B0F14"
                    strokeWidth={1}
                    strokeOpacity={0.55}
                  />
                </React.Fragment>
              );
            })
          )
        : null}

      {hasHandPoints
        ? renderedHandSets.map((handPoints, handIndex) =>
            handPoints.map((point, index) => {
              const region = LANDMARK_REGION_MAP[index] ?? "palm";
              const fillColor = HAND_REGION_COLORS[region];
              return (
                <React.Fragment key={`hand-${handIndex}-point-${index}`}>
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={4.5}
                    fill={fillColor}
                    fillOpacity={0.95}
                  />
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={2}
                    fill="#F8FAFC"
                    fillOpacity={0.95}
                  />
                </React.Fragment>
              );
            })
          )
        : null}
    </Svg>
  );
}

export default React.memo(HandLandmarkOverlay);
