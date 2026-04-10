from fastapi import APIRouter

from app.services.upload_service import resolve_upload_response


router = APIRouter()


@router.get("/uploads/{kind}/{filename}")
def get_upload(kind: str, filename: str):
    return resolve_upload_response(kind, filename)
