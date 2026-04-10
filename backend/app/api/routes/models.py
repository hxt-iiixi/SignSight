import json
import os
from fastapi import APIRouter
from app.core.paths import MODELS_DIR, LANDMARKS_MODEL_REGISTRY_PATH

router = APIRouter()

@router.get("/models")
def get_models():
    model_list = []

    if not MODELS_DIR.exists():
        return {"models": []}

    for root, _, files in os.walk(MODELS_DIR):
        for file in files:
            if file.endswith(".joblib") or file.endswith(".json"):
                file_path = MODELS_DIR.joinpath(os.path.relpath(os.path.join(root, file), MODELS_DIR))
                rel_path = str(file_path.relative_to(MODELS_DIR))

                model_data = {
                    "path": rel_path,
                    "type": "joblib" if file.endswith(".joblib") else "json",
                }

                if file.endswith(".json"):
                    try:
                        with open(file_path, "r") as f:
                            data = json.load(f)
                        model_data["info"] = data
                    except Exception:
                        pass

                model_list.append(model_data)

    registry = None
    if LANDMARKS_MODEL_REGISTRY_PATH.exists():
        try:
            registry = json.loads(LANDMARKS_MODEL_REGISTRY_PATH.read_text(encoding="utf-8"))
        except Exception:
            registry = None

    archived_versions = []
    if isinstance(registry, dict):
        raw_archived = registry.get("archived_versions")
        if isinstance(raw_archived, list):
            archived_versions = raw_archived

    archived_lookup = {
        str(item.get("version_id")): item
        for item in archived_versions
        if isinstance(item, dict) and item.get("version_id") is not None
    }

    for model_data in model_list:
        path = model_data["path"]
        model_data["is_archived"] = path.startswith("archived_models/")
        if model_data["type"] == "json" and model_data.get("is_archived"):
            version_id = path.rsplit("/", 1)[-1].replace(".json", "")
            info = model_data.get("info")
            if isinstance(info, dict) and version_id in archived_lookup:
                merged = dict(archived_lookup[version_id])
                merged.update(info)
                model_data["info"] = merged

    return {"models": sorted(model_list, key=lambda x: x["path"])}
