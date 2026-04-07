from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, Response, UploadFile

from app.core.security import create_admin_token, require_admin, verify_admin_credentials
from app.schemas.admin import AdminLoginIn, AuditIn
from app.services.audit_service import (
    create_audit_document,
    export_feedback_csv_text,
    list_audit_view,
    resolve_feedback_and_audit,
)
from app.services.feedback_service import list_feedback_view


router = APIRouter()


@router.post("/admin/login")
def admin_login(body: AdminLoginIn):
    if not verify_admin_credentials(body.username, body.password):
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"ok": True, "token": create_admin_token()}


@router.get("/admin/feedback")
async def list_feedback(
    q: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 200,
    _admin: None = Depends(require_admin),
):
    query: dict = {}
    if status == "open":
        query["resolved"] = False
    elif status == "resolved":
        query["resolved"] = True

    if category:
        query["category"] = category.strip().lower()

    if q and q.strip():
        query["$text"] = {"$search": q.strip()}

    return await list_feedback_view(query, limit)


@router.post("/admin/feedback/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: str,
    _admin: None = Depends(require_admin),
):
    return await resolve_feedback_and_audit(feedback_id)


@router.post("/admin/audit")
async def create_audit(
    body: AuditIn,
    _admin: None = Depends(require_admin),
):
    return await create_audit_document(
        title=body.title,
        details=body.details,
        category=body.category,
    )


@router.post("/admin/audit_multipart")
async def create_audit_multipart(
    title: str = Form(...),
    details: Optional[str] = Form(None),
    category: str = Form("other"),
    images: Optional[list[UploadFile]] = File(None),
    _admin: None = Depends(require_admin),
):
    return await create_audit_document(
        title=title,
        details=details,
        category=category,
        images=images,
    )


@router.get("/admin/audit")
async def list_audit(
    q: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 200,
    _admin: None = Depends(require_admin),
):
    query: dict = {}
    if category:
        query["category"] = category.strip().lower()

    if q and q.strip():
        query["$text"] = {"$search": q.strip()}

    return await list_audit_view(query, limit)


@router.get("/admin/export.csv")
async def export_feedback_csv(_admin: None = Depends(require_admin)):
    return Response(content=await export_feedback_csv_text(), media_type="text/csv")
