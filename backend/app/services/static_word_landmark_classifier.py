import json
import shutil
from datetime import datetime, timezone
from typing import Optional

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import STATIC_WORD_LABELS
from app.core.paths import (
    STATIC_WORD_LANDMARKS_DIR,
    STATIC_WORD_LANDMARKS_MODEL_METADATA_PATH,
    STATIC_WORD_LANDMARKS_MODEL_PATH,
    STATIC_WORD_LANDMARKS_MODEL_REGISTRY_PATH,
    STATIC_WORD_LANDMARKS_MODEL_VERSIONS_DIR,
)
from app.ml.landmarks import landmark_feature_vector


static_word_landmark_model: Optional[SVC] = None
static_word_landmark_model_metadata: dict[str, object] = {}
static_word_landmark_model_version_id: Optional[str] = None

REQUIRED_RECORD_FIELDS = (
    "label",
    "handedness",
    "landmarks",
    "signer_id",
    "capture_session_id",
    "camera_position",
    "accepted",
    "review_status",
    "captured_at",
)
STATIC_WORD_ACCEPTANCE_CONFIDENCE = 0.78
STATIC_WORD_ACCEPTANCE_MARGIN = 0.12


def _clean_optional_string(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_handedness(value: object) -> Optional[str]:
    text = _clean_optional_string(value)
    if not text:
        return None
    lowered = text.lower()
    if lowered == "left":
        return "Left"
    if lowered == "right":
        return "Right"
    return None


def _normalize_camera_position(value: object) -> Optional[str]:
    text = _clean_optional_string(value)
    if not text:
        return None
    lowered = text.lower()
    if lowered in {"front", "back"}:
        return lowered
    return None


def _normalize_review_status(value: object) -> str:
    text = _clean_optional_string(value)
    if not text:
        return "pending"
    lowered = text.lower()
    if lowered in {"pending", "approved", "rejected"}:
        return lowered
    return "pending"


def _normalize_word_landmark_record(raw: dict) -> dict:
    review_status = _normalize_review_status(raw.get("review_status"))
    accepted_raw = raw.get("accepted")
    if accepted_raw is None:
        accepted = review_status == "approved"
    else:
        accepted = bool(accepted_raw)

    return {
        "label": _clean_optional_string(raw.get("label")),
        "handedness": _normalize_handedness(raw.get("handedness")),
        "landmarks": raw.get("landmarks"),
        "signer_id": _clean_optional_string(raw.get("signer_id")),
        "capture_session_id": _clean_optional_string(raw.get("capture_session_id")),
        "camera_position": _normalize_camera_position(raw.get("camera_position")),
        "accepted": accepted,
        "review_status": review_status,
        "captured_at": _clean_optional_string(raw.get("captured_at")),
    }


def _is_reviewed_record(record: dict) -> bool:
    return all(record.get(field) is not None for field in REQUIRED_RECORD_FIELDS)


def _static_word_dataset_summary() -> dict:
    labels = {
        label: {"approved": 0, "pending": 0, "rejected": 0, "legacy": 0}
        for label in STATIC_WORD_LABELS
    }
    approved_records: list[dict] = []

    for label in STATIC_WORD_LABELS:
        path = STATIC_WORD_LANDMARKS_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    raw = json.loads(line)
                except Exception:
                    continue

                record = _normalize_word_landmark_record(raw)
                if record["label"] != label or not _is_reviewed_record(record):
                    labels[label]["legacy"] += 1
                    continue

                if record["review_status"] == "approved" and record["accepted"]:
                    labels[label]["approved"] += 1
                    approved_records.append(record)
                elif record["review_status"] == "rejected":
                    labels[label]["rejected"] += 1
                else:
                    labels[label]["pending"] += 1

    return {"labels": labels, "approved_records": approved_records}


def load_static_word_landmark_dataset():
    X, y = [], []
    for record in _static_word_dataset_summary()["approved_records"]:
        try:
            X.append(landmark_feature_vector(record["landmarks"], record["handedness"]))
            y.append(record["label"])
        except Exception:
            pass

    if len(X) == 0:
        return np.array([]), np.array([])
    return np.stack(X).astype(np.float32), np.array(y)


def _static_word_model_path_for_version(version_id: str):
    return STATIC_WORD_LANDMARKS_MODEL_VERSIONS_DIR / f"{version_id}.joblib"


def _static_word_model_metadata_path_for_version(version_id: str):
    return STATIC_WORD_LANDMARKS_MODEL_VERSIONS_DIR / f"{version_id}.json"


def _load_static_word_model_registry() -> dict[str, object]:
    if not STATIC_WORD_LANDMARKS_MODEL_REGISTRY_PATH.exists():
        return {"active_version_id": None, "versions": []}
    try:
        data = json.loads(
            STATIC_WORD_LANDMARKS_MODEL_REGISTRY_PATH.read_text(encoding="utf-8")
        )
    except Exception:
        return {"active_version_id": None, "versions": []}
    versions = data.get("versions")
    if not isinstance(versions, list):
        versions = []
    active_version_id = data.get("active_version_id")
    if active_version_id is not None:
        active_version_id = str(active_version_id)
    return {"active_version_id": active_version_id, "versions": versions}


def _persist_static_word_model_registry(registry: dict[str, object]) -> None:
    STATIC_WORD_LANDMARKS_MODEL_REGISTRY_PATH.write_text(
        json.dumps(registry, indent=2),
        encoding="utf-8",
    )


def _available_static_word_model_versions() -> list[dict[str, object]]:
    registry = _load_static_word_model_registry()
    active_version_id = registry.get("active_version_id")
    versions: list[dict[str, object]] = []
    for entry in registry.get("versions", []):
        if not isinstance(entry, dict):
            continue
        normalized = dict(entry)
        normalized["version_id"] = str(entry.get("version_id"))
        normalized["is_active"] = normalized["version_id"] == active_version_id
        versions.append(normalized)
    versions.sort(key=lambda item: str(item.get("trained_at") or ""), reverse=True)
    return versions


def _active_static_word_labels() -> list[str]:
    global static_word_landmark_model_metadata, static_word_landmark_model
    labels = static_word_landmark_model_metadata.get("active_static_word_labels")
    if isinstance(labels, list):
        return [str(label) for label in labels]
    if static_word_landmark_model is not None and hasattr(static_word_landmark_model, "classes_"):
        return [str(label) for label in static_word_landmark_model.classes_]
    return []


def _active_static_word_model_version_id() -> Optional[str]:
    global static_word_landmark_model_version_id
    if static_word_landmark_model_version_id:
        return static_word_landmark_model_version_id
    registry = _load_static_word_model_registry()
    active = registry.get("active_version_id")
    return str(active) if active else None


def _sync_active_model_aliases(version_id: str, metadata: dict[str, object]) -> None:
    version_model_path = _static_word_model_path_for_version(version_id)
    version_meta_path = _static_word_model_metadata_path_for_version(version_id)
    if version_model_path.exists():
        shutil.copy2(version_model_path, STATIC_WORD_LANDMARKS_MODEL_PATH)
    if version_meta_path.exists():
        shutil.copy2(version_meta_path, STATIC_WORD_LANDMARKS_MODEL_METADATA_PATH)


def _load_static_word_model_version(version_id: str) -> bool:
    global static_word_landmark_model, static_word_landmark_model_metadata
    global static_word_landmark_model_version_id
    model_path = _static_word_model_path_for_version(version_id)
    if not model_path.exists():
        return False
    try:
        static_word_landmark_model = joblib.load(model_path)
    except Exception:
        return False
    metadata_path = _static_word_model_metadata_path_for_version(version_id)
    if metadata_path.exists():
        try:
            static_word_landmark_model_metadata = json.loads(
                metadata_path.read_text(encoding="utf-8")
            )
        except Exception:
            static_word_landmark_model_metadata = {}
    else:
        static_word_landmark_model_metadata = {}
    if not static_word_landmark_model_metadata and hasattr(static_word_landmark_model, "classes_"):
        static_word_landmark_model_metadata = {
            "active_static_word_labels": [
                str(label) for label in static_word_landmark_model.classes_
            ]
        }
    static_word_landmark_model_version_id = version_id
    return True


def bootstrap_static_word_landmark_model() -> None:
    registry = _load_static_word_model_registry()
    active_version_id = registry.get("active_version_id")
    if active_version_id and _load_static_word_model_version(str(active_version_id)):
        print(f"✅ Loaded static word landmark model version {active_version_id}")
        return


def train_static_word_landmark_model() -> dict:
    global static_word_landmark_model, static_word_landmark_model_metadata
    global static_word_landmark_model_version_id
    summary = _static_word_dataset_summary()
    approved_labels = [
        label for label, stats in summary["labels"].items() if stats["approved"] > 0
    ]
    if len(approved_labels) < 2:
        return {
            "ok": False,
            "error": (
                "Static word landmark training needs at least 2 approved word classes "
                "before a real classifier can be trained."
            ),
            "approved_static_word_labels": approved_labels,
            "required_min_classes": 2,
            "static_word_counts": summary["labels"],
            "available_versions": _available_static_word_model_versions(),
        }

    X, y = load_static_word_landmark_dataset()
    if len(X) == 0:
        return {"ok": False, "error": "No approved static word landmark samples found."}

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    train_labels = set(ytr.tolist())
    test_labels = set(yte.tolist())
    missing_after_split = [
        label for label in approved_labels if label not in train_labels or label not in test_labels
    ]
    if missing_after_split:
        return {
            "ok": False,
            "error": "Static word dataset is too small to produce a valid train/holdout split.",
            "split_missing_labels": missing_after_split,
            "approved_static_word_labels": approved_labels,
            "static_word_counts": summary["labels"],
        }

    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)
    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"✅ Static word landmark model trained. Holdout accuracy: {acc:.3f}")
    print(classification_report(yte, pred, zero_division=0))

    static_word_landmark_model = model
    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    version_id = datetime.now(timezone.utc).strftime(
        "static_word_landmarks_%Y%m%dT%H%M%SZ"
    )
    version_model_path = _static_word_model_path_for_version(version_id)
    version_metadata_path = _static_word_model_metadata_path_for_version(version_id)
    joblib.dump(static_word_landmark_model, version_model_path)
    static_word_landmark_model_metadata = {
        "version_id": version_id,
        "label": f"static word landmarks {trained_at}",
        "active_static_word_labels": sorted(str(label) for label in model.classes_),
        "trained_at": trained_at,
        "training_sample_counts": {
            label: int(summary["labels"][label]["approved"]) for label in approved_labels
        },
    }
    version_metadata_path.write_text(
        json.dumps(static_word_landmark_model_metadata, indent=2),
        encoding="utf-8",
    )

    registry = _load_static_word_model_registry()
    versions = [
        entry
        for entry in registry.get("versions", [])
        if str(entry.get("version_id")) != version_id
    ]
    versions.append(
        {
            "version_id": version_id,
            "label": str(static_word_landmark_model_metadata.get("label") or version_id),
            "active_static_word_labels": static_word_landmark_model_metadata[
                "active_static_word_labels"
            ],
            "trained_at": trained_at,
        }
    )
    registry["versions"] = versions
    registry["active_version_id"] = version_id
    _persist_static_word_model_registry(registry)
    _sync_active_model_aliases(version_id, static_word_landmark_model_metadata)
    static_word_landmark_model_version_id = version_id

    return {
        "ok": True,
        "accuracy": float(acc),
        "active_version_id": version_id,
        "active_static_word_labels": static_word_landmark_model_metadata[
            "active_static_word_labels"
        ],
        "available_versions": _available_static_word_model_versions(),
        "static_word_counts": summary["labels"],
    }


