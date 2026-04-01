from fastapi import APIRouter

from app.services.gesture_classifier import health_summary as gesture_health
from app.services.landmark_classifier import health_summary as landmark_health
from app.services.static_word_landmark_classifier import (
    health_summary as static_word_landmark_health,
)


router = APIRouter()


@router.get("/health")
def health():
    return {
        "ok": True,
        **landmark_health(),
        **static_word_landmark_health(),
        **gesture_health(),
    }
