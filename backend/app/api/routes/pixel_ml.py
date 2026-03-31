from fastapi import APIRouter

from app.schemas.ml import PredictReq, UploadReq
from app.services.pixel_classifier import predict_from_base64, train_model, upload_training_image


router = APIRouter()


@router.post("/train")
def train():
    ok = train_model()
    return {"ok": ok}


@router.post("/predict")
def predict(req: PredictReq):
    return predict_from_base64(req.imageBase64)


@router.post("/upload")
def upload(req: UploadReq):
    return upload_training_image(req.label, req.imageBase64)