def predict_static_word_landmarks(landmarks: list, handedness: Optional[str]) -> dict:
    global static_word_landmark_model
    if static_word_landmark_model is None:
        active_version_id = _active_static_word_model_version_id()
        if active_version_id and _load_static_word_model_version(active_version_id):
            pass
        elif STATIC_WORD_LANDMARKS_MODEL_PATH.exists():
            try:
                static_word_landmark_model = joblib.load(STATIC_WORD_LANDMARKS_MODEL_PATH)
            except Exception:
                static_word_landmark_model = None
        else:
            return {
                "label": "NO_STATIC_WORD_MODEL",
                "confidence": 0.0,
                "accepted_prediction": False,
                "raw_label": "NO_STATIC_WORD_MODEL",
                "raw_confidence": 0.0,
                "margin": 0.0,
                "active_static_word_labels": _active_static_word_labels(),
                "unknown_reason": "no_model",
            }

    if not isinstance(landmarks, list) or len(landmarks) != 21:
        return {
            "label": "NO_STATIC_WORD_MODEL",
            "confidence": 0.0,
            "accepted_prediction": False,
            "raw_label": "INVALID_LANDMARKS",
            "raw_confidence": 0.0,
            "margin": 0.0,
            "active_static_word_labels": _active_static_word_labels(),
            "unknown_reason": "invalid_landmarks",
        }

    vec = landmark_feature_vector(landmarks, handedness).reshape(1, -1)
    probabilities = static_word_landmark_model.predict_proba(vec)[0]
    order = np.argsort(probabilities)[::-1]
    labels = static_word_landmark_model.classes_[order]
    scores = probabilities[order]
    raw_label = str(labels[0])
    raw_confidence = float(scores[0])
    margin = float(scores[0] - scores[1]) if len(scores) > 1 else float(scores[0])
    accepted_prediction = (
        raw_confidence >= STATIC_WORD_ACCEPTANCE_CONFIDENCE
        and margin >= STATIC_WORD_ACCEPTANCE_MARGIN
    )
    unknown_reason = None
    if not accepted_prediction:
        unknown_reason = (
            "low_confidence_and_margin"
            if raw_confidence < STATIC_WORD_ACCEPTANCE_CONFIDENCE
            and margin < STATIC_WORD_ACCEPTANCE_MARGIN
            else "low_confidence"
            if raw_confidence < STATIC_WORD_ACCEPTANCE_CONFIDENCE
            else "low_margin"
        )

    return {
        "label": raw_label,
        "confidence": raw_confidence,
        "accepted_prediction": accepted_prediction,
        "raw_label": raw_label,
        "raw_confidence": raw_confidence,
        "margin": margin,
        "active_static_word_labels": _active_static_word_labels(),
        "unknown_reason": unknown_reason,
    }


def health_summary() -> dict:
    dataset = _static_word_dataset_summary()
    total = 0
    counts_by_label: dict[str, dict[str, int]] = {}
    for label, stats in dataset["labels"].items():
        counts_by_label[label] = dict(stats)
        total += stats["approved"] + stats["pending"] + stats["rejected"] + stats["legacy"]

    return {
        "trained_static_word_landmarks": bool(
            _active_static_word_model_version_id() or STATIC_WORD_LANDMARKS_MODEL_PATH.exists()
        ),
        "static_word_landmarks_total": total,
        "static_word_landmark_counts": counts_by_label,
        "static_word_landmarks_dir": str(STATIC_WORD_LANDMARKS_DIR),
        "static_word_labels": STATIC_WORD_LABELS,
        "active_static_word_model_version_id": _active_static_word_model_version_id(),
        "available_static_word_model_versions": _available_static_word_model_versions(),
        "active_static_word_labels": _active_static_word_labels(),
    }
