from typing import Optional

from pydantic import BaseModel


class AdminLoginIn(BaseModel):
    username: str
    password: str


class AuditIn(BaseModel):
    title: str
    details: Optional[str] = None
    category: str = "other"
