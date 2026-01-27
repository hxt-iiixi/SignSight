import base64
import io
import os
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

# ====== CONFIG ======
DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset")  # src/server/dataset
LABELS = ["A", "B", "C"]  # set to what you actually have
IMG_SIZE = (32, 32)

app = FastAPI()

class PredictReq(BaseModel):
    imageBase64: str

class UploadReq(BaseModel):
    label: str
    imageBase64: str

knn: Optional[KNeighborsClassifier] = None


def _clean_base64(s: str) -> str:
    # Handles "data:image/jpeg;base64,...."
    if "," in s:
        return s.split(",", 1)[1]
    return s


def img_to_vec(pil_img: Image.Image) -> np.ndarray:
    img = pil_img.convert("L").resize(IMG_SIZE)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr.flatten()


def load_dataset():
    X, y = [], []
    for label in LABELS:
        folder = os.path.join(DATASET_DIR, label)
        if not os.path.isdir(folder):
            continue
        for fn in os.listdir(folder):
            if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            path = os.path.join(folder, fn)
            try:
                pil = Image.open(path)
                X.append(img_to_vec(pil))
                y.append(label)
            except Exception:
                pass
    return np.array(X), np.array(y)


def train_model() -> bool:
    global knn
    X_train, y_train = load_dataset()

    if len(X_train) == 0:
        print("⚠️ No images found in ./dataset/<LABEL>. Add images to train.")
        knn = None
        return False

    model = KNeighborsClassifier(n_neighbors=3)
    model.fit(X_train, y_train)
    knn = model
    print(f"✅ Trained on {len(X_train)} images")
    return True


# Train once on startup
train_model()


@app.get("/health")
def health():
    return {"ok": True, "trained": knn is not None, "dataset_dir": DATASET_DIR}


@app.post("/predict")
def predict(req: PredictReq):
    if knn is None:
        return {"label": "NO_MODEL", "confidence": 0.0}

    b64 = _clean_base64(req.imageBase64)
    raw = base64.b64decode(b64)
    pil = Image.open(io.BytesIO(raw))

    vec = img_to_vec(pil).reshape(1, -1)
    pred = knn.predict(vec)[0]
    prob = float(np.max(knn.predict_proba(vec)))

    return {"label": pred, "confidence": prob}


# OPTIONAL: phone -> laptop dataset
@app.post("/upload")
def upload(req: UploadReq):
    label = req.label.strip().upper()
    if label not in LABELS:
        return {"ok": False, "error": f"Invalid label: {label}"}

    os.makedirs(os.path.join(DATASET_DIR, label), exist_ok=True)

    b64 = _clean_base64(req.imageBase64)
    raw = base64.b64decode(b64)
    pil = Image.open(io.BytesIO(raw)).convert("RGB")

    fn = f"{label}_{len(os.listdir(os.path.join(DATASET_DIR, label)))}.jpg"
    path = os.path.join(DATASET_DIR, label, fn)
    pil.save(path, format="JPEG", quality=90)

    return {"ok": True, "saved": path}


@app.post("/train")
def train():
    ok = train_model()
    return {"ok": ok}
