import json
import shutil
from datetime import datetime, timezone
from typing import Literal, Optional

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import LABELS, MOTION_ONLY_LETTER_LABELS, STATIC_WORD_LABELS
from app.core.paths import (
    LANDMARKS_ARCHIVED_MODEL_VERSIONS_DIR,
    LANDMARKS_DIR,
    LANDMARKS_MODEL_METADATA_PATH,
    LANDMARKS_MODEL_PATH,
    LANDMARKS_MODEL_REGISTRY_PATH,
    LANDMARKS_MODEL_VERSIONS_DIR,
    STATIC_WORD_LANDMARKS_DIR,
)
from app.ml.landmarks import analyze_hand_landmarks, landmark_feature_vector


landmark_model: Optional[SVC] = None
landmark_model_metadata: dict[str, object] = {}
landmark_model_version_id: Optional[str] = None
TrainingMode = Literal["bootstrap", "full_reviewed"]

CONFIDENCE_OVERRIDE_MAX = 0.92
RULE_MIN_CONFIDENCE = 0.85
RULE_MIN_MARGIN = 0.18
STANDARD_ACCEPTANCE_CONFIDENCE = 0.60
STANDARD_ACCEPTANCE_MARGIN = 0.08
PARTIAL_ACCEPTANCE_CONFIDENCE = 0.78
PARTIAL_ACCEPTANCE_MARGIN = 0.22
VERY_SMALL_PARTIAL_ACCEPTANCE_CONFIDENCE = 0.84
VERY_SMALL_PARTIAL_ACCEPTANCE_MARGIN = 0.28
PARTIAL_MODEL_MAX_ACTIVE_LETTERS = 6
VERY_SMALL_PARTIAL_MODEL_MAX_ACTIVE_LETTERS = 4
DEFAULT_TRAINING_MODE: TrainingMode = "full_reviewed"
LANDMARK_TRAINING_MODES: dict[TrainingMode, dict[str, int]] = {
    "bootstrap": {
        "min_approved_samples_per_label": 40,
        "min_approved_per_hand": 20,
        "min_signers_per_label": 1,
        "min_ready_static_letters": 3,
    },
    "full_reviewed": {
        "min_approved_samples_per_label": 480,
        "min_approved_per_hand": 240,
        "min_signers_per_label": 8,
        "min_ready_static_letters": 3,
    },
}
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


def _normalize_variant_tags(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        tags = [_clean_optional_string(item) for item in value]
        return [tag for tag in tags if tag]
    if isinstance(value, str):
        parts = [_clean_optional_string(part) for part in value.split(",")]
        return [part for part in parts if part]
    return []


def _normalize_landmark_record(raw: dict) -> dict:
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
        "device_id": _clean_optional_string(raw.get("device_id")),
        "camera_position": _normalize_camera_position(raw.get("camera_position")),
        "accepted": accepted,
        "review_status": review_status,
        "review_notes": _clean_optional_string(raw.get("review_notes")) or "",
        "variant_tags": _normalize_variant_tags(raw.get("variant_tags")),
        "captured_at": _clean_optional_string(raw.get("captured_at")),
    }


def _record_kind(record: dict) -> str:
    if any(record.get(field) is None for field in REQUIRED_RECORD_FIELDS):
        return "legacy"
    if record["review_status"] == "approved" and record["accepted"]:
        return "approved"
    if record["review_status"] == "rejected":
        return "rejected"
    return "pending"


def _iter_label_records(label: str):
    path = LANDMARKS_DIR / f"{label}.jsonl"
    if not path.exists():
        return

    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            try:
                raw = json.loads(line)
            except Exception:
                continue

            record = _normalize_landmark_record(raw)
            if record["label"] != label:
                continue
            if not isinstance(record["landmarks"], list) or len(record["landmarks"]) != 21:
                continue
            yield record


def _iter_static_word_records(label: str):
    path = STATIC_WORD_LANDMARKS_DIR / f"{label}.jsonl"
    if not path.exists():
        return

    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            try:
                raw = json.loads(line)
            except Exception:
                continue

            record = _normalize_landmark_record(raw)
            if record["label"] != label:
                continue
            if not isinstance(record["landmarks"], list) or len(record["landmarks"]) != 21:
                continue
            yield record


def _dataset_summary() -> dict:
    summary: dict[str, dict] = {}
    static_word_summary: dict[str, dict] = {}
    approved_records: list[dict] = []

    for label in LABELS:
        stats = {
            "approved": 0,
            "pending": 0,
            "rejected": 0,
            "legacy": 0,
            "by_hand": {"Left": 0, "Right": 0},
            "signer_ids": set(),
        }

        for record in _iter_label_records(label) or ():
            kind = _record_kind(record)
            stats[kind] += 1

            if kind == "approved":
                handedness = record["handedness"]
                if handedness in stats["by_hand"]:
                    stats["by_hand"][handedness] += 1
                stats["signer_ids"].add(record["signer_id"])
                approved_records.append(record)

        summary[label] = stats

    for label in STATIC_WORD_LABELS:
        stats = {
            "approved": 0,
            "pending": 0,
            "rejected": 0,
            "legacy": 0,
            "by_hand": {"Left": 0, "Right": 0},
            "signer_ids": set(),
        }

        for record in _iter_static_word_records(label) or ():
            kind = _record_kind(record)
            stats[kind] += 1

            if kind == "approved":
                handedness = record["handedness"]
                if handedness in stats["by_hand"]:
                    stats["by_hand"][handedness] += 1
                stats["signer_ids"].add(record["signer_id"])
                approved_records.append(record)

        static_word_summary[label] = stats

    return {
        "labels": summary,
        "static_word_labels": static_word_summary,
        "approved_records": approved_records,
    }


def _normalize_training_mode(value: object) -> TrainingMode:
    text = _clean_optional_string(value)
    if text == "bootstrap":
        return "bootstrap"
    if text == "full_reviewed":
        return "full_reviewed"
    return DEFAULT_TRAINING_MODE


def _training_requirements(mode: object) -> dict[str, int]:
    normalized_mode = _normalize_training_mode(mode)
    requirements = LANDMARK_TRAINING_MODES[normalized_mode]
    return {
        "min_approved_samples_per_label": requirements["min_approved_samples_per_label"],
        "min_approved_per_hand": requirements["min_approved_per_hand"],
        "min_signers_per_label": requirements["min_signers_per_label"],
        "min_ready_static_letters": requirements["min_ready_static_letters"],
    }


def load_approved_landmark_records(target_labels: Optional[list[str]] = None) -> list[dict]:
    records = list(_dataset_summary()["approved_records"])
    if target_labels is None:
        return records
    target_set = set(target_labels)
    return [record for record in records if record["label"] in target_set]


