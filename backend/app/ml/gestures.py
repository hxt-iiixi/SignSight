import numpy as np

from app.core.constants import GESTURE_FRAMES
from app.ml.landmarks import normalize_landmarks

GESTURE_V2_UPPER_BODY_KEYS = [
    "nose",
    "leftEar",
    "rightEar",
    "leftShoulder",
    "rightShoulder",
    "leftElbow",
    "rightElbow",
    "leftWrist",
    "rightWrist",
    "leftHip",
    "rightHip",
]


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


def _upper_body_point_vec(
    point: dict | None,
    *,
    anchor_x: float,
    anchor_y: float,
    anchor_z: float,
    scale: float,
) -> np.ndarray:
    if not isinstance(point, dict):
        return np.zeros((4,), dtype=np.float32)

    x = float(point.get("x", 0.0))
    y = float(point.get("y", 0.0))
    z = float(point.get("z", 0.0))
    visibility = float(point.get("visibility", 0.0) or 0.0)
    return np.array(
        [
            (x - anchor_x) / scale,
            (y - anchor_y) / scale,
            (z - anchor_z) / scale,
            visibility,
        ],
        dtype=np.float32,
    )


def _upper_body_to_vec(upper_body: dict | None) -> np.ndarray:
    if not isinstance(upper_body, dict):
        return np.zeros((len(GESTURE_V2_UPPER_BODY_KEYS) * 4,), dtype=np.float32)

    left_shoulder = upper_body.get("leftShoulder")
    right_shoulder = upper_body.get("rightShoulder")
    left_hip = upper_body.get("leftHip")
    right_hip = upper_body.get("rightHip")

    if isinstance(left_shoulder, dict) and isinstance(right_shoulder, dict):
        anchor_x = (float(left_shoulder.get("x", 0.0)) + float(right_shoulder.get("x", 0.0))) / 2.0
        anchor_y = (float(left_shoulder.get("y", 0.0)) + float(right_shoulder.get("y", 0.0))) / 2.0
        anchor_z = (float(left_shoulder.get("z", 0.0)) + float(right_shoulder.get("z", 0.0))) / 2.0
        shoulder_dx = float(left_shoulder.get("x", 0.0)) - float(right_shoulder.get("x", 0.0))
        shoulder_dy = float(left_shoulder.get("y", 0.0)) - float(right_shoulder.get("y", 0.0))
        shoulder_dz = float(left_shoulder.get("z", 0.0)) - float(right_shoulder.get("z", 0.0))
        scale = max((shoulder_dx**2 + shoulder_dy**2 + shoulder_dz**2) ** 0.5, 1e-3)
    elif isinstance(left_hip, dict) and isinstance(right_hip, dict):
        anchor_x = (float(left_hip.get("x", 0.0)) + float(right_hip.get("x", 0.0))) / 2.0
        anchor_y = (float(left_hip.get("y", 0.0)) + float(right_hip.get("y", 0.0))) / 2.0
        anchor_z = (float(left_hip.get("z", 0.0)) + float(right_hip.get("z", 0.0))) / 2.0
        hip_dx = float(left_hip.get("x", 0.0)) - float(right_hip.get("x", 0.0))
        hip_dy = float(left_hip.get("y", 0.0)) - float(right_hip.get("y", 0.0))
        hip_dz = float(left_hip.get("z", 0.0)) - float(right_hip.get("z", 0.0))
        scale = max((hip_dx**2 + hip_dy**2 + hip_dz**2) ** 0.5, 1e-3)
    else:
        anchor_x = anchor_y = anchor_z = 0.0
        scale = 1.0

    vecs = [
        _upper_body_point_vec(
            upper_body.get(key),
            anchor_x=anchor_x,
            anchor_y=anchor_y,
            anchor_z=anchor_z,
            scale=scale,
        )
        for key in GESTURE_V2_UPPER_BODY_KEYS
    ]
    return np.concatenate(vecs).astype(np.float32)


def gesture_v2_frame_to_vec(frame: dict) -> np.ndarray:
    hand_landmarks = frame.get("handLandmarks")
    handedness = frame.get("handedness")
    upper_body = frame.get("upperBody")

    if isinstance(hand_landmarks, list) and len(hand_landmarks) == 21:
        hand_vec = normalize_landmarks(hand_landmarks, handedness)
    else:
        hand_vec = np.zeros((63,), dtype=np.float32)

    upper_body_vec = _upper_body_to_vec(upper_body)
    return np.concatenate([hand_vec, upper_body_vec]).astype(np.float32)


def gesture_v2_to_vec(frames_v2: list) -> np.ndarray:
    frames = resample_frames(frames_v2, GESTURE_FRAMES)
    vecs = [gesture_v2_frame_to_vec(frame) for frame in frames if isinstance(frame, dict)]

    expected_frame_dims = 63 + (len(GESTURE_V2_UPPER_BODY_KEYS) * 4)
    if len(vecs) != GESTURE_FRAMES:
        return np.zeros((GESTURE_FRAMES * expected_frame_dims,), dtype=np.float32)

    return np.concatenate(vecs).astype(np.float32)
