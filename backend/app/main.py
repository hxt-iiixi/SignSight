from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import gestures, health, landmarks, uploads
from app.core.config import settings
from app.services.gesture_classifier import bootstrap_gesture_model
from app.services.landmark_classifier import bootstrap_landmark_model
from app.services.static_word_landmark_classifier import (
    bootstrap_static_word_landmark_model,
)


def create_app() -> FastAPI:
    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(uploads.router)
    app.include_router(landmarks.router)
    app.include_router(gestures.router)
    app.include_router(health.router)
    # Temporarily disabled while Mongo/admin is not in use.
    # app.include_router(feedback.router)
    # app.include_router(admin.router)

    @app.on_event("startup")
    async def on_startup() -> None:
        # Temporarily disabled while Mongo/admin is not in use.
        # await ensure_indexes()
        bootstrap_landmark_model()
        bootstrap_static_word_landmark_model()
        bootstrap_gesture_model()

    return app


app = create_app()
