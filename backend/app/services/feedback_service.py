from datetime import datetime
from typing import Optional

from fastapi import UploadFile

from app.core.paths import FEEDBACK_UPLOAD_DIR
from app.repositories.feedback_repository import insert_feedback, list_feedback_docs
from app.services.upload_service import save_uploads


async def create_feedback_document(
    *,
    message: str,
    category: str = "general",
    rating: Optional[int] = None,
    device: Optional[str] = None,
    app_version: Optional[str] = None,
    platform: Optional[str] = None,
    images: Optional[list[UploadFile]] = None,
):
    msg = (message or "").strip()
    if len(msg) < 3:
        return {"ok": False, "error": "Message too short"}

    saved = await save_uploads(images, FEEDBACK_UPLOAD_DIR)
    doc = {
        "created_at": datetime.utcnow(),
        "message": msg,
        "category": (category or "general").strip().lower(),
        "rating": rating,
        "device": device,
        "app_version": app_version,
        "platform": platform,
        "resolved": False,
        "status": "open",
        "images": saved,
    }
    res = await insert_feedback(doc)
    return {"ok": True, "id": str(res.inserted_id), "images": [s["filename"] for s in saved]}


async def list_feedback_view(query: dict, limit: int):
    rows = await list_feedback_docs(query, limit)
    result = []
    for doc in rows:
        doc["id"] = str(doc.pop("_id"))
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
            imgs = doc.get("images") or []
            doc["image_urls"] = [
                f"/uploads/feedback/{(image or {}).get('filename', '').split('/')[-1]}"
                for image in imgs
                if image and image.get("filename")
            ]
        result.append(doc)
    return result