def _quota_status(summary: dict, mode: object = DEFAULT_TRAINING_MODE) -> tuple[list[str], dict[str, list[str]]]:
    requirements = _training_requirements(mode)
    ready: list[str] = []
    deficits_by_label: dict[str, list[str]] = {}
    label_stats = summary["labels"]

    for label in LABELS:
        stats = label_stats[label]
        signer_count = len(stats["signer_ids"])
        deficits: list[str] = []
        if stats["approved"] < requirements["min_approved_samples_per_label"]:
            deficits.append(
                f"{label}: approved {stats['approved']}/{requirements['min_approved_samples_per_label']}"
            )
        if stats["by_hand"]["Left"] < requirements["min_approved_per_hand"]:
            deficits.append(
                f"{label}: Left hand {stats['by_hand']['Left']}/{requirements['min_approved_per_hand']}"
            )
        if stats["by_hand"]["Right"] < requirements["min_approved_per_hand"]:
            deficits.append(
                f"{label}: Right hand {stats['by_hand']['Right']}/{requirements['min_approved_per_hand']}"
            )
        if signer_count < requirements["min_signers_per_label"]:
            deficits.append(
                f"{label}: signers {signer_count}/{requirements['min_signers_per_label']}"
            )

        if deficits:
            deficits_by_label[label] = deficits
        else:
            ready.append(label)

    return ready, deficits_by_label


def load_landmarks_dataset(target_labels: Optional[list[str]] = None):
    X, y = [], []
    for record in load_approved_landmark_records(target_labels):
        try:
            X.append(landmark_feature_vector(record["landmarks"], record["handedness"]))
            y.append(record["label"])
        except Exception:
            pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X).astype(np.float32), np.array(y)


def _load_landmark_model_metadata() -> dict[str, object]:
    if not LANDMARKS_MODEL_METADATA_PATH.exists():
        return {}
    try:
        return json.loads(LANDMARKS_MODEL_METADATA_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _persist_landmark_model_metadata(metadata: dict[str, object]) -> None:
    LANDMARKS_MODEL_METADATA_PATH.write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )


def _landmark_model_path_for_version(version_id: str):
    return LANDMARKS_MODEL_VERSIONS_DIR / f"{version_id}.joblib"


def _landmark_model_metadata_path_for_version(version_id: str):
    return LANDMARKS_MODEL_VERSIONS_DIR / f"{version_id}.json"


def _archived_landmark_model_path_for_version(version_id: str):
    return LANDMARKS_ARCHIVED_MODEL_VERSIONS_DIR / f"{version_id}.joblib"


def _archived_landmark_model_metadata_path_for_version(version_id: str):
    return LANDMARKS_ARCHIVED_MODEL_VERSIONS_DIR / f"{version_id}.json"


def _load_landmark_model_registry() -> dict[str, object]:
    if not LANDMARKS_MODEL_REGISTRY_PATH.exists():
        return {"active_version_id": None, "versions": [], "archived_versions": []}
    try:
        data = json.loads(LANDMARKS_MODEL_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"active_version_id": None, "versions": [], "archived_versions": []}
    versions = data.get("versions")
    if not isinstance(versions, list):
        versions = []
    archived_versions = data.get("archived_versions")
    if not isinstance(archived_versions, list):
        archived_versions = []
    active_version_id = data.get("active_version_id")
    if active_version_id is not None:
        active_version_id = str(active_version_id)
    return {
        "active_version_id": active_version_id,
        "versions": versions,
        "archived_versions": archived_versions,
    }


def _persist_landmark_model_registry(registry: dict[str, object]) -> None:
    LANDMARKS_MODEL_REGISTRY_PATH.write_text(
        json.dumps(registry, indent=2),
        encoding="utf-8",
    )


def _version_entry(
    version_id: str,
    metadata: dict[str, object],
    *,
    source: str,
) -> dict[str, object]:
    return {
        "version_id": version_id,
        "label": str(metadata.get("label") or version_id),
        "training_mode": _normalize_training_mode(metadata.get("training_mode")),
        "active_static_letters": [
            str(label) for label in metadata.get("active_static_letters", [])
        ]
        if isinstance(metadata.get("active_static_letters"), list)
        else [],
        "active_static_word_labels": [
            str(label) for label in metadata.get("active_static_word_labels", [])
        ]
        if isinstance(metadata.get("active_static_word_labels"), list)
        else [],
        "trained_at": metadata.get("trained_at"),
        "source": source,
    }


def _sync_active_model_aliases(version_id: str, metadata: dict[str, object]) -> None:
    version_model_path = _landmark_model_path_for_version(version_id)
    version_meta_path = _landmark_model_metadata_path_for_version(version_id)
    if version_model_path.exists():
        shutil.copy2(version_model_path, LANDMARKS_MODEL_PATH)
    if version_meta_path.exists():
        shutil.copy2(version_meta_path, LANDMARKS_MODEL_METADATA_PATH)
    else:
        _persist_landmark_model_metadata(metadata)


def _ensure_legacy_landmark_model_versioned() -> dict[str, object]:
    registry = _load_landmark_model_registry()
    if registry["versions"]:
        return registry
    if not LANDMARKS_MODEL_PATH.exists():
        return registry

    legacy_metadata = _load_landmark_model_metadata()
    trained_at = legacy_metadata.get("trained_at")
    if not trained_at:
        trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        legacy_metadata["trained_at"] = trained_at
    legacy_metadata.setdefault("training_mode", DEFAULT_TRAINING_MODE)
    if not isinstance(legacy_metadata.get("active_static_letters"), list):
        try:
            legacy_model = joblib.load(LANDMARKS_MODEL_PATH)
            legacy_metadata["active_static_letters"] = [
                str(label) for label in getattr(legacy_model, "classes_", [])
            ]
        except Exception:
            legacy_metadata["active_static_letters"] = []

    version_id = "legacy_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    version_model_path = _landmark_model_path_for_version(version_id)
    version_meta_path = _landmark_model_metadata_path_for_version(version_id)
    shutil.copy2(LANDMARKS_MODEL_PATH, version_model_path)
    version_meta_path.write_text(json.dumps(legacy_metadata, indent=2), encoding="utf-8")
    registry = {
        "active_version_id": version_id,
        "versions": [
            _version_entry(version_id, legacy_metadata, source="migrated_legacy")
        ],
    }
    _persist_landmark_model_registry(registry)
    _sync_active_model_aliases(version_id, legacy_metadata)
    return registry


