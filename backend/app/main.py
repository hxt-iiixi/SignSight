from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, feedback, gestures, health, landmarks, pixel_ml, uploads
from app.core.config import settings
from app.repositories.mongo import ensure_indexes
from app.services.gesture_classifier import bootstrap_gesture_model
from app.services.landmark_classifier import bootstrap_landmark_model
from app.services.pixel_classifier import bootstrap_pixel_model


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
    app.include_router(pixel_ml.router)
    app.include_router(landmarks.router)
    app.include_router(gestures.router)
    app.include_router(health.router)
    app.include_router(feedback.router)
    app.include_router(admin.router)

    @app.on_event("startup")
    async def on_startup() -> None:
        await ensure_indexes()
        bootstrap_pixel_model()
        bootstrap_landmark_model()
        bootstrap_gesture_model()

    return app


app = create_app()
