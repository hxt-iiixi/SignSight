import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
MONGO_DB = os.getenv("MONGO_DB", "signsight")

client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]

feedback_col = db["feedback"]

async def ensure_indexes():
    # fast filters + sorting
    await feedback_col.create_index([("created_at", -1)])
    await feedback_col.create_index([("resolved", 1), ("created_at", -1)])
    await feedback_col.create_index([("category", 1), ("created_at", -1)])
    # text search on message
    await feedback_col.create_index([("message", "text")])
