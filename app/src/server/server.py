import base64
import io
import os
import json
from typing import Optional, Tuple

import cv2
import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image

from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from fastapi import Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from jose import jwt, JWTError
import csv
# =========================
# Paths / Config
# =========================
BASE_DIR = os.path.dirname(__file__)

DATASET_DIR = os.path.join(BASE_DIR, "dataset")
LANDMARKS_DIR = os.path.join(BASE_DIR, "landmarks")
os.makedirs(LANDMARKS_DIR, exist_ok=True)

MODEL_PATH = os.path.join(BASE_DIR, "asl_model.joblib")
LANDMARKS_MODEL_PATH = os.path.join(BASE_DIR, "asl_landmarks_model.joblib")

GESTURES_DIR = os.path.join(BASE_DIR, "gestures")
os.makedirs(GESTURES_DIR, exist_ok=True)

GESTURE_MODEL_PATH = os.path.join(BASE_DIR, "asl_gesture_model.joblib")

WORD_LABELS = ["HELLO", "THANK_YOU", "SORRY", "GOODBYE"]
GESTURE_FRAMES = 12
gesture_model = None

LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
IMG_SIZE = (64, 64)

TRAIN_COUNT = 0
CLASS_COUNTS = {}

# =========================
# FastAPI
# =========================
app = FastAPI()

# =========================
# CORS (for admin website)
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# =========================
# MongoDB + Admin Auth
# =========================
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
MONGO_DB = os.getenv("MONGO_DB", "signsight")

JWT_SECRET = os.getenv("JWT_SECRET", "change_me")
JWT_ALG = "HS256"
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")

mongo_client = AsyncIOMotorClient(MONGO_URI)
mongo_db = mongo_client[MONGO_DB]
feedback_col = mongo_db["feedback"]

