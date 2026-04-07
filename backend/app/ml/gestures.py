import numpy as np

from app.core.constants import GESTURE_FRAMES
from app.ml.landmarks import normalize_landmarks


def resample_frames(frames, target_len=GESTURE_FRAMES):
    if len(frames) == 0:
        return []
    idxs = np.linspace(0, len(frames) - 1, target_len).astype(int)
    return [frames[i] for i in idxs]


def gesture_to_vec(frames: list, handedness: str | None) -> np.ndarray:
    frames = resample_frames(frames, GESTURE_FRAMES)
    vecs = []
    for landmarks in frames:
        vecs.append(normalize_landmarks(landmarks, handedness))

    if len(vecs) != GESTURE_FRAMES:
        return np.zeros((GESTURE_FRAMES * 63,), dtype=np.float32)

    return np.concatenate(vecs).astype(np.float32)
