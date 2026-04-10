from typing import Any

from app.repositories.mongo import audit_col


async def insert_audit(doc: dict[str, Any]):
    return await audit_col.insert_one(doc)


async def list_audit_docs(query: dict[str, Any], limit: int):
    cursor = audit_col.find(query).sort("created_at", -1).limit(min(limit, 500))
    rows = []
    async for doc in cursor:
        rows.append(doc)
    return rows
