import os
import json
from fastapi import APIRouter

router = APIRouter()

@router.get("/models")
def get_models():
    models_dir = os.path.join(os.getcwd(), "models")
    model_list = []
    
    if not os.path.exists(models_dir):
        return {"models": []}
        
    for root, dirs, files in os.walk(models_dir):
        if "archived_models" in dirs:
            dirs.remove("archived_models")
            
        for file in files:
            if file.endswith(".joblib") or file.endswith(".json"):
                # Get path relative to the models dir
                rel_path = os.path.relpath(os.path.join(root, file), models_dir)
                
                model_data = {"path": rel_path, "type": "joblib" if file.endswith(".joblib") else "json"}
                
                if file.endswith(".json"):
                    try:
                        with open(os.path.join(root, file), "r") as f:
                            data = json.load(f)
                        model_data["info"] = data
                    except Exception:
                        pass
                
                model_list.append(model_data)
                
    return {"models": sorted(model_list, key=lambda x: x["path"])}
