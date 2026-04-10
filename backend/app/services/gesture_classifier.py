import json

import joblib
import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import GESTURE_LABELS
from app.core.paths import GESTURE_MODEL_PATH, GESTURE_MODEL_V2_PATH, GESTURES_DIR
from app.ml.gestures import gesture_to_vec, gesture_v2_to_vec


gesture_model: SVC | None = None
gesture_model_v2: SVC | None = None


def load_legacy_gesture_dataset():
    X, y = [], []
    for label in GESTURE_LABELS:
        path = GESTURES_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    obj = json.loads(line)
                    if obj.get("framesV2"):
                        continue
                    X.append(gesture_to_vec(obj["frames"], obj.get("handedness")))
                    y.append(obj["label"])
                except Exception:
                    pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X).astype(np.float32), np.array(y)


def load_gesture_v2_dataset():
    X, y = [], []
    for label in GESTURE_LABELS:
        path = GESTURES_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    obj = json.loads(line)
                    frames_v2 = obj.get("framesV2")
                    if not isinstance(frames_v2, list) or len(frames_v2) == 0:
                        continue
                    X.append(gesture_v2_to_vec(frames_v2))
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

    path = GESTURES_DIR / f"{normalized_label}.jsonl"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "label": normalized_label,
                    "handedness": handedness,
                    "frames": frames,
                    "framesV2": frames_v2,
                }
            )
            + "\n"
        )
    return {"ok": True}


def train_gesture_model() -> dict:
    global gesture_model, gesture_model_v2
    X_v2, y_v2 = load_gesture_v2_dataset()
    if len(X_v2) > 0:
        Xtr, Xte, ytr, yte = train_test_split(
            X_v2, y_v2, test_size=0.2, random_state=42, stratify=y_v2
        )
        model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
        model.fit(Xtr, ytr)

        pred = model.predict(Xte)
        acc = accuracy_score(yte, pred)
        print("GESTURE V2 acc:", acc)
        gesture_model_v2 = model
        joblib.dump(gesture_model_v2, GESTURE_MODEL_V2_PATH)
        return {"ok": True, "accuracy": float(acc), "schema": "gesture_v2"}

    X, y = load_legacy_gesture_dataset()
    if len(X) == 0:
        gesture_model = None
        gesture_model_v2 = None
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
    return {"ok": True, "accuracy": float(acc), "schema": "legacy"}


def bootstrap_gesture_model() -> None:
    global gesture_model, gesture_model_v2
    if GESTURE_MODEL_PATH.exists():
        gesture_model = joblib.load(GESTURE_MODEL_PATH)
        print("✅ Loaded gesture model from disk")
    if GESTURE_MODEL_V2_PATH.exists():
        gesture_model_v2 = joblib.load(GESTURE_MODEL_V2_PATH)
        print("✅ Loaded gesture v2 model from disk")


def predict_gesture(
    frames: list,
    handedness: str | None,
    *,
    frames_v2: list | None = None,
) -> dict:
    global gesture_model, gesture_model_v2
    if frames_v2:
        if gesture_model_v2 is None:
            if GESTURE_MODEL_V2_PATH.exists():
                gesture_model_v2 = joblib.load(GESTURE_MODEL_V2_PATH)
            else:
                return {
                    "label": "GESTURE_V2_NOT_READY",
                    "confidence": 0.0,
                    "ok": False,
                    "error": "Gesture V2 model is not trained yet.",
                }

        vec = gesture_v2_to_vec(frames_v2).reshape(1, -1)
        pred = gesture_model_v2.predict(vec)[0]
        prob = float(np.max(gesture_model_v2.predict_proba(vec)))
        return {"label": pred, "confidence": prob, "ok": True, "schema": "gesture_v2"}

    if gesture_model is None:
        if GESTURE_MODEL_PATH.exists():
            gesture_model = joblib.load(GESTURE_MODEL_PATH)
        else:
            return {"label": "NO_GESTURE_MODEL", "confidence": 0.0}

    vec = gesture_to_vec(frames, handedness).reshape(1, -1)
    pred = gesture_model.predict(vec)[0]
    prob = float(np.max(gesture_model.predict_proba(vec)))
    return {"label": pred, "confidence": prob, "ok": True, "schema": "legacy"}


def health_summary() -> dict:
    return {
        "trained_gestures": GESTURE_MODEL_PATH.exists() or GESTURE_MODEL_V2_PATH.exists(),
        "trained_gestures_legacy": GESTURE_MODEL_PATH.exists(),
        "trained_gestures_v2": GESTURE_MODEL_V2_PATH.exists(),
        "gesture_labels": GESTURE_LABELS,
    }
