from dotenv import load_dotenv

from app.core.paths import ENV_FILE


load_dotenv(ENV_FILE)


class Settings:
    mongo_uri = "mongodb://127.0.0.1:27017"
    mongo_db = "signsight"
    jwt_secret = ""
    jwt_alg = "HS256"
    admin_user = ""
    admin_pass = ""
    cors_allow_origins = ["*"]

    def __init__(self) -> None:
        import os

        self.mongo_uri = os.getenv("MONGO_URI", self.mongo_uri)
        self.mongo_db = os.getenv("MONGO_DB", self.mongo_db)
        self.jwt_secret = os.getenv("JWT_SECRET", self.jwt_secret)
        self.admin_user = os.getenv("ADMIN_USER", self.admin_user)
        self.admin_pass = os.getenv("ADMIN_PASS", self.admin_pass)
        self._validate_auth_settings()

    def _validate_auth_settings(self) -> None:
        insecure_jwt_values = {"change_me", "change_me_now"}
        insecure_admin_pass_values = {"admin123", "password", "changeme"}

        if not self.jwt_secret or self.jwt_secret in insecure_jwt_values or len(self.jwt_secret) < 32:
            raise RuntimeError(
                "JWT_SECRET must be set to a strong value (at least 32 characters) in backend/.env."
            )
        if not self.admin_user:
            raise RuntimeError("ADMIN_USER must be set in backend/.env.")
        if (
            not self.admin_pass
            or self.admin_pass in insecure_admin_pass_values
            or len(self.admin_pass) < 12
        ):
            raise RuntimeError(
                "ADMIN_PASS must be set to a strong value (at least 12 characters) in backend/.env."
            )


settings = Settings()
