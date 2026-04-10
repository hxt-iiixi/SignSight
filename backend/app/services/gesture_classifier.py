import json

import joblib
import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import GESTURE_LABELS
from app.core.paths import GESTURE_MODEL_PATH, GESTURES_DIR
from app.ml.gestures import gesture_to_vec


gesture_model: SVC | None = None


def load_gesture_dataset():
    X, y = [], []
    for label in GESTURE_LABELS:
        path = GESTURES_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    obj = json.loads(line)
                    X.append(gesture_to_vec(obj["frames"], obj.get("handedness")))
                    y.append(obj["label"])
                except Exception:
                    pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X).astype(np.float32), np.array(y)


def upload_gesture(
    label: str,
    frames: list,
    handedness: str | None,
    *,
    frames_v2: list | None = None,
) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label not in GESTURE_LABELS:
        return {"ok": False, "error": f"Invalid label: {normalized_label}"}

    if frames_v2:
        return {
            "ok": False,
            "error": "Gesture V2 upload is not enabled yet. Upper-body tracking data is not being produced by the current tracker.",
        }

    path = GESTURES_DIR / f"{normalized_label}.jsonl"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "label": normalized_label,
                    "handedness": handedness,
                    "frames": frames,
                }
            )
            + "\n"
        )
    return {"ok": True}


def train_gesture_model() -> dict:
    global gesture_model
    X, y = load_gesture_dataset()
    if len(X) == 0:
        gesture_model = None
        return {"ok": False, "error": "No gesture samples yet"}

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print("GESTURE acc:", acc)
    gesture_model = model
    joblib.dump(gesture_model, GESTURE_MODEL_PATH)
    return {"ok": True, "accuracy": float(acc)}


def bootstrap_gesture_model() -> None:
    global gesture_model
    if GESTURE_MODEL_PATH.exists():
        gesture_model = joblib.load(GESTURE_MODEL_PATH)
        print("✅ Loaded gesture model from disk")


def predict_gesture(
    frames: list,
    handedness: str | None,
    *,
    frames_v2: list | None = None,
) -> dict:
    global gesture_model
    if frames_v2:
        return {
            "label": "GESTURE_V2_NOT_READY",
            "confidence": 0.0,
            "ok": False,
            "error": "Gesture V2 prediction is not enabled yet. Upper-body tracking is not available in the current build.",
        }

    if gesture_model is None:
        if GESTURE_MODEL_PATH.exists():
            gesture_model = joblib.load(GESTURE_MODEL_PATH)
        else:
            return {"label": "NO_GESTURE_MODEL", "confidence": 0.0}

    vec = gesture_to_vec(frames, handedness).reshape(1, -1)
    pred = gesture_model.predict(vec)[0]
    prob = float(np.max(gesture_model.predict_proba(vec)))
    return {"label": pred, "confidence": prob}


def health_summary() -> dict:
    return {
        "trained_gestures": GESTURE_MODEL_PATH.exists(),
        "gesture_labels": GESTURE_LABELS,
    }