def _available_landmark_model_versions() -> list[dict[str, object]]:
    registry = _load_landmark_model_registry()
    active_version_id = registry.get("active_version_id")
    versions: list[dict[str, object]] = []
    for entry in registry.get("versions", []):
        if not isinstance(entry, dict):
            continue
        normalized = dict(entry)
        normalized["version_id"] = str(entry.get("version_id"))
        normalized["is_active"] = normalized["version_id"] == active_version_id
        versions.append(normalized)
    versions.sort(
        key=lambda item: str(item.get("trained_at") or ""),
        reverse=True,
    )
    return versions


def _available_archived_landmark_model_versions() -> list[dict[str, object]]:
    registry = _load_landmark_model_registry()
    versions: list[dict[str, object]] = []
    for entry in registry.get("archived_versions", []):
        if not isinstance(entry, dict):
            continue
        normalized = dict(entry)
        normalized["version_id"] = str(entry.get("version_id"))
        normalized["is_active"] = False
        versions.append(normalized)
    versions.sort(
        key=lambda item: str(item.get("archived_at") or item.get("trained_at") or ""),
        reverse=True,
    )
    return versions


def _active_static_letters() -> list[str]:
    global landmark_model_metadata, landmark_model
    labels = landmark_model_metadata.get("active_static_letters")
    if isinstance(labels, list):
        return [str(label) for label in labels if str(label) in LABELS]
    if landmark_model is not None and hasattr(landmark_model, "classes_"):
        return [str(label) for label in landmark_model.classes_ if str(label) in LABELS]
    return []


def _active_static_word_labels() -> list[str]:
    global landmark_model_metadata, landmark_model
    labels = landmark_model_metadata.get("active_static_word_labels")
    if isinstance(labels, list):
        return [str(label) for label in labels]
    if landmark_model is not None and hasattr(landmark_model, "classes_"):
        return [str(label) for label in landmark_model.classes_ if str(label) in STATIC_WORD_LABELS]
    return []


def _active_landmark_model_version_id() -> Optional[str]:
    global landmark_model_version_id
    if landmark_model_version_id:
        return landmark_model_version_id
    registry = _load_landmark_model_registry()
    active = registry.get("active_version_id")
    return str(active) if active else None


def _current_landmark_training_mode() -> TrainingMode:
    global landmark_model_metadata
    return _normalize_training_mode(landmark_model_metadata.get("training_mode"))


def _load_landmark_model_version(version_id: str) -> bool:
    global landmark_model, landmark_model_metadata, landmark_model_version_id
    model_path = _landmark_model_path_for_version(version_id)
    if not model_path.exists():
        return False
    try:
        landmark_model = joblib.load(model_path)
    except Exception:
        return False
    metadata_path = _landmark_model_metadata_path_for_version(version_id)
    if metadata_path.exists():
        try:
            landmark_model_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            landmark_model_metadata = {}
    else:
        landmark_model_metadata = {}
    if not landmark_model_metadata and hasattr(landmark_model, "classes_"):
        landmark_model_metadata = {
            "active_static_letters": [str(label) for label in landmark_model.classes_]
        }
    landmark_model_version_id = version_id
    return True


def activate_landmark_model_version(version_id: str) -> dict:
    global landmark_model_metadata
    requested_version = _clean_optional_string(version_id)
    if not requested_version:
        return {"ok": False, "error": "version_id is required."}

    registry = _ensure_legacy_landmark_model_versioned()
    versions = registry.get("versions", [])
    matching = next(
        (entry for entry in versions if str(entry.get("version_id")) == requested_version),
        None,
    )
    if not matching:
        return {"ok": False, "error": f"Unknown landmark model version: {requested_version}"}

    if not _load_landmark_model_version(requested_version):
        return {"ok": False, "error": f"Failed to load landmark model version: {requested_version}"}

    registry["active_version_id"] = requested_version
    _persist_landmark_model_registry(registry)
    _sync_active_model_aliases(requested_version, landmark_model_metadata)

    return {
        "ok": True,
        "active_version_id": requested_version,
        "active_static_letters": _active_static_letters(),
        "training_mode": _current_landmark_training_mode(),
        "available_versions": _available_landmark_model_versions(),
    }


def rename_landmark_model_version(version_id: str, label: str) -> dict:
    global landmark_model_metadata
    requested_version = _clean_optional_string(version_id)
    next_label = _clean_optional_string(label)
    if not requested_version:
        return {"ok": False, "error": "version_id is required."}
    if not next_label:
        return {"ok": False, "error": "label is required."}

    registry = _ensure_legacy_landmark_model_versioned()
    versions = registry.get("versions", [])
    matching = next(
        (entry for entry in versions if str(entry.get("version_id")) == requested_version),
        None,
    )
    if not matching:
        return {"ok": False, "error": f"Unknown landmark model version: {requested_version}"}

    matching["label"] = next_label
    registry["versions"] = versions
    _persist_landmark_model_registry(registry)

    metadata_path = _landmark_model_metadata_path_for_version(requested_version)
    metadata: dict[str, object]
    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            metadata = {}
    else:
        metadata = {}
    metadata["label"] = next_label
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    if _active_landmark_model_version_id() == requested_version:
        landmark_model_metadata = {**landmark_model_metadata, "label": next_label}
        _persist_landmark_model_metadata(landmark_model_metadata)
        _sync_active_model_aliases(requested_version, landmark_model_metadata)

    return {
        "ok": True,
        "version_id": requested_version,
        "label": next_label,
        "active_version_id": _active_landmark_model_version_id(),
        "available_versions": _available_landmark_model_versions(),
        "archived_versions": _available_archived_landmark_model_versions(),
    }


def archive_landmark_model_version(version_id: str) -> dict:
    requested_version = _clean_optional_string(version_id)
    if not requested_version:
        return {"ok": False, "error": "version_id is required."}

    active_version_id = _active_landmark_model_version_id()
    if requested_version == active_version_id:
        return {
            "ok": False,
            "error": "Cannot archive the currently active model. Switch to another model first.",
        }

    registry = _ensure_legacy_landmark_model_versioned()
    versions = registry.get("versions", [])
    matching = next(
        (entry for entry in versions if str(entry.get("version_id")) == requested_version),
        None,
    )
    if not matching:
        return {"ok": False, "error": f"Unknown landmark model version: {requested_version}"}

    version_model_path = _landmark_model_path_for_version(requested_version)
    version_meta_path = _landmark_model_metadata_path_for_version(requested_version)
    archived_model_path = _archived_landmark_model_path_for_version(requested_version)
    archived_meta_path = _archived_landmark_model_metadata_path_for_version(requested_version)

    if version_model_path.exists():
        shutil.move(str(version_model_path), str(archived_model_path))
    if version_meta_path.exists():
        shutil.move(str(version_meta_path), str(archived_meta_path))

    archived_entry = dict(matching)
    archived_entry["archived_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    registry["versions"] = [
        entry for entry in versions if str(entry.get("version_id")) != requested_version
    ]
    archived_versions = [
        entry
        for entry in registry.get("archived_versions", [])
        if str(entry.get("version_id")) != requested_version
    ]
    archived_versions.append(archived_entry)
    registry["archived_versions"] = archived_versions
    _persist_landmark_model_registry(registry)

    return {
        "ok": True,
        "version_id": requested_version,
        "active_version_id": active_version_id,
        "available_versions": _available_landmark_model_versions(),
        "archived_versions": _available_archived_landmark_model_versions(),
    }


