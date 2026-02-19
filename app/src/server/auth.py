import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from jose import jwt, JWTError

load_dotenv()

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me")
JWT_ALG = "HS256"

def verify_admin(username: str, password: str) -> bool:
    return username == ADMIN_USER and password == ADMIN_PASS

def create_token() -> str:
    payload = {
        "sub": "admin",
        "exp": datetime.utcnow() + timedelta(hours=12),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def require_admin(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise ValueError("Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise ValueError("Invalid/expired token")
