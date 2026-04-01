import React, { useEffect, useMemo, useRef, useState } from "react";
import Svg, { Circle, Line } from "react-native-svg";

import type { HandPoint } from "../ml/streamTypes";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

type HandLandmarkOverlayProps = {
  landmarks: HandPoint[] | null;
  landmarkTimestampMs?: number | null;
  cameraPosition: "back" | "front";
  previewWidth: number;
  previewHeight: number;
  frameWidth: number;
  frameHeight: number;
  visible: boolean;
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
  landmarkTimestampMs,
  cameraPosition,
  previewWidth,
  previewHeight,
  frameWidth,
  frameHeight,
  visible,
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

  if (
    !targetPoints ||
    !displayPoints ||
    displayPoints.length !== 21
  ) {
    return null;
  }

  return (
    <Svg
      pointerEvents="none"
      width={previewWidth}
      height={previewHeight}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {HAND_CONNECTIONS.map(([startIndex, endIndex]) => {
        const start = displayPoints[startIndex];
        const end = displayPoints[endIndex];
        return (
          <React.Fragment key={`${startIndex}-${endIndex}`}>
            <Line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#16FF63"
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
      })}

      {displayPoints.map((point, index) => (
        <React.Fragment key={index}>
          <Circle
            cx={point.x}
            cy={point.y}
            r={4.5}
            fill="#FF3B30"
            fillOpacity={0.95}
          />
          <Circle
            cx={point.x}
            cy={point.y}
            r={2}
            fill="#FFD60A"
            fillOpacity={0.95}
          />
        </React.Fragment>
      ))}
    </Svg>
  );
}

export default React.memo(HandLandmarkOverlay);
