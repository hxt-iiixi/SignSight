import io
import os
import csv
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, UploadFile

from app.core.constants import AUDIT_CATEGORIES
from app.core.paths import AUDIT_UPLOAD_DIR
from app.repositories.audit_repository import insert_audit, list_audit_docs
from app.repositories.feedback_repository import (
    feedback_cursor_for_export,
    resolve_feedback_doc,
)
from app.services.upload_service import save_uploads


async def create_audit_document(
    *,
    title: str,
    details: Optional[str] = None,
    category: str = "other",
    images: Optional[list[UploadFile]] = None,
):
    normalized_title = (title or "").strip()
    if len(normalized_title) < 2:
        return {"ok": False, "error": "Title too short"}

    normalized_category = (category or "other").strip().lower()
    if normalized_category not in AUDIT_CATEGORIES:
        normalized_category = "other"

    saved = await save_uploads(images, AUDIT_UPLOAD_DIR)
    doc = {
        "created_at": datetime.utcnow(),
        "title": normalized_title,
        "details": (details or "").strip() if details else None,
        "category": normalized_category,
        "images": saved,
    }
    res = await insert_audit(doc)
    return {"ok": True, "id": str(res.inserted_id), "images": [s["filename"] for s in saved]}


async def list_audit_view(query: dict, limit: int):
    rows = await list_audit_docs(query, limit)
    result = []
    for doc in rows:
        doc["id"] = str(doc.pop("_id"))
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()

        imgs = doc.get("images") or []
        doc["image_urls"] = [
            f"/uploads/audit/{os.path.basename(image.get('filename', ''))}"
            for image in imgs
            if image and image.get("filename")
        ]
        result.append(doc)
    return result


async def resolve_feedback_and_audit(feedback_id: str):
    try:
        oid = ObjectId(feedback_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc

    res = await resolve_feedback_doc(oid)
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")

    await insert_audit(
        {
            "created_at": datetime.utcnow(),
            "title": "Resolved feedback",
            "details": f"Feedback ID: {feedback_id}",
            "category": "other",
            "images": [],
        }
    )
    return {"ok": True}


async def export_feedback_csv_text() -> str:
    cursor = feedback_cursor_for_export()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "created_at",
            "category",
            "rating",
            "message",
            "device",
            "app_version",
            "platform",
            "status",
            "resolved",
        ]
    )

    async for row in cursor:
        writer.writerow(
            [
                str(row.get("_id")),
                row.get("created_at").isoformat() if row.get("created_at") else "",
                row.get("category", ""),
                row.get("rating", ""),
                (row.get("message", "") or "").replace("\n", " "),
                row.get("device", ""),
                row.get("app_version", ""),
                row.get("platform", ""),
                row.get("status", ""),
                row.get("resolved", ""),
            ]
        )

    return output.getvalue()
