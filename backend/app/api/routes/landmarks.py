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
    return upload_landmarks(req.label, req.landmarks, req.handedness)


@router.post("/train_landmarks")
def train_landmarks():
    ok = train_landmarks_model()
    return {"ok": ok}


@router.post("/predict_landmarks")
def predict_landmarks_route(req: PredictLandmarksReq):
    return predict_landmarks(req.landmarks, req.handedness)