def _create_admin_token():
    payload = {
        "sub": "admin",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def _require_admin(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid/expired token")

# =========================
# Request Models
# =========================
class PredictReq(BaseModel):
    imageBase64: str

class UploadReq(BaseModel):
    label: str
    imageBase64: str

class UploadLandmarksReq(BaseModel):
    label: str
    landmarks: list  # list of 21 points {x,y,z}
    handedness: Optional[str] = None  # optional

class PredictLandmarksReq(BaseModel):
    landmarks: list
    handedness: Optional[str] = None  # optional

class UploadGestureReq(BaseModel):
    label: str
    frames: list  # list of frames, each frame = 21 points
    handedness: Optional[str] = None

class PredictGestureReq(BaseModel):
    frames: list
    handedness: Optional[str] = None
    
class FeedbackIn(BaseModel):
    message: str
    category: str = "general"
    rating: Optional[int] = None
    device: Optional[str] = None
    app_version: Optional[str] = None
    platform: Optional[str] = None

class AdminLoginIn(BaseModel):
    username: str
    password: str

# =========================
# Pixel model (unchanged)
# =========================
knn: Optional[SVC] = None  # (your variable name, but using SVC)

def _clean_base64(s: str) -> str:
    if "," in s:
        return s.split(",", 1)[1]
    return s

def preprocess(img: Image.Image) -> np.ndarray:
    img = img.convert("L")

    w, h = img.size
    crop_ratio = 0.65
    cw, ch = int(w * crop_ratio), int(h * crop_ratio)
    left = (w - cw) // 2
    top = (h - ch) // 2
    img = img.crop((left, top, left + cw, top + ch))

    img = img.resize(IMG_SIZE)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr.flatten()

def load_dataset():
    X, y = [], []
    for label in LABELS:
        folder = os.path.join(DATASET_DIR, label)
        if not os.path.isdir(folder):
            continue

        files = [f for f in os.listdir(folder) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        files = files[:500]

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
    global knn, TRAIN_COUNT, CLASS_COUNTS
    X_train, y_train = load_dataset()
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


# =========================
# ✅ Landmark normalization (REAL FIX)
# =========================
def _np_landmarks(landmarks: list) -> np.ndarray:
    """
    landmarks: 21 dicts with x,y,z
    returns: (21,3) float32
    """
    pts = []
    for p in landmarks:
        pts.append([float(p["x"]), float(p["y"]), float(p.get("z", 0.0))])
    return np.array(pts, dtype=np.float32)

def normalize_landmarks(landmarks: list, handedness: Optional[str] = None) -> np.ndarray:
    """
    Make the model invariant to:
    - translation (hand position)
    - scale (distance to camera)
    - handedness (left vs right)
    """
    pts = _np_landmarks(landmarks)  # (21,3)

    # 1) translate so wrist is origin
    wrist = pts[0].copy()
    pts = pts - wrist

    # 2) handedness normalize (optional)
    # MediaPipe often returns 'Left'/'Right' as the detected hand.
    # Flip X for left hands so left-hand looks like right-hand.
    if handedness:
        h = handedness.lower()
        if "left" in h:
            pts[:, 0] *= -1.0

    # 3) scale normalize using max distance from origin (robust)
    d = np.linalg.norm(pts[:, :2], axis=1)  # use x,y
    scale = float(np.max(d))
    if scale < 1e-6:
        scale = 1.0
    pts[:, :2] /= scale
    pts[:, 2] /= scale  # scale z too (keeps depth relative)

    # 4) flatten
    return pts.reshape(-1)  # 63 dims


def load_landmarks_dataset() -> Tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for label in LABELS:
        path = os.path.join(LANDMARKS_DIR, f"{label}.jsonl")
        if not os.path.exists(path):
            continue

        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    vec = normalize_landmarks(obj["landmarks"], obj.get("handedness"))
                    X.append(vec)
                    y.append(obj["label"])
                except:
                    pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X).astype(np.float32), np.array(y)


landmark_model: Optional[SVC] = None

def train_landmarks_model() -> bool:
    global landmark_model
    X, y = load_landmarks_dataset()
    if len(X) == 0:
        landmark_model = None
        print("⚠️ No landmark samples found. Collect samples first.")
        return False

    # Train/test split for sanity check
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # ✅ SVC usually beats KNN for normalized landmark classification
    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"✅ Landmark model trained. Holdout accuracy: {acc:.3f}")
    print(classification_report(yte, pred, zero_division=0))

    landmark_model = model
    joblib.dump(landmark_model, LANDMARKS_MODEL_PATH)
    return True

def resample_frames(frames, target_len=GESTURE_FRAMES):
    if len(frames) == 0:
        return []
    idxs = np.linspace(0, len(frames)-1, target_len).astype(int)
    return [frames[i] for i in idxs]

def gesture_to_vec(frames: list, handedness: Optional[str]) -> np.ndarray:
    frames = resample_frames(frames, GESTURE_FRAMES)
    vecs = []
    for lm in frames:
        v = normalize_landmarks(lm, handedness)  # 63 dims
        vecs.append(v)
    if len(vecs) != GESTURE_FRAMES:
        return np.zeros((GESTURE_FRAMES * 63,), dtype=np.float32)
    return np.concatenate(vecs).astype(np.float32)  # 24*63

# =========================
# Endpoints
# =========================
@app.post("/train")
def train():
    ok = train_model()
    return {"ok": ok}

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


@app.post("/upload_landmarks")
def upload_landmarks(req: UploadLandmarksReq):
    label = req.label.strip().upper()
    if label not in LABELS:
        return {"ok": False, "error": f"Invalid label: {label}"}

    path = os.path.join(LANDMARKS_DIR, f"{label}.jsonl")
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "label": label,
            "handedness": req.handedness,
            "landmarks": req.landmarks
        }) + "\n")

    return {"ok": True, "saved": path}

@app.post("/train_landmarks")
def train_landmarks():
    ok = train_landmarks_model()
    return {"ok": ok}

@app.post("/predict_landmarks")
def predict_landmarks(req: PredictLandmarksReq):
    global landmark_model

    if landmark_model is None:
        if os.path.exists(LANDMARKS_MODEL_PATH):
            landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
        else:
            return {"label": "NO_LANDMARK_MODEL", "confidence": 0.0}

    vec = normalize_landmarks(req.landmarks, req.handedness).reshape(1, -1)

    pred = landmark_model.predict(vec)[0]
    prob = float(np.max(landmark_model.predict_proba(vec)))
    return {"label": pred, "confidence": prob}

@app.get("/health")
def health():
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
        "trained_gestures": os.path.exists(GESTURE_MODEL_PATH),
        "gesture_labels": WORD_LABELS,

    }

@app.post("/upload_gesture")
def upload_gesture(req: UploadGestureReq):
    label = req.label.strip().upper()
    if label not in WORD_LABELS:
        return {"ok": False, "error": f"Invalid label: {label}"}

    path = os.path.join(GESTURES_DIR, f"{label}.jsonl")
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "label": label,
            "handedness": req.handedness,
            "frames": req.frames
        }) + "\n")
    return {"ok": True}


def load_gesture_dataset():
    X, y = [], []
    for label in WORD_LABELS:
        path = os.path.join(GESTURES_DIR, f"{label}.jsonl")
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    X.append(gesture_to_vec(obj["frames"], obj.get("handedness")))
                    y.append(obj["label"])
                except:
                    pass
    if len(X) == 0:
        return np.array([]), np.array([])
    return np.stack(X).astype(np.float32), np.array(y)