def _top_predictions(model: SVC, vec: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    probabilities = model.predict_proba(vec)[0]
    order = np.argsort(probabilities)[::-1]
    return model.classes_[order], probabilities[order]


def _family_active(raw_label: str, top_labels: list[str], family: set[str]) -> bool:
    label_set = set(top_labels)
    return raw_label in family or len(label_set & family) >= 2


def _fingertips_cross(points: np.ndarray, first: tuple[int, int], second: tuple[int, int]) -> bool:
    first_pip, first_tip = first
    second_pip, second_tip = second
    return (points[first_pip, 0] - points[second_pip, 0]) * (
        points[first_tip, 0] - points[second_tip, 0]
    ) < 0.0


def _thumb_outside_a_shape(
    extension_scores: np.ndarray,
    thumb_to_tip_distance: np.ndarray,
    thumb_crossing: np.ndarray,
    thumb_closest_base: int,
    thumb_knuckle_clearance: float,
) -> bool:
    return (
        float(thumb_crossing[0]) >= 0.42
        and float(thumb_crossing[2]) >= 0.48
        and float(thumb_to_tip_distance[0]) >= 0.24
        and float(thumb_to_tip_distance[1]) >= 0.30
        and thumb_closest_base == 0
        and thumb_knuckle_clearance >= 0.08
        # Allow a bent thumb for A, but still reject a thumb that is fully tucked in.
        and float(extension_scores[0]) >= 0.46
    )


def _thumb_resting_on_fist_for_s(
    thumb_to_tip_distance: np.ndarray,
    thumb_crossing: np.ndarray,
    thumb_closest_base: int,
    thumb_knuckle_clearance: float,
) -> bool:
    return (
        thumb_knuckle_clearance <= 0.07
        and float(thumb_crossing[0]) <= 0.40
        and float(thumb_crossing[2]) <= 0.42
        and float(thumb_to_tip_distance[0]) <= 0.34
        and float(thumb_to_tip_distance[1]) <= 0.36
        and thumb_closest_base in {0, 1, 2}
    )


def _classify_as_family(
    extension_scores: np.ndarray,
    thumb_to_tip_distance: np.ndarray,
    thumb_crossing: np.ndarray,
    thumb_closest_base: int,
    thumb_knuckle_clearance: float,
) -> Optional[str]:
    if _thumb_outside_a_shape(
        extension_scores,
        thumb_to_tip_distance,
        thumb_crossing,
        thumb_closest_base,
        thumb_knuckle_clearance,
    ):
        return "A"
    if _thumb_resting_on_fist_for_s(
        thumb_to_tip_distance,
        thumb_crossing,
        thumb_closest_base,
        thumb_knuckle_clearance,
    ):
        return "S"
    return None







# Finger hand landmark rules.
def _suggest_rule_label(
    raw_label: str,
    top_labels: list[str],
    analysis: dict,
) -> Optional[str]:
    extended = analysis["extended_flags"] > 0.5
    extension_scores = analysis["extension_scores"]
    curl_scores = analysis["curl_scores"]
    adjacent_tip_distance = analysis["adjacent_tip_distance"]
    thumb_to_tip_distance = analysis["thumb_to_tip_distance"]
    thumb_crossing = analysis["thumb_crossing"]
    index_direction = analysis["index_direction"]
    folded_finger_tips_to_palm = analysis["folded_finger_tips_to_palm"]
    thumb_closest_base = int(analysis["thumb_closest_base"])
    thumb_knuckle_clearance = float(analysis["thumb_knuckle_clearance"])
    aperture = float(analysis["aperture"])
    points = analysis["points"]

    thumb, index, middle, ring, pinky = [bool(value) for value in extended]
    fist_like = not index and not middle and not ring and not pinky

    if _family_active(raw_label, top_labels, {"I", "Y"}):
        if pinky and not index and not middle and not ring:
            return "Y" if thumb else "I"

    if _family_active(raw_label, top_labels, {"U", "V", "W"}):
        if index and middle:
            if ring:
                return "W"
            return "V" if float(adjacent_tip_distance[1]) > 0.22 else "U"

    if _family_active(raw_label, top_labels, {"R", "U"}):
        if index and middle and not ring:
            return "R" if _fingertips_cross(points, (7, 8), (11, 12)) else "U"

    if _family_active(raw_label, top_labels, {"G", "H"}):
        if index:
            return "H" if middle else "G"

    if _family_active(raw_label, top_labels, {"P", "Q"}):
        if float(index_direction[1]) > 0.12:
            return "P" if middle else "Q"

    if _family_active(raw_label, top_labels, {"D", "K", "L"}):
        if index:
            if thumb and not middle:
                return "L"
            if middle:
                return "K"
            return "D"

    if _family_active(raw_label, top_labels, {"C", "O", "F"}):
        return _classify_cof_family(analysis)

    if _family_active(raw_label, top_labels, {"A", "S"}) and {"A", "S"} <= set(top_labels):
        if fist_like:
            as_family = _classify_as_family(
                extension_scores,
                thumb_to_tip_distance,
                thumb_crossing,
                thumb_closest_base,
                thumb_knuckle_clearance,
            )
            if as_family is not None:
                return as_family
            if set(top_labels).issubset({"A", "S"}):
                return None

    if _family_active(raw_label, top_labels, {"E", "S", "T"}):
        fingertips_tucked = float(np.mean(folded_finger_tips_to_palm)) < 0.42
        thumb_cross_y = float(thumb_crossing[1])
        thumb_cross_norm = float(thumb_crossing[2])
        mean_inner_extension = float(np.mean(extension_scores[1:]))
        mean_inner_curl = float(np.mean(curl_scores[1:]))

        if (
            fingertips_tucked
            and thumb_closest_base == 0
            and thumb_cross_norm >= 0.42
            and thumb_cross_y <= -0.22
        ):
            return "T"
        if (
            fingertips_tucked
            and thumb_cross_y <= -0.08
            and thumb_cross_norm >= 0.14
            and mean_inner_extension <= 0.36
            and mean_inner_curl >= 0.55
            and _thumb_resting_on_fist_for_s(
                thumb_to_tip_distance,
                thumb_crossing,
                thumb_closest_base,
                thumb_knuckle_clearance,
            )
        ):
            return "S"
        if fingertips_tucked and thumb_cross_norm <= 0.20 and thumb_cross_y >= -0.12:
            return "E"
        if _thumb_resting_on_fist_for_s(
            thumb_to_tip_distance,
            thumb_crossing,
            thumb_closest_base,
            thumb_knuckle_clearance,
        ):
            return "S"
        return None

    if _family_active(raw_label, top_labels, {"M", "N", "T", "S"}):
        if fist_like:
            if thumb_closest_base >= 2:
                return "M"
            if thumb_closest_base == 1:
                return "N"
            if float(thumb_to_tip_distance[0]) < 0.20:
                return "T"
            if _thumb_resting_on_fist_for_s(
                thumb_to_tip_distance,
                thumb_crossing,
                thumb_closest_base,
                thumb_knuckle_clearance,
            ):
                return "S"

    return None


def _classify_cof_family(analysis: dict) -> Optional[str]:
    thumb_to_tip_distance = analysis["thumb_to_tip_distance"]
    extension_scores = analysis["extension_scores"]
    curl_scores = analysis["curl_scores"]
    aperture = float(analysis["aperture"])
    extended = analysis["extended_flags"] > 0.5

    middle_up = float(extension_scores[2]) >= 0.68 or bool(extended[2])
    ring_up = float(extension_scores[3]) >= 0.66 or bool(extended[3])
    pinky_up = float(extension_scores[4]) >= 0.66 or bool(extended[4])

    thumb_index_tight = float(thumb_to_tip_distance[0]) < 0.17
    thumb_index_closed = float(thumb_to_tip_distance[0]) < 0.24
    thumb_middle_near = float(thumb_to_tip_distance[1]) < 0.36
    thumb_ring_near = float(thumb_to_tip_distance[2]) < 0.52
    mean_inner_extension = float(np.mean(extension_scores[1:4]))
    mean_inner_curl = float(np.mean(curl_scores[1:4]))

    strong_f = (
        thumb_index_tight
        and middle_up
        and ring_up
        and pinky_up
        and float(thumb_to_tip_distance[1]) >= 0.30
        and float(thumb_to_tip_distance[2]) >= 0.44
        and mean_inner_extension >= 0.67
        and mean_inner_curl <= 0.27
    )
    if strong_f:
        return "F"

    strong_o = (
        thumb_index_closed
        and (thumb_middle_near or thumb_ring_near)
        and mean_inner_curl >= 0.23
        and mean_inner_extension <= 0.73
        and aperture <= 0.93
        and not strong_f
    )
    if strong_o:
        return "O"

    if aperture >= 0.94 or not thumb_index_closed:
        return "C"

    return None


def _rule_confidence_floor(suggested: str, analysis: dict) -> Optional[float]:
    if suggested == "O":
        thumb_to_tip_distance = analysis["thumb_to_tip_distance"]
        extension_scores = analysis["extension_scores"]
        curl_scores = analysis["curl_scores"]
        aperture = float(analysis["aperture"])

        thumb_index_closed = float(thumb_to_tip_distance[0]) < 0.24
        thumb_middle_near = float(thumb_to_tip_distance[1]) < 0.36
        thumb_ring_near = float(thumb_to_tip_distance[2]) < 0.52
        mean_inner_extension = float(np.mean(extension_scores[1:4]))
        mean_inner_curl = float(np.mean(curl_scores[1:4]))

        if (
            thumb_index_closed
            and (thumb_middle_near or thumb_ring_near)
            and mean_inner_curl >= 0.23
            and mean_inner_extension <= 0.73
            and aperture <= 0.93
        ):
            return 0.68

    if suggested == "F":
        thumb_to_tip_distance = analysis["thumb_to_tip_distance"]
        extension_scores = analysis["extension_scores"]
        curl_scores = analysis["curl_scores"]
        extended = analysis["extended_flags"] > 0.5

        middle_up = float(extension_scores[2]) >= 0.68 or bool(extended[2])
        ring_up = float(extension_scores[3]) >= 0.66 or bool(extended[3])
        pinky_up = float(extension_scores[4]) >= 0.66 or bool(extended[4])
        thumb_index_tight = float(thumb_to_tip_distance[0]) < 0.17
        mean_inner_extension = float(np.mean(extension_scores[1:4]))
        mean_inner_curl = float(np.mean(curl_scores[1:4]))

        if (
            thumb_index_tight
            and middle_up
            and ring_up
            and pinky_up
            and float(thumb_to_tip_distance[1]) >= 0.30
            and float(thumb_to_tip_distance[2]) >= 0.44
            and mean_inner_extension >= 0.67
            and mean_inner_curl <= 0.27
        ):
            return 0.72

    return None


def _suggest_static_word_label(
    analysis: dict,
    label_space: object,
) -> Optional[str]:
    if _clean_optional_string(label_space) != "words":
        return None

    extension_scores = analysis["extension_scores"]
    curl_scores = analysis["curl_scores"]
    adjacent_tip_distance = analysis["adjacent_tip_distance"]
    thumb_to_tip_distance = analysis["thumb_to_tip_distance"]
    extended = analysis["extended_flags"] > 0.5

    thumb_up = float(extension_scores[0]) >= 0.52 or bool(extended[0])
    index_up = float(extension_scores[1]) >= 0.70 or bool(extended[1])
    middle_down = float(extension_scores[2]) <= 0.42 and float(curl_scores[2]) >= 0.34
    ring_down = float(extension_scores[3]) <= 0.42 and float(curl_scores[3]) >= 0.34
    pinky_up = float(extension_scores[4]) >= 0.68 or bool(extended[4])
    thumb_index_open = float(thumb_to_tip_distance[0]) >= 0.24
    index_middle_split = float(adjacent_tip_distance[1]) >= 0.12
    ring_pinky_split = float(adjacent_tip_distance[3]) >= 0.12

    if (
        thumb_up
        and index_up
        and middle_down
        and ring_down
        and pinky_up
        and thumb_index_open
        and index_middle_split
        and ring_pinky_split
    ):
        return STATIC_WORD_LABELS[0]

    return None


def _static_word_confidence_floor(label: str) -> Optional[float]:
    if label == "I_LOVE_YOU":
        return 0.84
    return None


def _maybe_apply_rule_override(
    raw_label: str,
    raw_confidence: float,
    top_labels: np.ndarray,
    top_scores: np.ndarray,
    analysis: dict,
) -> tuple[str, float]:
    margin = (
        float(top_scores[0] - top_scores[1])
        if len(top_scores) > 1
        else float(top_scores[0])
    )
    if raw_confidence >= RULE_MIN_CONFIDENCE and margin >= RULE_MIN_MARGIN:
        return raw_label, raw_confidence

    top_candidates = [str(label) for label in top_labels[:3]]
    suggested = _suggest_rule_label(raw_label, top_candidates, analysis)
    if not suggested:
        return raw_label, raw_confidence

    confidence_floor = _rule_confidence_floor(suggested, analysis)

    if suggested not in top_candidates and confidence_floor is None:
        return raw_label, raw_confidence

    final_confidence = raw_confidence
    if confidence_floor is not None:
        final_confidence = max(final_confidence, confidence_floor)
    final_confidence = min(final_confidence, CONFIDENCE_OVERRIDE_MAX)
    return suggested, float(final_confidence)


def _prediction_acceptance_policy(active_count: int) -> tuple[float, float]:
    if active_count <= VERY_SMALL_PARTIAL_MODEL_MAX_ACTIVE_LETTERS:
        return (
            VERY_SMALL_PARTIAL_ACCEPTANCE_CONFIDENCE,
            VERY_SMALL_PARTIAL_ACCEPTANCE_MARGIN,
        )
    if active_count <= PARTIAL_MODEL_MAX_ACTIVE_LETTERS:
        return PARTIAL_ACCEPTANCE_CONFIDENCE, PARTIAL_ACCEPTANCE_MARGIN
    return STANDARD_ACCEPTANCE_CONFIDENCE, STANDARD_ACCEPTANCE_MARGIN


def _evaluate_prediction_acceptance(
    *,
    confidence: float,
    margin: float,
    active_static_letters: list[str],
) -> tuple[bool, Optional[str]]:
    active_count = len(active_static_letters)
    min_confidence, min_margin = _prediction_acceptance_policy(active_count)

    if confidence < min_confidence and margin < min_margin:
        return False, "low_confidence_and_margin"
    if confidence < min_confidence:
        return False, "low_confidence"
    if margin < min_margin:
        return False, "low_margin"
    return True, None


def train_landmarks_model(training_mode: object = DEFAULT_TRAINING_MODE) -> dict:
    global landmark_model, landmark_model_metadata, landmark_model_version_id
    normalized_mode = _normalize_training_mode(training_mode)
    requirements = _training_requirements(normalized_mode)
    summary = _dataset_summary()
    ready_static_letters, deficits_by_label = _quota_status(summary, normalized_mode)
    unready_static_letters = [label for label in LABELS if label not in ready_static_letters]
    ready_static_word_labels = [
        label
        for label, stats in summary["static_word_labels"].items()
        if stats["approved"] > 0
    ]
    if len(ready_static_letters) < requirements["min_ready_static_letters"]:
        return {
            "ok": False,
            "error": "Not enough quota-ready static letters to train a partial model.",
            "training_mode": normalized_mode,
            "requirements": requirements,
            "ready_static_letters": ready_static_letters,
            "ready_static_word_labels": ready_static_word_labels,
            "unready_static_letters": unready_static_letters,
            "active_static_letters": [],
            "active_static_word_labels": [],
            "deficits_by_label": deficits_by_label,
            "deficits": [item for deficits in deficits_by_label.values() for item in deficits],
        }

    training_labels = ready_static_letters + ready_static_word_labels
    X, y = load_landmarks_dataset(training_labels)
    if len(X) == 0:
        print("⚠️ No landmark samples found. Collect samples first.")
        return {
            "ok": False,
            "error": "No approved landmark samples found.",
            "training_mode": normalized_mode,
            "requirements": requirements,
            "ready_static_letters": ready_static_letters,
            "ready_static_word_labels": ready_static_word_labels,
            "unready_static_letters": unready_static_letters,
            "active_static_letters": [],
            "active_static_word_labels": [],
            "deficits_by_label": deficits_by_label,
        }

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    train_labels = set(ytr.tolist())
    test_labels = set(yte.tolist())
    missing_after_split = [
        label
        for label in training_labels
        if label not in train_labels or label not in test_labels
    ]
    if missing_after_split:
        return {
            "ok": False,
            "error": "Ready static subset is too small to produce a valid train/holdout split.",
            "training_mode": normalized_mode,
            "requirements": requirements,
            "ready_static_letters": ready_static_letters,
            "ready_static_word_labels": ready_static_word_labels,
            "unready_static_letters": unready_static_letters,
            "active_static_letters": [],
            "active_static_word_labels": [],
            "deficits_by_label": deficits_by_label,
            "split_missing_labels": missing_after_split,
        }

    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"✅ Landmark model trained. Holdout accuracy: {acc:.3f}")
    print(f"✅ Landmark feature dimensions: {X.shape[1]}")
    print(classification_report(yte, pred, zero_division=0))

    landmark_model = model
    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    version_id = datetime.now(timezone.utc).strftime(
        f"landmarks_{normalized_mode}_%Y%m%dT%H%M%SZ"
    )
    version_model_path = _landmark_model_path_for_version(version_id)
    version_metadata_path = _landmark_model_metadata_path_for_version(version_id)
    joblib.dump(landmark_model, version_model_path)
    landmark_model_metadata = {
        "version_id": version_id,
        "label": f"{normalized_mode.replace('_', ' ')} {trained_at}",
        "training_mode": normalized_mode,
        "active_static_letters": sorted(
            str(label) for label in model.classes_ if str(label) in LABELS
        ),
        "active_static_word_labels": sorted(
            str(label) for label in model.classes_ if str(label) in STATIC_WORD_LABELS
        ),
        "ready_static_letters": ready_static_letters,
        "ready_static_word_labels": ready_static_word_labels,
        "unready_static_letters": unready_static_letters,
        "deficits_by_label": deficits_by_label,
        "trained_at": trained_at,
        "training_sample_counts": {
            label: int(summary["labels"][label]["approved"]) for label in ready_static_letters
        }
        | {
            label: int(summary["static_word_labels"][label]["approved"])
            for label in ready_static_word_labels
        },
        "quotas_used": requirements,
    }
    version_metadata_path.write_text(
        json.dumps(landmark_model_metadata, indent=2),
        encoding="utf-8",
    )
    registry = _ensure_legacy_landmark_model_versioned()
    versions = [
        entry
        for entry in registry.get("versions", [])
        if str(entry.get("version_id")) != version_id
    ]
    versions.append(_version_entry(version_id, landmark_model_metadata, source="trained"))
    registry["versions"] = versions
    registry["active_version_id"] = version_id
    _persist_landmark_model_registry(registry)
    _sync_active_model_aliases(version_id, landmark_model_metadata)
    landmark_model_version_id = version_id
    return {
        "ok": True,
        "accuracy": float(acc),
        "feature_dimensions": int(X.shape[1]),
        "active_version_id": version_id,
        "available_versions": _available_landmark_model_versions(),
        "training_mode": normalized_mode,
        "requirements": requirements,
        "active_static_letters": landmark_model_metadata["active_static_letters"],
        "active_static_word_labels": landmark_model_metadata["active_static_word_labels"],
        "ready_static_letters": ready_static_letters,
        "ready_static_word_labels": ready_static_word_labels,
        "unready_static_letters": unready_static_letters,
        "deficits_by_label": deficits_by_label,
    }


