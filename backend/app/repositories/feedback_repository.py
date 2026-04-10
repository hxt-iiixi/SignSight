from typing import Any

from app.repositories.mongo import feedback_col


async def insert_feedback(doc: dict[str, Any]):
    return await feedback_col.insert_one(doc)


async def list_feedback_docs(query: dict[str, Any], limit: int):
    cursor = feedback_col.find(query).sort("created_at", -1).limit(min(limit, 500))
    rows = []
    async for doc in cursor:
        rows.append(doc)
    return rows


async def resolve_feedback_doc(oid):
    return await feedback_col.update_one(
        {"_id": oid},
        {"$set": {"resolved": True, "status": "resolved"}},
    )


def feedback_cursor_for_export():
    return feedback_col.find({}).sort("created_at", -1)
