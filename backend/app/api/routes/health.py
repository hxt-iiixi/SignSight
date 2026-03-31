from fastapi import APIRouter

from app.core.paths import DATASET_DIR
from app.services.gesture_classifier import health_summary as gesture_health
from app.services.landmark_classifier import health_summary as landmark_health
from app.services.pixel_classifier import health_summary as pixel_health


router = APIRouter()


@router.get("/health")
def health():
    return {
        "ok": True,
        **pixel_health(),
        **landmark_health(),
        "dataset_dir": str(DATASET_DIR),
        **gesture_health(),
    }