@app.post("/train_gestures")
def train_gestures():
    global gesture_model
    X, y = load_gesture_dataset()
    if len(X) == 0:
        gesture_model = None
        return {"ok": False, "error": "No gesture samples yet"}

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print("GESTURE acc:", acc)
    gesture_model = model
    joblib.dump(gesture_model, GESTURE_MODEL_PATH)
    return {"ok": True, "accuracy": float(acc)}


@app.post("/predict_gesture")
def predict_gesture(req: PredictGestureReq):
    global gesture_model
    if gesture_model is None:
        if os.path.exists(GESTURE_MODEL_PATH):
            gesture_model = joblib.load(GESTURE_MODEL_PATH)
        else:
            return {"label": "NO_GESTURE_MODEL", "confidence": 0.0}

    vec = gesture_to_vec(req.frames, req.handedness).reshape(1, -1)
    pred = gesture_model.predict(vec)[0]
    prob = float(np.max(gesture_model.predict_proba(vec)))
    return {"label": pred, "confidence": prob}

@app.on_event("startup")
async def _startup_indexes():
    await feedback_col.create_index([("created_at", -1)])
    await feedback_col.create_index([("resolved", 1), ("created_at", -1)])
    await feedback_col.create_index([("category", 1), ("created_at", -1)])
    await feedback_col.create_index([("message", "text")])  # for search

# =========================
# Anonymous Feedback System (MongoDB)
# =========================
@app.post("/feedback")
async def create_feedback(body: FeedbackIn):
    msg = (body.message or "").strip()
    if len(msg) < 3:
        return {"ok": False, "error": "Message too short"}

    doc = {
        "created_at": datetime.utcnow(),
        "message": msg,
        "category": (body.category or "general").strip().lower(),
        "rating": body.rating,
        "device": body.device,
        "app_version": body.app_version,
        "platform": body.platform,
        "resolved": False,
        "status": "open",
    }
    res = await feedback_col.insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id)}


@app.post("/admin/login")
def admin_login(body: AdminLoginIn):
    if body.username != ADMIN_USER or body.password != ADMIN_PASS:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"ok": True, "token": _create_admin_token()}


@app.get("/admin/feedback")
async def list_feedback(
    q: Optional[str] = None,
    status: Optional[str] = None,     # "open" | "resolved"
    category: Optional[str] = None,
    limit: int = 200,
    authorization: Optional[str] = Header(None),
):
    _require_admin(authorization)

    query: dict = {}

    if status == "open":
        query["resolved"] = False
    elif status == "resolved":
        query["resolved"] = True

    if category:
        query["category"] = category.strip().lower()

    if q and q.strip():
        query["$text"] = {"$search": q.strip()}

    cursor = feedback_col.find(query).sort("created_at", -1).limit(min(limit, 500))
    rows = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        # ISO string for frontend
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
        rows.append(doc)

    return rows


@app.post("/admin/feedback/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: str,
    authorization: Optional[str] = Header(None),
):
    _require_admin(authorization)

    from bson import ObjectId
    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")

    res = await feedback_col.update_one(
        {"_id": oid},
        {"$set": {"resolved": True, "status": "resolved"}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")

    return {"ok": True}


@app.get("/admin/export.csv")
async def export_feedback_csv(authorization: Optional[str] = Header(None)):
    _require_admin(authorization)

    cursor = feedback_col.find({}).sort("created_at", -1)
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["id","created_at","category","rating","message","device","app_version","platform","status","resolved"])

    async for r in cursor:
        w.writerow([
            str(r.get("_id")),
            r.get("created_at").isoformat() if r.get("created_at") else "",
            r.get("category",""),
            r.get("rating",""),
            (r.get("message","") or "").replace("\n", " "),
            r.get("device",""),
            r.get("app_version",""),
            r.get("platform",""),
            r.get("status",""),
            r.get("resolved",""),
        ])

    return Response(content=output.getvalue(), media_type="text/csv")


# =========================
# Startup load/train
# =========================
if os.path.exists(MODEL_PATH):
    knn = joblib.load(MODEL_PATH)
    print("✅ Loaded pixel model from disk")
else:
    train_model()

if os.path.exists(LANDMARKS_MODEL_PATH):
    landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
    print("✅ Loaded landmark model from disk")
    
if os.path.exists(GESTURE_MODEL_PATH):
    gesture_model = joblib.load(GESTURE_MODEL_PATH)
    print("✅ Loaded gesture model from disk")

print("PIXEL MODEL CLASSES:", getattr(knn, "classes_", None))
print("LANDMARK MODEL LOADED:", landmark_model is not None)
