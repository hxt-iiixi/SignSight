import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class AppRouteTests(unittest.TestCase):
    def test_create_app_registers_public_ml_and_admin_routes(self):
        with (
            patch("app.main.bootstrap_landmark_model"),
            patch("app.main.bootstrap_gesture_model"),
        ):
            from app.main import create_app

            app = create_app()

        paths = {route.path for route in app.routes}
        expected_paths = {
            "/health",
            "/models",
            "/predict_landmarks",
            "/upload_landmarks",
            "/upload_static_word_landmarks",
            "/train_landmarks",
            "/activate_landmark_model",
            "/rename_landmark_model",
            "/archive_landmark_model",
            "/landmark_label_summary",
            "/predict_gesture",
            "/upload_gesture",
            "/train_gestures",
            "/gesture_label_summary",
            "/uploads/{kind}/{filename}",
            "/feedback",
            "/feedback_multipart",
            "/admin/login",
            "/admin/feedback",
            "/admin/feedback/{feedback_id}/resolve",
            "/admin/audit",
            "/admin/audit_multipart",
            "/admin/export.csv",
        }

        self.assertTrue(expected_paths.issubset(paths))

    def test_create_app_configures_cors_middleware(self):
        with (
            patch("app.main.bootstrap_landmark_model"),
            patch("app.main.bootstrap_gesture_model"),
        ):
            from app.main import create_app

            app = create_app()

        middleware_names = {middleware.cls.__name__ for middleware in app.user_middleware}
        self.assertIn("CORSMiddleware", middleware_names)


if __name__ == "__main__":
    unittest.main()

