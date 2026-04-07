from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.feedback import FeedbackIn
from app.services.feedback_service import create_feedback_document


router = APIRouter()


@router.post("/feedback")
async def create_feedback(body: FeedbackIn):
    result = await create_feedback_document(
        message=body.message,
        category=body.category,
        rating=body.rating,
        device=body.device,
        app_version=body.app_version,
        platform=body.platform,
    )
    if result.get("ok"):
        return {"ok": True, "id": result["id"]}
    return result


@router.post("/feedback_multipart")
async def create_feedback_multipart(
    message: str = Form(...),
    category: str = Form("general"),
    rating: Optional[int] = Form(None),
    device: Optional[str] = Form(None),
    app_version: Optional[str] = Form(None),
    platform: Optional[str] = Form(None),
    images: Optional[list[UploadFile]] = File(None),
):
    return await create_feedback_document(
        message=message,
        category=category,
        rating=rating,
        device=device,
        app_version=app_version,
        platform=platform,
        images=images,
    )
