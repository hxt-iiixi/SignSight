from typing import Optional

import numpy as np


def np_landmarks(landmarks: list) -> np.ndarray:
    points = []
    for point in landmarks:
        points.append(
            [float(point["x"]), float(point["y"]), float(point.get("z", 0.0))]
        )
    return np.array(points, dtype=np.float32)


def normalize_landmarks(
    landmarks: list, handedness: Optional[str] = None
) -> np.ndarray:
    pts = np_landmarks(landmarks)

    wrist = pts[0].copy()
    pts = pts - wrist

    if handedness and "left" in handedness.lower():
        pts[:, 0] *= -1.0

    distances = np.linalg.norm(pts[:, :2], axis=1)
    scale = float(np.max(distances))
    if scale < 1e-6:
        scale = 1.0

    pts[:, :2] /= scale
    pts[:, 2] /= scale
    return pts.reshape(-1)
