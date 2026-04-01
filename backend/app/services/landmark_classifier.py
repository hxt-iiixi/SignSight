import json
from typing import Optional

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.constants import LABELS
from app.core.paths import LANDMARKS_DIR, LANDMARKS_MODEL_PATH
from app.ml.landmarks import analyze_hand_landmarks, landmark_feature_vector


landmark_model: Optional[SVC] = None

CONFIDENCE_OVERRIDE_MAX = 0.92
RULE_MIN_CONFIDENCE = 0.85
RULE_MIN_MARGIN = 0.18


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
                        landmark_feature_vector(obj["landmarks"], obj.get("handedness"))
                    )
                    y.append(obj["label"])
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
        if float(thumb_to_tip_distance[0]) < 0.16:
            return "F" if int(np.sum(extended[1:4])) >= 2 else "O"
        if aperture > 0.78:
            return "C"

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

    if suggested not in top_candidates:
        return raw_label, raw_confidence

    final_confidence = min(raw_confidence, CONFIDENCE_OVERRIDE_MAX)
    return suggested, float(final_confidence)


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
    print(f"✅ Landmark feature dimensions: {X.shape[1]}")
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

    vec = landmark_feature_vector(landmarks, handedness).reshape(1, -1)
    top_labels, top_scores = _top_predictions(landmark_model, vec)
    raw_label = str(top_labels[0])
    raw_confidence = float(top_scores[0])
    analysis = analyze_hand_landmarks(landmarks, handedness)
    label, confidence = _maybe_apply_rule_override(
        raw_label, raw_confidence, top_labels, top_scores, analysis
    )
    return {"label": label, "confidence": confidence}


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
