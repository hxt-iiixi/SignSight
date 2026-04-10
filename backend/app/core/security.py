from datetime import datetime, timedelta

from fastapi import Header, HTTPException
from jose import JWTError, jwt

from app.core.config import settings


def create_admin_token() -> str:
    payload = {
        "sub": "admin",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=12),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def verify_admin_credentials(username: str, password: str) -> bool:
    return username == settings.admin_user and password == settings.admin_pass


def require_admin(authorization: str | None = Header(None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.split(" ", 1)[1]
    try:
        jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid/expired token") from exc
