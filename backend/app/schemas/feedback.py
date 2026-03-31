from typing import Optional

from pydantic import BaseModel


class FeedbackIn(BaseModel):
    message: str
    category: str = "general"
    rating: Optional[int] = None
    device: Optional[str] = None
    app_version: Optional[str] = None
    platform: Optional[str] = None
