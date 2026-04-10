from typing import Any, Optional

import numpy as np

FINGER_NAMES = ("thumb", "index", "middle", "ring", "pinky")
FINGER_CHAINS: tuple[tuple[int, int, int, int], ...] = (
    (1, 2, 3, 4),
    (5, 6, 7, 8),
    (9, 10, 11, 12),
    (13, 14, 15, 16),
    (17, 18, 19, 20),
)
FINGERTIP_INDICES = (4, 8, 12, 16, 20)
MCP_INDICES = (5, 9, 13, 17)


def np_landmarks(landmarks: list) -> np.ndarray:
    points = []
    for point in landmarks:
        points.append(
            [float(point["x"]), float(point["y"]), float(point.get("z", 0.0))]
        )
    return np.array(points, dtype=np.float32)


def _safe_norm(vec: np.ndarray) -> float:
    return float(np.linalg.norm(vec))


def _safe_unit(vec: np.ndarray) -> np.ndarray:
    norm = _safe_norm(vec)
    if norm < 1e-6:
        return np.zeros_like(vec, dtype=np.float32)
    return (vec / norm).astype(np.float32)


def _distance(points: np.ndarray, a: int, b: int) -> float:
    return _safe_norm(points[a] - points[b])


def _angle(points: np.ndarray, a: int, b: int, c: int) -> float:
    ab = points[a] - points[b]
    cb = points[c] - points[b]
    ab_norm = _safe_norm(ab)
    cb_norm = _safe_norm(cb)
    if ab_norm < 1e-6 or cb_norm < 1e-6:
        return float(np.pi)
    cosine = float(np.dot(ab, cb) / (ab_norm * cb_norm))
    cosine = float(np.clip(cosine, -1.0, 1.0))
    return float(np.arccos(cosine))


