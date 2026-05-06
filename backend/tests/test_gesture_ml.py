import sys
import unittest
from pathlib import Path

import numpy as np


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def sample_landmarks():
    return [
        {
            "x": 0.05 + (index % 5) * 0.04,
            "y": 0.10 + (index // 5) * 0.05,
            "z": index * 0.001,
        }
        for index in range(21)
    ]


class GestureMlTests(unittest.TestCase):
    def test_resample_frames_returns_requested_length(self):
        from app.ml.gestures import resample_frames

        frames = list(range(5))
        self.assertEqual(resample_frames(frames, target_len=8), [0, 0, 1, 1, 2, 2, 3, 4])

    def test_gesture_to_vec_returns_fixed_width_vector(self):
        from app.core.constants import GESTURE_FRAMES
        from app.ml.gestures import gesture_to_vec

        vec = gesture_to_vec([sample_landmarks()] * 3, "Right")

        self.assertEqual(vec.shape, (GESTURE_FRAMES * 63,))
        self.assertEqual(vec.dtype, np.float32)
        self.assertTrue(np.isfinite(vec).all())

    def test_gesture_v2_to_vec_includes_upper_body_features(self):
        from app.core.constants import GESTURE_FRAMES
        from app.ml.gestures import GESTURE_V2_UPPER_BODY_KEYS, gesture_v2_to_vec

        frame = {
            "handLandmarks": sample_landmarks(),
            "handedness": "Right",
            "upperBody": {
                "leftShoulder": {"x": 0.4, "y": 0.3, "z": 0.0, "visibility": 0.9},
                "rightShoulder": {"x": 0.6, "y": 0.3, "z": 0.0, "visibility": 0.9},
                "leftHip": {"x": 0.42, "y": 0.7, "z": 0.0, "visibility": 0.8},
                "rightHip": {"x": 0.58, "y": 0.7, "z": 0.0, "visibility": 0.8},
            },
            "timestampMs": 1000,
        }
        expected_frame_width = 63 + (len(GESTURE_V2_UPPER_BODY_KEYS) * 4)

        vec = gesture_v2_to_vec([frame] * 4)

        self.assertEqual(vec.shape, (GESTURE_FRAMES * expected_frame_width,))
        self.assertEqual(vec.dtype, np.float32)
        self.assertTrue(np.isfinite(vec).all())


if __name__ == "__main__":
    unittest.main()

