from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"

LANDMARKS_DIR = BASE_DIR / "landmarks"
STATIC_WORD_LANDMARKS_DIR = BASE_DIR / "word_landmarks"
GESTURES_DIR = BASE_DIR / "gestures"
UPLOADS_DIR = BASE_DIR / "uploads"
FEEDBACK_UPLOAD_DIR = UPLOADS_DIR / "feedback"
AUDIT_UPLOAD_DIR = UPLOADS_DIR / "audit"
MODELS_DIR = BASE_DIR / "models"

LANDMARKS_MODEL_PATH = MODELS_DIR / "asl_landmarks_model.joblib"
LANDMARKS_MODEL_METADATA_PATH = MODELS_DIR / "asl_landmarks_model_meta.json"
LANDMARKS_MODEL_VERSIONS_DIR = MODELS_DIR / "landmark_versions"
LANDMARKS_ARCHIVED_MODEL_VERSIONS_DIR = MODELS_DIR / "archived_models"
LANDMARKS_MODEL_REGISTRY_PATH = MODELS_DIR / "landmark_model_registry.json"
GESTURE_MODEL_PATH = MODELS_DIR / "asl_gesture_model.joblib"

for path in (
    LANDMARKS_DIR,
    STATIC_WORD_LANDMARKS_DIR,
    GESTURES_DIR,
    FEEDBACK_UPLOAD_DIR,
    AUDIT_UPLOAD_DIR,
    MODELS_DIR,
    LANDMARKS_MODEL_VERSIONS_DIR,
    LANDMARKS_ARCHIVED_MODEL_VERSIONS_DIR,
):
    path.mkdir(parents=True, exist_ok=True)
