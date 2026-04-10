from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


mongo_client = AsyncIOMotorClient(settings.mongo_uri)
mongo_db = mongo_client[settings.mongo_db]
feedback_col = mongo_db["feedback"]
audit_col = mongo_db["audit"]


async def ensure_indexes() -> None:
    await feedback_col.create_index([("created_at", -1)])
    await feedback_col.create_index([("resolved", 1), ("created_at", -1)])
    await feedback_col.create_index([("category", 1), ("created_at", -1)])
    await feedback_col.create_index([("message", "text")])
    await audit_col.create_index([("created_at", -1)])
    await audit_col.create_index([("category", 1), ("created_at", -1)])
    await audit_col.create_index([("title", "text"), ("details", "text")])
