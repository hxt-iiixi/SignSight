import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.paths import AUDIT_UPLOAD_DIR, FEEDBACK_UPLOAD_DIR


def safe_join(base_dir: Path, filename: str) -> Path:
    return base_dir / os.path.basename(filename)


async def save_uploads(files: Optional[list[UploadFile]], target_dir: Path) -> list:
    if not files:
        return []

    saved = []
    for upload in files:
        try:
            if not upload:
                continue

            content_type = (upload.content_type or "").lower()
            if not content_type.startswith("image/"):
                continue

            ext = Path(upload.filename or "").suffix.lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".heic"]:
                ext = ext or ".jpg"

            name = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}{ext}"
            path = safe_join(target_dir, name)

            data = await upload.read()
            with open(path, "wb") as output:
                output.write(data)

            saved.append(
                {
                    "filename": name,
                    "content_type": upload.content_type,
                    "path": str(path),
                }
            )
        except Exception:
            pass

    return saved


def resolve_upload_response(kind: str, filename: str) -> FileResponse:
    if kind not in ["feedback", "audit"]:
        raise HTTPException(status_code=404, detail="Not found")

    base_dir = FEEDBACK_UPLOAD_DIR if kind == "feedback" else AUDIT_UPLOAD_DIR
    path = safe_join(base_dir, filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(path)
