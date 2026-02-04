# server/server.py
import os, base64, io
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

DATASET_DIR = "./dataset"
LABELS = [
  "A","B","C","D","E","F","G","H","I","J",
  "K","L","M","N","O","P","Q","R","S","T",
  "U","V","W","X","Y","Z"
]
IMG_SIZE = (64, 64)

app = FastAPI()

# allow Expo Go to call your server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model: Optional[KNeighborsClassifier] = None

class UploadReq(BaseModel):
    label: str
    imageBase64: str

class PredictReq(BaseModel):
    imageBase64: str


def ensure_dirs():
    os.makedirs(DATASET_DIR, exist_ok=True)
    for l in LABELS:
        os.makedirs(os.path.join(DATASET_DIR, l), exist_ok=True)


def b64_to_vec(b64: str) -> np.ndarray:
    # handle "data:image/jpeg;base64,...." too
    if "," in b64:
        b64 = b64.split(",", 1)[1]

    img_bytes = base64.b64decode(b64)
    img = Image.open(io.BytesIO(img_bytes)).convert("L").resize(IMG_SIZE)
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
                img = Image.open(path).convert("L").resize(IMG_SIZE)
                arr = np.asarray(img, dtype=np.float32) / 255.0
                X.append(arr.flatten())
                y.append(label)
            except:
                pass
    return np.array(X), np.array(y)


def train_model():
    global model
    X, y = load_dataset()
    if len(X) < 5:
        model = None
        return {"trained": False, "reason": "Not enough images", "count": int(len(X))}
    knn = KNeighborsClassifier(n_neighbors=3)
    knn.fit(X, y)
    model = knn
    return {"trained": True, "count": int(len(X))}


@app.get("/health")
def health():
    ensure_dirs()
    return {"ok": True}


@app.post("/upload")
def upload(req: UploadReq):
    ensure_dirs()
    label = req.label.upper()
    if label not in LABELS:
        return {"ok": False, "error": f"Invalid label {label}. Allowed: {LABELS}"}

    # save file
    vec = b64_to_vec(req.imageBase64)  # just to validate base64
    filename = f"{label}_{len(os.listdir(os.path.join(DATASET_DIR, label)))}.jpg"
    out_path = os.path.join(DATASET_DIR, label, filename)

    # decode and save actual image
    b64 = req.imageBase64.split(",", 1)[1] if "," in req.imageBase64 else req.imageBase64
    img_bytes = base64.b64decode(b64)
    with open(out_path, "wb") as f:
        f.write(img_bytes)

    return {"ok": True, "saved": out_path}


@app.post("/train")
def train():
    ensure_dirs()
    return train_model()


@app.post("/predict")
def predict(req: PredictReq):
    ensure_dirs()
    global model
    if model is None:
        # auto-train if not trained yet
        train_model()
        if model is None:
            return {"label": "?", "confidence": 0.0, "error": "Model not trained yet"}

    x = b64_to_vec(req.imageBase64).reshape(1, -1)
    label = model.predict(x)[0]

    # simple confidence = fraction of neighbors that agree
    neighbors = model.kneighbors(x, return_distance=False)[0]
    neighbor_labels = model._y[neighbors]
    conf = float(np.mean(neighbor_labels == label))

    return {"label": str(label), "confidence": conf}
