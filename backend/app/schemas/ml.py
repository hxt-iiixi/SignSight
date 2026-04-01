from typing import Literal, Optional

from pydantic import BaseModel


class UploadLandmarksReq(BaseModel):
    label: str
    landmarks: list
    handedness: Optional[str] = None
    signer_id: Optional[str] = None
    capture_session_id: Optional[str] = None
    device_id: Optional[str] = None
    camera_position: Optional[Literal["front", "back"]] = None
    accepted: Optional[bool] = None
    review_status: Optional[Literal["pending", "approved", "rejected"]] = None
    review_notes: Optional[str] = None
    variant_tags: Optional[list[str]] = None
    captured_at: Optional[str] = None


class PredictLandmarksReq(BaseModel):
    landmarks: list
    handedness: Optional[str] = None
    labelSpace: Optional[Literal["letters", "words"]] = None


class TrainLandmarksReq(BaseModel):
    trainingMode: Optional[Literal["bootstrap", "full_reviewed"]] = None


class ActivateLandmarkModelReq(BaseModel):
    versionId: str


class RenameLandmarkModelReq(BaseModel):
    versionId: str
    label: str


class LandmarkLabelSummaryReq(BaseModel):
    label: str
    captureSessionId: Optional[str] = None
    signerId: Optional[str] = None


class UploadGestureReq(BaseModel):
    label: str
    frames: list
    handedness: Optional[str] = None


class PredictGestureReq(BaseModel):
    frames: list
    handedness: Optional[str] = None
