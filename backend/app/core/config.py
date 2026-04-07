from dotenv import load_dotenv

from app.core.paths import ENV_FILE


load_dotenv(ENV_FILE)


class Settings:
    mongo_uri = "mongodb://127.0.0.1:27017"
    mongo_db = "signsight"
    jwt_secret = "change_me"
    jwt_alg = "HS256"
    admin_user = "admin"
    admin_pass = "admin123"
    cors_allow_origins = ["*"]

    def __init__(self) -> None:
        import os

        self.mongo_uri = os.getenv("MONGO_URI", self.mongo_uri)
        self.mongo_db = os.getenv("MONGO_DB", self.mongo_db)
        self.jwt_secret = os.getenv("JWT_SECRET", self.jwt_secret)
        self.admin_user = os.getenv("ADMIN_USER", self.admin_user)
        self.admin_pass = os.getenv("ADMIN_PASS", self.admin_pass)


settings = Settings()
