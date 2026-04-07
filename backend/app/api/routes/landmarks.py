from fastapi import APIRouter

from app.schemas.ml import (
    ActivateLandmarkModelReq,
    ArchiveLandmarkModelReq,
    LandmarkLabelSummaryReq,
    PredictLandmarksReq,
    RenameLandmarkModelReq,
    TrainLandmarksReq,
    UploadLandmarksReq,
)
from app.services.landmark_classifier import (
    activate_landmark_model_version,
    archive_landmark_model_version,
    landmark_label_summary,
    predict_landmarks,
    rename_landmark_model_version,
    train_landmarks_model,
    upload_landmarks,
    upload_static_word_landmark,
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
def train_landmarks(req: TrainLandmarksReq):
    return train_landmarks_model(req.trainingMode, label=req.label, note=req.note)


@router.post("/upload_static_word_landmarks")
def upload_static_word_landmarks_route(req: UploadLandmarksReq):
    return upload_static_word_landmark(
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


@router.post("/activate_landmark_model")
def activate_landmark_model(req: ActivateLandmarkModelReq):
    return activate_landmark_model_version(req.versionId)


@router.post("/rename_landmark_model")
def rename_landmark_model(req: RenameLandmarkModelReq):
    return rename_landmark_model_version(req.versionId, req.label)


@router.post("/archive_landmark_model")
def archive_landmark_model(req: ArchiveLandmarkModelReq):
    return archive_landmark_model_version(req.versionId)


@router.post("/landmark_label_summary")
def landmark_label_summary_route(req: LandmarkLabelSummaryReq):
    return landmark_label_summary(
        req.label,
        capture_session_id=req.captureSessionId,
        signer_id=req.signerId,
    )


@router.post("/predict_landmarks")
def predict_landmarks_route(req: PredictLandmarksReq):
    return predict_landmarks(req.landmarks, req.handedness, req.labelSpace)
