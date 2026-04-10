from fastapi import APIRouter

from app.schemas.ml import PredictGestureReq, UploadGestureReq
from app.services.gesture_classifier import (
    predict_gesture,
    train_gesture_model,
    upload_gesture,
)


router = APIRouter()


@router.post("/upload_gesture")
def upload_gesture_route(req: UploadGestureReq):
    return upload_gesture(
        req.label,
        req.frames,
        req.handedness,
        frames_v2=[frame.model_dump() for frame in req.framesV2] if req.framesV2 else None,
    )


@router.post("/train_gestures")
def train_gestures():
    return train_gesture_model()


@router.post("/predict_gesture")
def predict_gesture_route(req: PredictGestureReq):
    return predict_gesture(
        req.frames,
        req.handedness,
        frames_v2=[frame.model_dump() for frame in req.framesV2] if req.framesV2 else None,
    )