def _normalize_landmark_points(
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
    return pts.astype(np.float32)


def normalize_landmarks(
    landmarks: list, handedness: Optional[str] = None
) -> np.ndarray:
    return _normalize_landmark_points(landmarks, handedness).reshape(-1)


def _thumb_metrics(points: np.ndarray) -> tuple[float, float]:
    thumb_base, thumb_mcp, thumb_ip, thumb_tip = FINGER_CHAINS[0]
    straightness = np.mean(
        [
            _angle(points, thumb_base, thumb_mcp, thumb_ip) / np.pi,
            _angle(points, thumb_mcp, thumb_ip, thumb_tip) / np.pi,
        ]
    )
    reach_score = np.clip((_distance(points, thumb_tip, thumb_base) - 0.28) / 0.55, 0.0, 1.0)
    openness_score = np.clip((_distance(points, thumb_tip, 5) - 0.18) / 0.45, 0.0, 1.0)
    extension_score = float(np.clip(0.4 * straightness + 0.35 * reach_score + 0.25 * openness_score, 0.0, 1.0))
    curl_score = float(np.clip(1.0 - (0.55 * straightness + 0.45 * reach_score), 0.0, 1.0))
    return extension_score, curl_score


def _finger_metrics(points: np.ndarray, chain: tuple[int, int, int, int]) -> tuple[float, float]:
    mcp, pip, dip, tip = chain
    pip_angle = _angle(points, mcp, pip, dip)
    dip_angle = _angle(points, pip, dip, tip)
    straightness = np.mean([pip_angle / np.pi, dip_angle / np.pi])
    reach = _distance(points, tip, mcp)
    mid_reach = _distance(points, pip, mcp)
    reach_score = np.clip((reach - 0.20) / 0.65, 0.0, 1.0)
    ratio_score = np.clip((reach / max(mid_reach, 1e-6) - 1.15) / 1.15, 0.0, 1.0)
    extension_score = float(np.clip(0.5 * straightness + 0.3 * reach_score + 0.2 * ratio_score, 0.0, 1.0))
    curl_score = float(np.clip(1.0 - (0.65 * straightness + 0.35 * reach_score), 0.0, 1.0))
    return extension_score, curl_score


def analyze_hand_landmarks(
    landmarks: list, handedness: Optional[str] = None
) -> dict[str, Any]:
    points = _normalize_landmark_points(landmarks, handedness)
    palm_center = np.mean(points[[0, 5, 9, 13, 17]], axis=0).astype(np.float32)

    extension_scores = []
    curl_scores = []
    for finger_index, chain in enumerate(FINGER_CHAINS):
        if finger_index == 0:
            ext_score, curl_score = _thumb_metrics(points)
        else:
            ext_score, curl_score = _finger_metrics(points, chain)
        extension_scores.append(ext_score)
        curl_scores.append(curl_score)

    extension_scores_arr = np.array(extension_scores, dtype=np.float32)
    curl_scores_arr = np.array(curl_scores, dtype=np.float32)
    extended_flags = np.array(extension_scores_arr > 0.58, dtype=np.float32)

    adjacent_tip_distance = np.array(
        [
            _distance(points, 4, 8),
            _distance(points, 8, 12),
            _distance(points, 12, 16),
            _distance(points, 16, 20),
        ],
        dtype=np.float32,
    )
    thumb_to_tip_distance = np.array(
        [_distance(points, 4, tip_index) for tip_index in FINGERTIP_INDICES[1:]],
        dtype=np.float32,
    )
    tip_to_wrist_distance = np.array(
        [_distance(points, 0, tip_index) for tip_index in FINGERTIP_INDICES],
        dtype=np.float32,
    )
    mcp_spread = np.array(
        [
            _distance(points, 5, 9),
            _distance(points, 9, 13),
            _distance(points, 13, 17),
            _distance(points, 5, 17),
        ],
        dtype=np.float32,
    )

    joint_angle_features = np.array(
        [
            _angle(points, 1, 2, 3) / np.pi,
            _angle(points, 2, 3, 4) / np.pi,
            _angle(points, 5, 6, 7) / np.pi,
            _angle(points, 6, 7, 8) / np.pi,
            _angle(points, 9, 10, 11) / np.pi,
            _angle(points, 10, 11, 12) / np.pi,
            _angle(points, 13, 14, 15) / np.pi,
            _angle(points, 14, 15, 16) / np.pi,
            _angle(points, 17, 18, 19) / np.pi,
            _angle(points, 18, 19, 20) / np.pi,
        ],
        dtype=np.float32,
    )

    palm_normal = np.cross(points[5] - points[0], points[17] - points[0]).astype(np.float32)
    palm_orientation = _safe_unit(palm_normal)

    thumb_tip = points[4]
    thumb_crossing = np.array(
        [
            float(thumb_tip[0] - palm_center[0]),
            float(thumb_tip[1] - palm_center[1]),
            _safe_norm(thumb_tip[:2] - palm_center[:2]),
        ],
        dtype=np.float32,
    )

    index_direction = _safe_unit(points[8][:2] - points[5][:2]).astype(np.float32)

    motion_letter_hints = np.array(
        [
            float(extended_flags[4] and not np.any(extended_flags[1:4])),
            float(extended_flags[1] and not np.any(extended_flags[2:5])),
        ],
        dtype=np.float32,
    )

    thumb_base_points = points[list(MCP_INDICES)]
    thumb_base_distances = np.linalg.norm(thumb_base_points[:, :2] - thumb_tip[:2], axis=1)
    thumb_closest_base = int(np.argmin(thumb_base_distances))

    aperture = float(np.mean(tip_to_wrist_distance[1:]))
    folded_finger_tips_to_palm = np.array(
        [_safe_norm(points[idx][:2] - palm_center[:2]) for idx in FINGERTIP_INDICES[1:]],
        dtype=np.float32,
    )
    knuckle_ridge = points[17][:2] - points[5][:2]
    knuckle_ridge_norm = _safe_norm(knuckle_ridge)
    if knuckle_ridge_norm < 1e-6:
        thumb_knuckle_clearance = 0.0
    else:
        thumb_knuckle_clearance = float(
            abs(
                knuckle_ridge[0] * (points[5][1] - thumb_tip[1])
                - (points[5][0] - thumb_tip[0]) * knuckle_ridge[1]
            )
            / knuckle_ridge_norm
        )

    return {
        "points": points,
        "extension_scores": extension_scores_arr,
        "extended_flags": extended_flags,
        "curl_scores": curl_scores_arr,
        "adjacent_tip_distance": adjacent_tip_distance,
        "thumb_to_tip_distance": thumb_to_tip_distance,
        "tip_to_wrist_distance": tip_to_wrist_distance,
        "mcp_spread": mcp_spread,
        "joint_angle_features": joint_angle_features,
        "palm_orientation": palm_orientation.astype(np.float32),
        "thumb_crossing": thumb_crossing,
        "index_direction": index_direction.astype(np.float32),
        "motion_letter_hints": motion_letter_hints,
        "thumb_closest_base": thumb_closest_base,
        "aperture": aperture,
        "folded_finger_tips_to_palm": folded_finger_tips_to_palm,
        "thumb_knuckle_clearance": thumb_knuckle_clearance,
    }


def landmark_feature_vector(
    landmarks: list, handedness: Optional[str] = None
) -> np.ndarray:
    analysis = analyze_hand_landmarks(landmarks, handedness)
    points = analysis["points"]
    raw_normalized = points.reshape(-1).astype(np.float32)

    structural_blocks = [
        analysis["extension_scores"],
        analysis["extended_flags"],
        analysis["curl_scores"],
        analysis["adjacent_tip_distance"],
        analysis["thumb_to_tip_distance"],
        analysis["tip_to_wrist_distance"],
        analysis["mcp_spread"],
        analysis["joint_angle_features"],
        analysis["palm_orientation"],
        analysis["thumb_crossing"],
        analysis["index_direction"],
        analysis["motion_letter_hints"],
    ]

    engineered = np.concatenate(structural_blocks).astype(np.float32)
    return np.concatenate([raw_normalized, engineered]).astype(np.float32)
