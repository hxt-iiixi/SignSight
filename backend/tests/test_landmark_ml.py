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


class LandmarkMlTests(unittest.TestCase):
    def test_landmark_feature_vector_has_expected_shape_and_dtype(self):
        from app.ml.landmarks import landmark_feature_vector

        vec = landmark_feature_vector(sample_landmarks(), "Right")

        self.assertEqual(vec.shape, (115,))
        self.assertEqual(vec.dtype, np.float32)
        self.assertTrue(np.isfinite(vec).all())

    def test_normalize_landmarks_mirrors_left_hands(self):
        from app.ml.landmarks import normalize_landmarks

        right = normalize_landmarks(sample_landmarks(), "Right").reshape(21, 3)
        left = normalize_landmarks(sample_landmarks(), "Left").reshape(21, 3)

        self.assertAlmostEqual(float(right[1, 0]), -float(left[1, 0]), places=6)
        self.assertAlmostEqual(float(right[1, 1]), float(left[1, 1]), places=6)

    def test_analyze_hand_landmarks_exposes_expected_metrics(self):
        from app.ml.landmarks import analyze_hand_landmarks

        analysis = analyze_hand_landmarks(sample_landmarks(), "Right")

        for key in [
            "points",
            "extension_scores",
            "extended_flags",
            "curl_scores",
            "adjacent_tip_distance",
            "thumb_to_tip_distance",
            "tip_to_wrist_distance",
            "palm_orientation",
            "thumb_crossing",
        ]:
            self.assertIn(key, analysis)

        self.assertEqual(analysis["points"].shape, (21, 3))
        self.assertEqual(analysis["extension_scores"].shape, (5,))


if __name__ == "__main__":
    unittest.main()

