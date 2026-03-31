import json
from typing import Optional

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import LABELS
from app.core.paths import LANDMARKS_DIR, LANDMARKS_MODEL_PATH
from app.ml.landmarks import normalize_landmarks


landmark_model: Optional[SVC] = None


def load_landmarks_dataset():
    X, y = [], []
    for label in LABELS:
        path = LANDMARKS_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    obj = json.loads(line)
                    X.append(
                        normalize_landmarks(obj["landmarks"], obj.get("handedness"))
                    )
                    y.append(obj["label"])
                except Exception:
                    pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X).astype(np.float32), np.array(y)


def train_landmarks_model() -> bool:
    global landmark_model
    X, y = load_landmarks_dataset()
    if len(X) == 0:
        landmark_model = None
        print("⚠️ No landmark samples found. Collect samples first.")
        return False

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"✅ Landmark model trained. Holdout accuracy: {acc:.3f}")
    print(classification_report(yte, pred, zero_division=0))

    landmark_model = model
    joblib.dump(landmark_model, LANDMARKS_MODEL_PATH)
    return True


def bootstrap_landmark_model() -> None:
    global landmark_model
    if LANDMARKS_MODEL_PATH.exists():
        landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
        print("✅ Loaded landmark model from disk")


def predict_landmarks(landmarks: list, handedness: Optional[str]) -> dict:
    global landmark_model
    if landmark_model is None:
        if LANDMARKS_MODEL_PATH.exists():
            landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
        else:
            return {"label": "NO_LANDMARK_MODEL", "confidence": 0.0}

    vec = normalize_landmarks(landmarks, handedness).reshape(1, -1)
    pred = landmark_model.predict(vec)[0]
    prob = float(np.max(landmark_model.predict_proba(vec)))
    return {"label": pred, "confidence": prob}


def upload_landmarks(label: str, landmarks: list, handedness: Optional[str]) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label not in LABELS:
        return {"ok": False, "error": f"Invalid label: {normalized_label}"}

    path = LANDMARKS_DIR / f"{normalized_label}.jsonl"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "label": normalized_label,
                    "handedness": handedness,
                    "landmarks": landmarks,
                }
            )
            + "\n"
        )

    return {"ok": True, "saved": str(path)}


def health_summary() -> dict:
    landmark_counts = {label: 0 for label in LABELS}
    total = 0
    for label in LABELS:
        path = LANDMARKS_DIR / f"{label}.jsonl"
        if path.exists():
            with open(path, "r", encoding="utf-8") as handle:
                count = sum(1 for _ in handle)
            landmark_counts[label] = count
            total += count

    return {
        "trained_landmarks": LANDMARKS_MODEL_PATH.exists(),
        "landmark_total": total,
        "landmark_counts": landmark_counts,
        "landmarks_dir": str(LANDMARKS_DIR),
    }
