import sys
import unittest
from pathlib import Path

from pydantic import ValidationError


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class SchemaTests(unittest.TestCase):
    def test_predict_landmarks_rejects_unknown_label_space(self):
        from app.schemas.ml import PredictLandmarksReq

        with self.assertRaises(ValidationError):
            PredictLandmarksReq(landmarks=[], handedness="Right", labelSpace="phrases")

    def test_upload_landmarks_rejects_invalid_camera_position(self):
        from app.schemas.ml import UploadLandmarksReq

        with self.assertRaises(ValidationError):
            UploadLandmarksReq(
                label="A",
                landmarks=[],
                handedness="Right",
                camera_position="side",
            )

    def test_gesture_v2_frame_parses_nested_upper_body(self):
        from app.schemas.ml import GestureV2FrameReq

        frame = GestureV2FrameReq(
            handLandmarks=[{"x": 0, "y": 0, "z": 0}],
            handedness="Right",
            upperBody={
                "leftShoulder": {"x": 0.4, "y": 0.3, "z": 0, "visibility": 0.9},
                "rightShoulder": {"x": 0.6, "y": 0.3, "z": 0, "visibility": 0.9},
            },
            timestampMs=123.4,
        )

        self.assertEqual(frame.handedness, "Right")
        self.assertEqual(frame.timestampMs, 123.4)
        self.assertIsNotNone(frame.upperBody.leftShoulder)

    def test_train_landmarks_requires_label_and_note(self):
        from app.schemas.ml import TrainLandmarksReq

        with self.assertRaises(ValidationError):
            TrainLandmarksReq(trainingMode="bootstrap", label="May Bootstrap")


if __name__ == "__main__":
    unittest.main()