def bootstrap_landmark_model() -> None:
    global landmark_model, landmark_model_metadata, landmark_model_version_id
    registry = _ensure_legacy_landmark_model_versioned()
    active_version_id = registry.get("active_version_id")
    if active_version_id and _load_landmark_model_version(str(active_version_id)):
        print(f"✅ Loaded landmark model version {active_version_id}")
        return

    landmark_model_version_id = None
    landmark_model_metadata = _load_landmark_model_metadata()
    if LANDMARKS_MODEL_PATH.exists():
        landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
        if not landmark_model_metadata and hasattr(landmark_model, "classes_"):
            landmark_model_metadata = {
                "active_static_letters": [str(label) for label in landmark_model.classes_]
            }
        print("✅ Loaded landmark model from disk")


def predict_landmarks(
    landmarks: list,
    handedness: Optional[str],
    label_space: Optional[str] = None,
) -> dict:
    global landmark_model, landmark_model_metadata
    if landmark_model is None:
        active_version_id = _active_landmark_model_version_id()
        if active_version_id and _load_landmark_model_version(active_version_id):
            pass
        elif LANDMARKS_MODEL_PATH.exists():
            landmark_model = joblib.load(LANDMARKS_MODEL_PATH)
            if not landmark_model_metadata:
                landmark_model_metadata = _load_landmark_model_metadata()
            if not landmark_model_metadata and hasattr(landmark_model, "classes_"):
                landmark_model_metadata = {
                    "active_static_letters": [str(label) for label in landmark_model.classes_]
                }
        else:
            return {"label": "NO_LANDMARK_MODEL", "confidence": 0.0}

    vec = landmark_feature_vector(landmarks, handedness).reshape(1, -1)
    top_labels, top_scores = _top_predictions(landmark_model, vec)
    raw_label = str(top_labels[0])
    raw_confidence = float(top_scores[0])
    margin = (
        float(top_scores[0] - top_scores[1])
        if len(top_scores) > 1
        else float(top_scores[0])
    )
    analysis = analyze_hand_landmarks(landmarks, handedness)
    label, confidence = _maybe_apply_rule_override(
        raw_label, raw_confidence, top_labels, top_scores, analysis
    )
    active_static_letters = _active_static_letters()
    active_static_word_labels = _active_static_word_labels()
    if _clean_optional_string(label_space) == "words":
        if label in active_static_word_labels:
            return {
                "label": label,
                "confidence": confidence,
                "accepted_prediction": True,
                "raw_label": raw_label,
                "raw_confidence": raw_confidence,
                "margin": margin,
                "active_static_letters": active_static_letters,
                "active_static_word_labels": active_static_word_labels,
                "unknown_reason": None,
            }

    static_word_label = _suggest_static_word_label(analysis, label_space)
    if static_word_label:
        label = static_word_label
        confidence = max(confidence, _static_word_confidence_floor(static_word_label) or confidence)
        return {
            "label": label,
            "confidence": confidence,
            "accepted_prediction": True,
            "raw_label": raw_label,
            "raw_confidence": raw_confidence,
            "margin": margin,
            "active_static_letters": active_static_letters,
            "active_static_word_labels": active_static_word_labels,
            "unknown_reason": None,
        }

    accepted_prediction, unknown_reason = _evaluate_prediction_acceptance(
        confidence=confidence,
        margin=margin,
        active_static_letters=active_static_letters,
    )
    return {
        "label": label,
        "confidence": confidence,
        "accepted_prediction": accepted_prediction,
        "raw_label": raw_label,
        "raw_confidence": raw_confidence,
        "margin": margin,
        "active_static_letters": active_static_letters,
        "active_static_word_labels": active_static_word_labels,
        "unknown_reason": unknown_reason,
    }


