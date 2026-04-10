from typing import Literal, Optional

from pydantic import BaseModel


class LandmarkPointReq(BaseModel):
    x: float
    y: float
    z: float


class UpperBodyPointReq(BaseModel):
    x: float
    y: float
    z: float
    visibility: Optional[float] = None


class UpperBodyLandmarksReq(BaseModel):
    nose: Optional[UpperBodyPointReq] = None
    leftEar: Optional[UpperBodyPointReq] = None
    rightEar: Optional[UpperBodyPointReq] = None
    leftShoulder: Optional[UpperBodyPointReq] = None
    rightShoulder: Optional[UpperBodyPointReq] = None
    leftElbow: Optional[UpperBodyPointReq] = None
    rightElbow: Optional[UpperBodyPointReq] = None
    leftWrist: Optional[UpperBodyPointReq] = None
    rightWrist: Optional[UpperBodyPointReq] = None
    leftHip: Optional[UpperBodyPointReq] = None
    rightHip: Optional[UpperBodyPointReq] = None


class GestureV2FrameReq(BaseModel):
    handLandmarks: Optional[list[LandmarkPointReq]] = None
    handedness: Optional[str] = None
    upperBody: Optional[UpperBodyLandmarksReq] = None
    timestampMs: float


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
    label: str
    note: str


class ActivateLandmarkModelReq(BaseModel):
    versionId: str


class RenameLandmarkModelReq(BaseModel):
    versionId: str
    label: str


class ArchiveLandmarkModelReq(BaseModel):
    versionId: str


class LandmarkLabelSummaryReq(BaseModel):
    label: str
    captureSessionId: Optional[str] = None
    signerId: Optional[str] = None


class UploadGestureReq(BaseModel):
    label: str
    frames: list
    handedness: Optional[str] = None
    framesV2: Optional[list[GestureV2FrameReq]] = None


class PredictGestureReq(BaseModel):
    frames: list
    handedness: Optional[str] = None
    framesV2: Optional[list[GestureV2FrameReq]] = None
