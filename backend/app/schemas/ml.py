from typing import Optional

from pydantic import BaseModel


class PredictReq(BaseModel):
    imageBase64: str


class UploadReq(BaseModel):
    label: str
    imageBase64: str


class UploadLandmarksReq(BaseModel):
    label: str
    landmarks: list
    handedness: Optional[str] = None


class PredictLandmarksReq(BaseModel):
    landmarks: list
    handedness: Optional[str] = None


class UploadGestureReq(BaseModel):
    label: str
    frames: list
    handedness: Optional[str] = None


class PredictGestureReq(BaseModel):
    frames: list
    handedness: Optional[str] = None
