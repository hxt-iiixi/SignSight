import base64
import io
import os
from typing import Optional
import cv2
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
import joblib 
import json
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

LANDMARKS_DIR = os.path.join(os.path.dirname(__file__), "landmarks")
os.makedirs(LANDMARKS_DIR, exist_ok=True)

LANDMARKS_MODEL_PATH = os.path.join(os.path.dirname(__file__), "asl_landmarks_model.joblib")


MODEL_PATH = os.path.join(os.path.dirname(__file__), "asl_model.joblib")
# ====== CONFIG ======
DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset")  # src/server/dataset
LABELS = [
  "A","B","C"
]
TRAIN_COUNT = 0
CLASS_COUNTS = {}

IMG_SIZE = (32, 32)

app = FastAPI()
class UploadLandmarksReq(BaseModel):
    label: str
    landmarks: list  # list of 21 points {x,y,z}

class PredictLandmarksReq(BaseModel):
    landmarks: list
def landmarks_to_vec(landmarks: list) -> np.ndarray:
    # landmarks: 21 dicts with x,y,z
    # output: [x1,y1,z1, x2,y2,z2, ...] length=63
    vec = []
    for p in landmarks:
        vec.extend([float(p["x"]), float(p["y"]), float(p.get("z", 0.0))])
    return np.array(vec, dtype=np.float32)
landmark_model = None

def load_landmarks_dataset():
    X, y = [], []
    for label in LABELS:
        path = os.path.join(LANDMARKS_DIR, f"{label}.jsonl")
        if not os.path.exists(path):
            continue

        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    X.append(landmarks_to_vec(obj["landmarks"]))
                    y.append(obj["label"])
                except:
                    pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X), np.array(y)


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


def preprocess(img: Image.Image) -> np.ndarray:
    img = crop_hand(img)       # crop using RGB/HSV first
    img = img.convert("L")     # then grayscale

    w, h = img.size
    crop_ratio = 0.65
    cw, ch = int(w * crop_ratio), int(h * crop_ratio)
    left = (w - cw) // 2
    top = (h - ch) // 2
    img = img.crop((left, top, left + cw, top + ch))

    img = img.resize(IMG_SIZE)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr.flatten()


def crop_hand(pil_img: Image.Image) -> Image.Image:
    img = np.array(pil_img.convert("RGB"))
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

    # skin-ish range (tweak if needed)
    lower = np.array([0, 20, 70], dtype=np.uint8)
    upper = np.array([20, 255, 255], dtype=np.uint8)

    mask = cv2.inRange(hsv, lower, upper)
    mask = cv2.GaussianBlur(mask, (7, 7), 0)

    # find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return pil_img  # fallback

    c = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(c)

    # pad crop
    pad = int(0.15 * max(w, h))
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(img.shape[1], x + w + pad)
    y1 = min(img.shape[0], y + h + pad)

    cropped = img[y0:y1, x0:x1]
    return Image.fromarray(cropped)

def load_dataset():
    X, y = [], []
    for label in LABELS:
        folder = os.path.join(DATASET_DIR, label)
        if not os.path.isdir(folder):
            # folder missing => skip safely
            continue

        files = [f for f in os.listdir(folder) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        files = files[:500]  # cap per class

        for fn in files:
            path = os.path.join(folder, fn)
            try:
                pil = Image.open(path)
                X.append(preprocess(pil))
                y.append(label)
            except Exception:
                pass

    return np.array(X), np.array(y)



def train_model() -> bool:
    global knn
    X_train, y_train = load_dataset()
    global TRAIN_COUNT, CLASS_COUNTS
    TRAIN_COUNT = int(len(X_train))
    CLASS_COUNTS = {l: 0 for l in LABELS}
    for lab in y_train:
        CLASS_COUNTS[lab] += 1

    print("DEBUG: images found =", len(X_train))
    if len(X_train) == 0:
        print("⚠️ No images found in ./dataset/<LABEL>. Add images to train.")
        knn = None
        return False

    model = SVC(kernel="rbf", probability=True, gamma="scale", C=10)
    model.fit(X_train, y_train)
    knn = model
    joblib.dump(knn, MODEL_PATH)
    print(f"✅ Trained on {len(X_train)} images")
    return True

def train_landmarks_model() -> bool:
    global landmark_model

    X, y = load_landmarks_dataset()
    if len(X) == 0:
        landmark_model = None
        return False

    # fast + good starter
    model = KNeighborsClassifier(n_neighbors=5)
    model.fit(X, y)
    landmark_model = model
    joblib.dump(landmark_model, LANDMARKS_MODEL_PATH)
    return True


@app.post("/train_landmarks")
def train_landmarks():
    ok = train_landmarks_model()
    return {"ok": ok}


@app.post("/predict_landmarks")
def predict_landmarks(req: PredictLandmarksReq):
    global landmark_model
    if landmark_model is None:
        # auto-load if trained before
        if os.path.exists(LANDMARKS_MODEL_PATH):
            landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
        else:
            return {"label": "NO_LANDMARK_MODEL", "confidence": 0.0}

    vec = landmarks_to_vec(req.landmarks).reshape(1, -1)
    pred = landmark_model.predict(vec)[0]

    # KNN has predict_proba only if fitted with it (it does)
    prob = float(np.max(landmark_model.predict_proba(vec)))

    return {"label": pred, "confidence": prob}


# Train once on startup
if os.path.exists(MODEL_PATH):
    knn = joblib.load(MODEL_PATH)
    print("✅ Loaded model from disk")
else:
    train_model()

@app.get("/health")
def health():
    # count landmark lines
    landmark_counts = {l: 0 for l in LABELS}
    total = 0
    for l in LABELS:
        p = os.path.join(LANDMARKS_DIR, f"{l}.jsonl")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                c = sum(1 for _ in f)
            landmark_counts[l] = c
            total += c

    return {
        "ok": True,
        "trained_pixels": knn is not None,
        "pixel_train_count": TRAIN_COUNT,
        "pixel_class_counts": dict(list(CLASS_COUNTS.items())[:6]),
        "trained_landmarks": os.path.exists(LANDMARKS_MODEL_PATH),
        "landmark_total": total,
        "landmark_counts": landmark_counts,
        "dataset_dir": DATASET_DIR,
        "landmarks_dir": LANDMARKS_DIR,
    }


@app.post("/predict")
def predict(req: PredictReq):
    if knn is None:
        return {"label": "NO_MODEL", "confidence": 0.0}

    b64 = _clean_base64(req.imageBase64)
    raw = base64.b64decode(b64)
    pil = Image.open(io.BytesIO(raw))

    vec = preprocess(pil).reshape(1, -1)
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

@app.post("/upload_landmarks")
def upload_landmarks(req: UploadLandmarksReq):
    label = req.label.strip().upper()
    if label not in LABELS:
        return {"ok": False, "error": f"Invalid label: {label}"}

    path = os.path.join(LANDMARKS_DIR, f"{label}.jsonl")
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"label": label, "landmarks": req.landmarks}) + "\n")

    return {"ok": True, "saved": path}


print("MODEL CLASSES:", getattr(knn, "classes_", None))