def upload_landmarks(
    label: str,
    landmarks: list,
    handedness: Optional[str],
    signer_id: Optional[str] = None,
    capture_session_id: Optional[str] = None,
    device_id: Optional[str] = None,
    camera_position: Optional[str] = None,
    accepted: Optional[bool] = None,
    review_status: Optional[str] = None,
    review_notes: Optional[str] = None,
    variant_tags: Optional[list[str]] = None,
    captured_at: Optional[str] = None,
) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label in MOTION_ONLY_LETTER_LABELS:
        return {
            "ok": False,
            "error": (
                f"{normalized_label} is motion-only for static landmarks. "
                "Collect it through the gesture pipeline instead."
            ),
        }

    if normalized_label not in LABELS:
        return {"ok": False, "error": f"Invalid label: {normalized_label}"}

    normalized_handedness = _normalize_handedness(handedness)
    if normalized_handedness is None:
        return {"ok": False, "error": "Handedness is required and must be Left or Right."}

    if not isinstance(landmarks, list) or len(landmarks) != 21:
        return {"ok": False, "error": "Exactly 21 landmarks are required."}

    normalized_record = _normalize_landmark_record(
        {
            "label": normalized_label,
            "handedness": normalized_handedness,
            "landmarks": landmarks,
            "signer_id": signer_id,
            "capture_session_id": capture_session_id,
            "device_id": device_id,
            "camera_position": camera_position,
            "accepted": accepted,
            "review_status": review_status,
            "review_notes": review_notes,
            "variant_tags": variant_tags,
            "captured_at": captured_at
            or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }
    )

    if not normalized_record["signer_id"]:
        return {"ok": False, "error": "signer_id is required for the reviewed dataset."}
    if not normalized_record["capture_session_id"]:
        return {"ok": False, "error": "capture_session_id is required."}
    if not normalized_record["camera_position"]:
        return {"ok": False, "error": "camera_position must be front or back."}

    if normalized_record["review_status"] == "approved" and not normalized_record["accepted"]:
        return {"ok": False, "error": "Approved records must set accepted=true."}
    if normalized_record["review_status"] != "approved":
        normalized_record["accepted"] = False

    path = LANDMARKS_DIR / f"{normalized_label}.jsonl"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(normalized_record) + "\n")

    return {
        "ok": True,
        "saved": str(path),
        "review_status": normalized_record["review_status"],
        "accepted": normalized_record["accepted"],
    }


