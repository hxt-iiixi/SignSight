from fastapi import APIRouter

from app.schemas.ml import PredictLandmarksReq, UploadLandmarksReq
from app.services.landmark_classifier import (
    predict_landmarks,
    train_landmarks_model,
    upload_landmarks,
)


router = APIRouter()


@router.post("/upload_landmarks")
def upload_landmarks_route(req: UploadLandmarksReq):
    return upload_landmarks(
        req.label,
        req.landmarks,
        req.handedness,
        signer_id=req.signer_id,
        capture_session_id=req.capture_session_id,
        device_id=req.device_id,
        camera_position=req.camera_position,
        accepted=req.accepted,
        review_status=req.review_status,
        review_notes=req.review_notes,
        variant_tags=req.variant_tags,
        captured_at=req.captured_at,
    )


@router.post("/train_landmarks")
def train_landmarks():
    return train_landmarks_model()


@router.post("/predict_landmarks")
def predict_landmarks_route(req: PredictLandmarksReq):
    return predict_landmarks(req.landmarks, req.handedness)
