from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"

LANDMARKS_DIR = BASE_DIR / "landmarks"
GESTURES_DIR = BASE_DIR / "gestures"
UPLOADS_DIR = BASE_DIR / "uploads"
FEEDBACK_UPLOAD_DIR = UPLOADS_DIR / "feedback"
AUDIT_UPLOAD_DIR = UPLOADS_DIR / "audit"
MODELS_DIR = BASE_DIR / "models"

LANDMARKS_MODEL_PATH = MODELS_DIR / "asl_landmarks_model.joblib"
GESTURE_MODEL_PATH = MODELS_DIR / "asl_gesture_model.joblib"

for path in (
    LANDMARKS_DIR,
    GESTURES_DIR,
    FEEDBACK_UPLOAD_DIR,
    AUDIT_UPLOAD_DIR,
    MODELS_DIR,
):
    path.mkdir(parents=True, exist_ok=True)
