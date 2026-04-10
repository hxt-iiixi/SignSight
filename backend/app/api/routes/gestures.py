from fastapi import APIRouter

from app.schemas.ml import GestureLabelSummaryReq, PredictGestureReq, UploadGestureReq
from app.services.gesture_classifier import (
    gesture_label_summary,
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


@router.post("/gesture_label_summary")
def gesture_label_summary_route(req: GestureLabelSummaryReq):
    return gesture_label_summary(
        req.label,
        capture_session_id=req.captureSessionId,
        signer_id=req.signerId,
    )