def upload_static_word_landmark(
    label: str,
    landmarks: list,
    handedness: Optional[str],
    signer_id: Optional[str] = None,
    capture_session_id: Optional[str] = None,
    device_id: Optional[str] = None,
    camera_position: Optional[str] = None,
    accepted: Optional[bool] = None,
    review_status: Optional[str] = None,
    review_notes: Optional[str] = None,
    variant_tags: Optional[list[str]] = None,
    captured_at: Optional[str] = None,
) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label not in STATIC_WORD_LABELS:
        return {"ok": False, "error": f"Invalid static word label: {normalized_label}"}

    normalized_handedness = _normalize_handedness(handedness)
    if normalized_handedness is None:
        return {"ok": False, "error": "Handedness is required and must be Left or Right."}

    if not isinstance(landmarks, list) or len(landmarks) != 21:
        return {"ok": False, "error": "Exactly 21 landmarks are required."}

    normalized_record = _normalize_landmark_record(
        {
            "label": normalized_label,
            "handedness": normalized_handedness,
            "landmarks": landmarks,
            "signer_id": signer_id,
            "capture_session_id": capture_session_id,
            "device_id": device_id,
            "camera_position": camera_position,
            "accepted": accepted,
            "review_status": review_status,
            "review_notes": review_notes,
            "variant_tags": variant_tags,
            "captured_at": captured_at
            or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }
    )

    if not normalized_record["signer_id"]:
        return {"ok": False, "error": "signer_id is required for the reviewed dataset."}
    if not normalized_record["capture_session_id"]:
        return {"ok": False, "error": "capture_session_id is required."}
    if not normalized_record["camera_position"]:
        return {"ok": False, "error": "camera_position must be front or back."}

    if normalized_record["review_status"] == "approved" and not normalized_record["accepted"]:
        return {"ok": False, "error": "Approved records must set accepted=true."}
    if normalized_record["review_status"] != "approved":
        normalized_record["accepted"] = False

    path = STATIC_WORD_LANDMARKS_DIR / f"{normalized_label}.jsonl"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(normalized_record) + "\n")

    return {
        "ok": True,
        "saved": str(path),
        "review_status": normalized_record["review_status"],
        "accepted": normalized_record["accepted"],
    }


