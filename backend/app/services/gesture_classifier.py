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


def _iter_gesture_records(label: str):
    path = GESTURES_DIR / f"{label}.jsonl"
    if not path.exists():
        return

    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _is_approved_gesture_record(obj: dict) -> bool:
    review_status = obj.get("review_status")
    accepted = obj.get("accepted")

    if review_status is None and accepted is None:
        return True
    if accepted is False:
        return False
    if isinstance(review_status, str) and review_status.lower() != "approved":
        return False
    return True


def _gesture_record_kind(obj: dict) -> str:
    review_status = obj.get("review_status")
    if isinstance(review_status, str):
        normalized = review_status.strip().lower()
        if normalized in {"approved", "pending", "rejected"}:
            return normalized

    accepted = obj.get("accepted")
    if accepted is True:
        return "approved"
    if accepted is False:
        return "rejected"
    return "legacy"


def load_legacy_gesture_dataset():
    X, y = [], []
    for label in GESTURE_LABELS:
        path = GESTURES_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        for obj in _iter_gesture_records(label) or ():
            try:
                if obj.get("framesV2"):
                    continue
                if not _is_approved_gesture_record(obj):
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

        for obj in _iter_gesture_records(label) or ():
            try:
                if not _is_approved_gesture_record(obj):
                    continue
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
    signer_id: str | None = None,
    capture_session_id: str | None = None,
    device_id: str | None = None,
    camera_position: str | None = None,
    accepted: bool | None = None,
    review_status: str | None = None,
    review_notes: str | None = None,
    variant_tags: list[str] | None = None,
    captured_at: str | None = None,
) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label not in GESTURE_LABELS:
        return {"ok": False, "error": f"Invalid label: {normalized_label}"}
    if review_status == "approved":
        if not signer_id or not signer_id.strip():
            return {"ok": False, "error": "signer_id is required for the reviewed gesture dataset."}
        if not capture_session_id or not capture_session_id.strip():
            return {"ok": False, "error": "capture_session_id is required."}
        if camera_position not in {"front", "back"}:
            return {"ok": False, "error": "camera_position is required for reviewed gestures."}

    path = GESTURES_DIR / f"{normalized_label}.jsonl"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "label": normalized_label,
                    "handedness": handedness,
                    "frames": frames,
                    "framesV2": frames_v2,
                    "signer_id": signer_id.strip() if isinstance(signer_id, str) else None,
                    "capture_session_id": capture_session_id.strip()
                    if isinstance(capture_session_id, str)
                    else None,
                    "device_id": device_id.strip() if isinstance(device_id, str) else None,
                    "camera_position": camera_position,
                    "accepted": accepted,
                    "review_status": review_status,
                    "review_notes": review_notes.strip()
                    if isinstance(review_notes, str) and review_notes.strip()
                    else None,
                    "variant_tags": [
                        str(tag).strip() for tag in (variant_tags or []) if str(tag).strip()
                    ],
                    "captured_at": captured_at,
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


def gesture_label_summary(
    label: str,
    *,
    capture_session_id: str | None = None,
    signer_id: str | None = None,
) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label not in GESTURE_LABELS:
        return {"ok": False, "error": f"Invalid label: {normalized_label}"}

    normalized_session_id = capture_session_id.strip() if isinstance(capture_session_id, str) and capture_session_id.strip() else None
    normalized_signer_id = signer_id.strip() if isinstance(signer_id, str) and signer_id.strip() else None

    summary = {
        "approved": 0,
        "pending": 0,
        "rejected": 0,
        "legacy": 0,
        "by_hand": {"Left": 0, "Right": 0},
        "session_total": 0,
        "session_by_hand": {"Left": 0, "Right": 0},
        "session_pending": 0,
        "session_approved": 0,
        "session_rejected": 0,
        "session_legacy": 0,
        "v2_sequences": 0,
    }

    for record in _iter_gesture_records(normalized_label) or ():
        kind = _gesture_record_kind(record)
        summary[kind] += 1

        if isinstance(record.get("framesV2"), list) and len(record["framesV2"]) > 0:
            summary["v2_sequences"] += 1

        handedness = record.get("handedness")
        if handedness in summary["by_hand"]:
            summary["by_hand"][handedness] += 1

        matches_session = True
        if normalized_session_id and record.get("capture_session_id") != normalized_session_id:
            matches_session = False
        if normalized_signer_id and record.get("signer_id") != normalized_signer_id:
            matches_session = False

        if matches_session:
            summary["session_total"] += 1
            if handedness in summary["session_by_hand"]:
                summary["session_by_hand"][handedness] += 1
            summary[f"session_{kind}"] += 1

    return {"ok": True, "label": normalized_label, **summary}


def health_summary() -> dict:
    gesture_counts_by_label = {}
    gesture_total = 0
    gesture_signer_ids: set[str] = set()
    gesture_v2_total = 0
    for label in GESTURE_LABELS:
        stats = {
            "approved": 0,
            "pending": 0,
            "rejected": 0,
            "legacy": 0,
            "by_hand": {"Left": 0, "Right": 0},
            "signer_ids": set(),
            "v2_sequences": 0,
        }
        for record in _iter_gesture_records(label) or ():
            kind = _gesture_record_kind(record)
            stats[kind] += 1
            gesture_total += 1
            handedness = record.get("handedness")
            if handedness in stats["by_hand"]:
                stats["by_hand"][handedness] += 1
            signer_id = record.get("signer_id")
            if isinstance(signer_id, str) and signer_id.strip():
                stats["signer_ids"].add(signer_id.strip())
                gesture_signer_ids.add(signer_id.strip())
            if isinstance(record.get("framesV2"), list) and len(record["framesV2"]) > 0:
                stats["v2_sequences"] += 1
                gesture_v2_total += 1
        gesture_counts_by_label[label] = {
            "approved": stats["approved"],
            "pending": stats["pending"],
            "rejected": stats["rejected"],
            "legacy": stats["legacy"],
            "by_hand": stats["by_hand"],
            "signer_count": len(stats["signer_ids"]),
            "v2_sequences": stats["v2_sequences"],
        }

    return {
        "trained_gestures": GESTURE_MODEL_PATH.exists() or GESTURE_MODEL_V2_PATH.exists(),
        "trained_gestures_legacy": GESTURE_MODEL_PATH.exists(),
        "trained_gestures_v2": GESTURE_MODEL_V2_PATH.exists(),
        "gesture_labels": GESTURE_LABELS,
        "gesture_total": gesture_total,
        "gesture_v2_total": gesture_v2_total,
        "gesture_unique_signers": len(gesture_signer_ids),
        "gesture_counts": gesture_counts_by_label,
    }
