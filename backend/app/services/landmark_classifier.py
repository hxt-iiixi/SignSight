import json
from datetime import datetime, timezone
from typing import Optional

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import LABELS, MOTION_ONLY_LETTER_LABELS
from app.core.paths import LANDMARKS_DIR, LANDMARKS_MODEL_PATH
from app.ml.landmarks import analyze_hand_landmarks, landmark_feature_vector


landmark_model: Optional[SVC] = None

CONFIDENCE_OVERRIDE_MAX = 0.92
RULE_MIN_CONFIDENCE = 0.85
RULE_MIN_MARGIN = 0.18
MIN_APPROVED_SAMPLES_PER_LABEL = 480
MIN_APPROVED_PER_HAND = 240
MIN_SIGNERS_PER_LABEL = 8
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


def _dataset_summary() -> dict:
    summary: dict[str, dict] = {}
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

    return {"labels": summary, "approved_records": approved_records}


def load_approved_landmark_records() -> list[dict]:
    return list(_dataset_summary()["approved_records"])


def _training_gate_failures(summary: dict) -> list[str]:
    failures: list[str] = []
    label_stats = summary["labels"]

    for label in LABELS:
        stats = label_stats[label]
        signer_count = len(stats["signer_ids"])
        if stats["approved"] < MIN_APPROVED_SAMPLES_PER_LABEL:
            failures.append(
                f"{label}: approved {stats['approved']}/{MIN_APPROVED_SAMPLES_PER_LABEL}"
            )
        if stats["by_hand"]["Left"] < MIN_APPROVED_PER_HAND:
            failures.append(
                f"{label}: Left hand {stats['by_hand']['Left']}/{MIN_APPROVED_PER_HAND}"
            )
        if stats["by_hand"]["Right"] < MIN_APPROVED_PER_HAND:
            failures.append(
                f"{label}: Right hand {stats['by_hand']['Right']}/{MIN_APPROVED_PER_HAND}"
            )
        if signer_count < MIN_SIGNERS_PER_LABEL:
            failures.append(f"{label}: signers {signer_count}/{MIN_SIGNERS_PER_LABEL}")

    return failures


def load_landmarks_dataset():
    X, y = [], []
    for record in load_approved_landmark_records():
        try:
            X.append(landmark_feature_vector(record["landmarks"], record["handedness"]))
            y.append(record["label"])
        except Exception:
            pass

    if len(X) == 0:
        return np.array([]), np.array([])

    return np.stack(X).astype(np.float32), np.array(y)


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

    if _family_active(raw_label, top_labels, {"A", "S"}):
        if fist_like:
            return "A" if float(extension_scores[0]) > 0.52 else "S"

    if _family_active(raw_label, top_labels, {"M", "N", "T", "S"}):
        if fist_like:
            if thumb_closest_base >= 2:
                return "M"
            if thumb_closest_base == 1:
                return "N"
            if float(thumb_to_tip_distance[0]) < 0.20:
                return "T"
            return "S"

    if _family_active(raw_label, top_labels, {"E", "S", "T"}):
        fingertips_tucked = float(np.mean(folded_finger_tips_to_palm)) < 0.42
        if fingertips_tucked and float(thumb_crossing[2]) < 0.34:
            return "E"
        if float(thumb_to_tip_distance[0]) < 0.20:
            return "T"
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


def train_landmarks_model() -> dict:
    global landmark_model
    summary = _dataset_summary()
    failures = _training_gate_failures(summary)
    if failures:
        landmark_model = None
        return {
            "ok": False,
            "error": "Static landmark dataset does not meet minimum review quotas.",
            "requirements": {
                "min_approved_samples_per_label": MIN_APPROVED_SAMPLES_PER_LABEL,
                "min_approved_per_hand": MIN_APPROVED_PER_HAND,
                "min_signers_per_label": MIN_SIGNERS_PER_LABEL,
            },
            "deficits": failures,
        }

    X, y = load_landmarks_dataset()
    if len(X) == 0:
        landmark_model = None
        print("⚠️ No landmark samples found. Collect samples first.")
        return {"ok": False, "error": "No approved landmark samples found."}

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"✅ Landmark model trained. Holdout accuracy: {acc:.3f}")
    print(f"✅ Landmark feature dimensions: {X.shape[1]}")
    print(classification_report(yte, pred, zero_division=0))

    landmark_model = model
    joblib.dump(landmark_model, LANDMARKS_MODEL_PATH)
    return {
        "ok": True,
        "accuracy": float(acc),
        "feature_dimensions": int(X.shape[1]),
        "labels": LABELS,
    }


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

    vec = landmark_feature_vector(landmarks, handedness).reshape(1, -1)
    top_labels, top_scores = _top_predictions(landmark_model, vec)
    raw_label = str(top_labels[0])
    raw_confidence = float(top_scores[0])
    analysis = analyze_hand_landmarks(landmarks, handedness)
    label, confidence = _maybe_apply_rule_override(
        raw_label, raw_confidence, top_labels, top_scores, analysis
    )
    return {"label": label, "confidence": confidence}


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


def health_summary() -> dict:
    dataset = _dataset_summary()
    counts_by_label = {}
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

    return {
        "trained_landmarks": LANDMARKS_MODEL_PATH.exists(),
        "landmark_total": total,
        "landmark_counts": counts_by_label,
        "landmarks_dir": str(LANDMARKS_DIR),
        "static_landmark_labels": LABELS,
        "motion_only_letter_labels": MOTION_ONLY_LETTER_LABELS,
        "landmark_requirements": {
            "min_approved_samples_per_label": MIN_APPROVED_SAMPLES_PER_LABEL,
            "min_approved_per_hand": MIN_APPROVED_PER_HAND,
            "min_signers_per_label": MIN_SIGNERS_PER_LABEL,
        },
    }