def landmark_label_summary(
    label: str,
    capture_session_id: Optional[str] = None,
    signer_id: Optional[str] = None,
) -> dict:
    normalized_label = _clean_optional_string(label)
    if not normalized_label:
        return {"ok": False, "error": "label is required."}
    normalized_label = normalized_label.upper()
    if normalized_label not in LABELS:
        return {"ok": False, "error": f"Invalid static landmark label: {normalized_label}"}

    normalized_session_id = _clean_optional_string(capture_session_id)
    normalized_signer_id = _clean_optional_string(signer_id)
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
    }

    for record in _iter_label_records(normalized_label) or ():
        kind = _record_kind(record)
        summary[kind] += 1
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
            if kind == "pending":
                summary["session_pending"] += 1
            elif kind == "approved":
                summary["session_approved"] += 1
            elif kind == "rejected":
                summary["session_rejected"] += 1

    return {
        "ok": True,
        "label": normalized_label,
        **summary,
    }


def health_summary() -> dict:
    dataset = _dataset_summary()
    available_versions = _available_landmark_model_versions()
    archived_versions = _available_archived_landmark_model_versions()
    active_version_id = _active_landmark_model_version_id()
    current_mode = _current_landmark_training_mode()
    readiness_by_mode: dict[str, list[str]] = {}
    unready_by_mode: dict[str, list[str]] = {}
    deficits_by_mode: dict[str, dict[str, list[str]]] = {}
    for mode_name in LANDMARK_TRAINING_MODES:
        mode_ready, mode_deficits = _quota_status(dataset, mode_name)
        readiness_by_mode[mode_name] = mode_ready
        unready_by_mode[mode_name] = [label for label in LABELS if label not in mode_ready]
        deficits_by_mode[mode_name] = mode_deficits
    ready_static_letters = readiness_by_mode[current_mode]
    unready_static_letters = unready_by_mode[current_mode]
    deficits_by_label = deficits_by_mode[current_mode]
    counts_by_label = {}
    static_word_counts_by_label = {}
    total = 0
    for label, stats in dataset["labels"].items():
        signer_count = len(stats["signer_ids"])
        counts_by_label[label] = {
            "approved": stats["approved"],
            "pending": stats["pending"],
            "rejected": stats["rejected"],
            "legacy": stats["legacy"],
            "by_hand": stats["by_hand"],
            "signer_count": signer_count,
        }
        total += stats["approved"] + stats["pending"] + stats["rejected"] + stats["legacy"]
    for label, stats in dataset["static_word_labels"].items():
        static_word_counts_by_label[label] = {
            "approved": stats["approved"],
            "pending": stats["pending"],
            "rejected": stats["rejected"],
            "legacy": stats["legacy"],
            "by_hand": stats["by_hand"],
            "signer_count": len(stats["signer_ids"]),
        }

    return {
        "trained_landmarks": bool(active_version_id or LANDMARKS_MODEL_PATH.exists()),
        "landmark_total": total,
        "landmark_counts": counts_by_label,
        "landmarks_dir": str(LANDMARKS_DIR),
        "static_landmark_labels": LABELS,
        "current_landmark_training_mode": current_mode,
        "active_landmark_model_version_id": active_version_id,
        "available_landmark_model_versions": available_versions,
        "archived_landmark_model_versions": archived_versions,
        "ready_static_letters": ready_static_letters,
        "unready_static_letters": unready_static_letters,
        "ready_static_letters_by_mode": readiness_by_mode,
        "unready_static_letters_by_mode": unready_by_mode,
        "active_static_letters": _active_static_letters(),
        "active_static_word_labels": _active_static_word_labels(),
        "static_word_landmark_counts": static_word_counts_by_label,
        "static_word_labels": STATIC_WORD_LABELS,
        "deficits_by_label": deficits_by_label,
        "deficits_by_label_by_mode": deficits_by_mode,
        "motion_only_letter_labels": MOTION_ONLY_LETTER_LABELS,
        "landmark_requirements": {
            "current_mode": current_mode,
            "current": _training_requirements(current_mode),
            "modes": {
                mode_name: _training_requirements(mode_name)
                for mode_name in LANDMARK_TRAINING_MODES
            },
        },
    }
