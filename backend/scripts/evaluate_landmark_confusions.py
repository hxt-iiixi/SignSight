from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

from app.core.paths import LANDMARKS_DIR
from app.ml.landmarks import analyze_hand_landmarks, landmark_feature_vector
from app.services.landmark_classifier import (
    _maybe_apply_rule_override,
    _classify_cof_family,
    _top_predictions,
    load_landmarks_dataset,
)


CONFUSION_FAMILIES: list[tuple[str, list[str]]] = [
    ("I/Y", ["I", "Y"]),
    ("U/V/W", ["U", "V", "W"]),
    ("M/N/T/S/E", ["M", "N", "T", "S", "E"]),
    ("D/K/L", ["D", "K", "L"]),
    ("G/H", ["G", "H"]),
    ("P/Q", ["P", "Q"]),
    ("R/U", ["R", "U"]),
    ("C/O/F", ["C", "O", "F"]),
]


@dataclass
class EvalRow:
    truth: str
    raw_pred: str
    adjusted_pred: str


def train_eval_model():
    X, y = load_landmarks_dataset()
    if len(X) == 0:
        raise SystemExit("No landmark samples found.")

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = SVC(kernel="rbf", probability=True, gamma="scale", C=12)
    model.fit(Xtr, ytr)
    return model, Xte, yte


def evaluate_rows_with_rules(model: SVC, Xte: np.ndarray, yte: np.ndarray) -> list[EvalRow]:
    import json

    # Reconstruct a lookup from engineered vector bytes to original landmarks so the exact
    # same test split can be evaluated with analysis-backed rules.
    vector_to_landmarks: dict[bytes, tuple[list, str | None]] = {}
    for path in LANDMARKS_DIR.glob("*.jsonl"):
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                vec = landmark_feature_vector(obj["landmarks"], obj.get("handedness"))
                vector_to_landmarks[vec.tobytes()] = (obj["landmarks"], obj.get("handedness"))

    rows: list[EvalRow] = []
    for vec, truth in zip(Xte, yte, strict=False):
        vec_2d = vec.reshape(1, -1)
        top_labels, top_scores = _top_predictions(model, vec_2d)
        raw_pred = str(top_labels[0])
        raw_conf = float(top_scores[0])
        original = vector_to_landmarks.get(vec.tobytes())
        if original is None:
            adjusted_pred = raw_pred
        else:
            landmarks, handedness = original
            analysis = analyze_hand_landmarks(landmarks, handedness)
            adjusted_pred, _ = _maybe_apply_rule_override(
                raw_pred,
                raw_conf,
                top_labels,
                top_scores,
                analysis,
            )
        rows.append(EvalRow(truth=str(truth), raw_pred=raw_pred, adjusted_pred=adjusted_pred))
    return rows


def print_family_report(rows: list[EvalRow], name: str, labels: list[str]) -> None:
    filtered = [row for row in rows if row.truth in labels]
    if not filtered:
        print(f"\n{name}: no samples")
        return

    y_true = [row.truth for row in filtered]
    y_raw = [row.raw_pred for row in filtered]
    y_adjusted = [row.adjusted_pred for row in filtered]

    raw_acc = accuracy_score(y_true, y_raw)
    adj_acc = accuracy_score(y_true, y_adjusted)

    print(f"\n=== {name} ===")
    print(f"subset accuracy raw      : {raw_acc:.3f}")
    print(f"subset accuracy adjusted : {adj_acc:.3f}")

    print("\nraw classification report")
    print(classification_report(y_true, y_raw, labels=labels, zero_division=0))

    print("adjusted classification report")
    print(classification_report(y_true, y_adjusted, labels=labels, zero_division=0))

    raw_cm = confusion_matrix(y_true, y_raw, labels=labels)
    adj_cm = confusion_matrix(y_true, y_adjusted, labels=labels)
    print("raw confusion matrix")
    print(raw_cm)
    print("adjusted confusion matrix")
    print(adj_cm)


def print_cof_probe() -> None:
    import json

    print("\n=== C/O/F Probe ===")
    for label in ["O", "C", "F"]:
        path = LANDMARKS_DIR / f"{label}.jsonl"
        if not path.exists():
            print(f"{label}: no fixture file")
            continue

        lines = path.read_text(encoding="utf-8").splitlines()
        if not lines:
            print(f"{label}: empty fixture file")
            continue

        suggested: list[str] = []
        for line in lines:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            analysis = analyze_hand_landmarks(obj["landmarks"], obj.get("handedness"))
            suggested.append(_classify_cof_family(analysis) or "None")

        counts: dict[str, int] = {}
        for item in suggested:
            counts[item] = counts.get(item, 0) + 1
        print(f"{label}: {counts}")


def main() -> None:
    print_cof_probe()
    model, Xte, yte = train_eval_model()
    rows = evaluate_rows_with_rules(model, Xte, yte)

    y_true = [row.truth for row in rows]
    y_raw = [row.raw_pred for row in rows]
    y_adjusted = [row.adjusted_pred for row in rows]

    print("Overall holdout accuracy")
    print(f"raw      : {accuracy_score(y_true, y_raw):.3f}")
    print(f"adjusted : {accuracy_score(y_true, y_adjusted):.3f}")

    for family_name, labels in CONFUSION_FAMILIES:
        print_family_report(rows, family_name, labels)


if __name__ == "__main__":
    main()
