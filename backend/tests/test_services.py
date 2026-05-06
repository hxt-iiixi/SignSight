import asyncio
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class UploadServiceTests(unittest.TestCase):
    def test_safe_join_strips_path_traversal(self):
        from app.services.upload_service import safe_join

        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            path = safe_join(base, "../../secret.txt")

        self.assertEqual(path.name, "secret.txt")
        self.assertNotIn("..", path.parts)

    def test_resolve_upload_rejects_unknown_kind(self):
        from app.services.upload_service import resolve_upload_response

        with self.assertRaises(HTTPException) as ctx:
            resolve_upload_response("models", "file.png")

        self.assertEqual(ctx.exception.status_code, 404)


class FeedbackServiceTests(unittest.TestCase):
    def test_create_feedback_rejects_short_message(self):
        from app.services.feedback_service import create_feedback_document

        result = asyncio.run(create_feedback_document(message="ok"))

        self.assertEqual(result, {"ok": False, "error": "Message too short"})

    def test_create_feedback_persists_normalized_document(self):
        from app.services.feedback_service import create_feedback_document

        fake_insert_result = type("InsertResult", (), {"inserted_id": "abc123"})()

        with (
            patch("app.services.feedback_service.save_uploads", new=AsyncMock(return_value=[])),
            patch(
                "app.services.feedback_service.insert_feedback",
                new=AsyncMock(return_value=fake_insert_result),
            ) as insert_feedback,
        ):
            result = asyncio.run(
                create_feedback_document(
                    message="  Camera overlay is hard to read  ",
                    category="UI",
                    rating=4,
                    device="Pixel",
                    app_version="1.0.0",
                    platform="android",
                )
            )

        self.assertTrue(result["ok"])
        saved_doc = insert_feedback.await_args.args[0]
        self.assertEqual(saved_doc["message"], "Camera overlay is hard to read")
        self.assertEqual(saved_doc["category"], "ui")
        self.assertFalse(saved_doc["resolved"])
        self.assertEqual(saved_doc["status"], "open")


class ClassifierValidationTests(unittest.TestCase):
    def test_upload_landmarks_rejects_motion_only_letter(self):
        from app.services.landmark_classifier import upload_landmarks

        result = upload_landmarks(
            "J",
            landmarks=[],
            handedness="Right",
            signer_id="signer",
            capture_session_id="session",
            camera_position="back",
        )

        self.assertFalse(result["ok"])
        self.assertIn("motion-only", result["error"])

    def test_upload_gesture_rejects_unknown_label(self):
        from app.services.gesture_classifier import upload_gesture

        result = upload_gesture("UNKNOWN", frames=[], handedness="Right")

        self.assertFalse(result["ok"])
        self.assertIn("Invalid label", result["error"])

    def test_upload_gesture_requires_review_metadata_for_approved_records(self):
        from app.services.gesture_classifier import upload_gesture

        result = upload_gesture(
            "HELLO",
            frames=[],
            handedness="Right",
            accepted=True,
            review_status="approved",
        )

        self.assertFalse(result["ok"])
        self.assertIn("signer_id is required", result["error"])


if __name__ == "__main__":
    unittest.main()

