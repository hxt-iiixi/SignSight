from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.multiclass import OneVsRestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC

from app.core.constants import LABELS
from app.core.paths import MODELS_DIR
from app.ml.landmarks import analyze_hand_landmarks, landmark_feature_vector
from app.services.landmark_classifier import (
    _maybe_apply_rule_override,
    _top_predictions,
    load_approved_landmark_records,
)


BENCHMARK_DIR = MODELS_DIR / "benchmarks"
BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_SEED = 42
ROW_TEST_SIZE = 0.2
SIGNER_TEST_SIZE = 0.2
MIN_APPROVED_PER_LABEL_FOR_BENCHMARK = 10
MIN_SIGNERS_PER_LABEL_FOR_GROUP_SPLIT = 2
PROMOTION_MIN_IMPROVEMENT = 0.005

CONFUSION_FAMILIES: list[tuple[str, list[str]]] = [
    ("C/O/F", ["C", "O", "F"]),
    ("D/K/L", ["D", "K", "L"]),
    ("E/M/N/S/T", ["E", "M", "N", "S", "T"]),
    ("G/H", ["G", "H"]),
    ("I/Y", ["I", "Y"]),
    ("P/Q", ["P", "Q"]),
    ("R/U/V/W", ["R", "U", "V", "W"]),
]


@dataclass(frozen=True)
class CandidateSpec:
    key: str
    display_name: str
    params: dict[str, Any]

    def build(self):
        if self.key == "svc_rbf":
            return SVC(kernel="rbf", probability=True, gamma="scale", C=12, random_state=RANDOM_SEED)
        if self.key == "random_forest":
            return RandomForestClassifier(
                n_estimators=400,
                max_depth=None,
                min_samples_leaf=1,
                random_state=RANDOM_SEED,
                n_jobs=-1,
            )
        if self.key == "extra_trees":
            return ExtraTreesClassifier(
                n_estimators=400,
                max_depth=None,
                min_samples_leaf=1,
                random_state=RANDOM_SEED,
                n_jobs=-1,
            )
        if self.key == "hist_gradient_boosting":
            return OneVsRestClassifier(
                HistGradientBoostingClassifier(
                    learning_rate=0.08,
                    max_iter=250,
                    max_depth=None,
                    random_state=RANDOM_SEED,
                ),
                n_jobs=-1,
            )
        if self.key == "knn":
            return KNeighborsClassifier(n_neighbors=7, weights="distance")
        raise ValueError(f"Unsupported candidate: {self.key}")


CANDIDATES = [
    CandidateSpec(
        key="svc_rbf",
        display_name="SVC (RBF)",
        params={"kernel": "rbf", "probability": True, "gamma": "scale", "C": 12},
    ),
    CandidateSpec(
        key="random_forest",
        display_name="Random Forest",
        params={"n_estimators": 400, "random_state": RANDOM_SEED},
    ),
    CandidateSpec(
        key="extra_trees",
        display_name="Extra Trees",
        params={"n_estimators": 400, "random_state": RANDOM_SEED},
    ),
    CandidateSpec(
        key="hist_gradient_boosting",
        display_name="HistGradientBoosting (OvR)",
        params={"learning_rate": 0.08, "max_iter": 250, "random_state": RANDOM_SEED},
    ),
    CandidateSpec(
        key="knn",
        display_name="KNN",
        params={"n_neighbors": 7, "weights": "distance"},
    ),
]


def _per_label_counts(records: list[dict]) -> dict[str, dict[str, Any]]:
    counts: dict[str, dict[str, Any]] = {}
    for label in LABELS:
        label_records = [record for record in records if record["label"] == label]
        left = sum(1 for record in label_records if record.get("handedness") == "Left")
        right = sum(1 for record in label_records if record.get("handedness") == "Right")
        signer_ids = sorted(
            {
                str(record["signer_id"])
                for record in label_records
                if record.get("signer_id")
            }
        )
        counts[label] = {
            "approved": len(label_records),
            "by_hand": {"Left": left, "Right": right},
            "signer_count": len(signer_ids),
            "signer_ids": signer_ids,
        }
    return counts


def _validate_benchmark_dataset(records: list[dict]) -> tuple[bool, list[str]]:
    deficits: list[str] = []
    counts = _per_label_counts(records)
    for label, stats in counts.items():
        if stats["approved"] < MIN_APPROVED_PER_LABEL_FOR_BENCHMARK:
            deficits.append(
                f"{label}: approved {stats['approved']}/{MIN_APPROVED_PER_LABEL_FOR_BENCHMARK}"
            )
    return (len(deficits) == 0, deficits)


def _build_dataset(records: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    X = np.stack(
        [
            landmark_feature_vector(record["landmarks"], record.get("handedness"))
            for record in records
        ]
    ).astype(np.float32)
    y = np.array([record["label"] for record in records])
    return X, y


def _row_stratified_split(records: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    labels = np.array([record["label"] for record in records])
    indices = np.arange(len(records))
    train_idx, test_idx = train_test_split(
        indices,
        test_size=ROW_TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=labels,
    )
    return train_idx, test_idx


def _signer_holdout_split(records: list[dict]) -> tuple[np.ndarray, np.ndarray] | None:
    signer_ids = np.array([record.get("signer_id") or "" for record in records])
    labels = np.array([record["label"] for record in records])
    label_to_signers: dict[str, set[str]] = {label: set() for label in LABELS}
    for record in records:
        label_to_signers[record["label"]].add(record.get("signer_id") or "")

    if any(len(signers) < MIN_SIGNERS_PER_LABEL_FOR_GROUP_SPLIT for signers in label_to_signers.values()):
        return None

    indices = np.arange(len(records))
    for attempt_seed in range(RANDOM_SEED, RANDOM_SEED + 40):
        splitter = GroupShuffleSplit(n_splits=1, test_size=SIGNER_TEST_SIZE, random_state=attempt_seed)
        train_idx, test_idx = next(splitter.split(indices, labels, groups=signer_ids))
        train_labels = set(labels[train_idx])
        test_labels = set(labels[test_idx])
        if train_labels == set(LABELS) and test_labels == set(LABELS):
            return train_idx, test_idx
    return None


def _evaluate_family(y_true: list[str], y_pred: list[str], labels: list[str]) -> dict[str, Any]:
    mask = [truth in labels for truth in y_true]
    family_truth = [truth for truth, keep in zip(y_true, mask, strict=False) if keep]
    family_pred = [pred for pred, keep in zip(y_pred, mask, strict=False) if keep]
    if not family_truth:
        return {"accuracy": None, "macro_f1": None, "confusion_matrix": [], "labels": labels}

    report = classification_report(
        family_truth,
        family_pred,
        labels=labels,
        zero_division=0,
        output_dict=True,
    )
    cm = confusion_matrix(family_truth, family_pred, labels=labels).tolist()
    return {
        "accuracy": float(accuracy_score(family_truth, family_pred)),
        "macro_f1": float(report["macro avg"]["f1-score"]),
        "confusion_matrix": cm,
        "labels": labels,
    }


def _top_predictions_generic(model, vec: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(vec)[0]
        order = np.argsort(probabilities)[::-1]
        return np.array(model.classes_)[order], probabilities[order]

    pred = model.predict(vec)[0]
    return np.array([pred]), np.array([1.0], dtype=np.float32)


def _evaluate_predictions(model, Xte: np.ndarray, rows: list[dict]) -> dict[str, Any]:
    raw_preds: list[str] = []
    adjusted_preds: list[str] = []
    adjusted_confidences: list[float] = []
    y_true = [row["label"] for row in rows]

    for vec, row in zip(Xte, rows, strict=False):
        vec_2d = vec.reshape(1, -1)
        if isinstance(model, SVC):
            top_labels, top_scores = _top_predictions(model, vec_2d)
        else:
            top_labels, top_scores = _top_predictions_generic(model, vec_2d)

        raw_label = str(top_labels[0])
        raw_conf = float(top_scores[0])
        raw_preds.append(raw_label)

        analysis = analyze_hand_landmarks(row["landmarks"], row.get("handedness"))
        adjusted_label, adjusted_conf = _maybe_apply_rule_override(
            raw_label,
            raw_conf,
            top_labels,
            top_scores,
            analysis,
        )
        adjusted_preds.append(adjusted_label)
        adjusted_confidences.append(float(adjusted_conf))

    raw_report = classification_report(
        y_true,
        raw_preds,
        labels=LABELS,
        zero_division=0,
        output_dict=True,
    )
    adjusted_report = classification_report(
        y_true,
        adjusted_preds,
        labels=LABELS,
        zero_division=0,
        output_dict=True,
    )

    def pack_metrics(preds: list[str], report: dict[str, Any]) -> dict[str, Any]:
        return {
            "accuracy": float(accuracy_score(y_true, preds)),
            "macro_f1": float(f1_score(y_true, preds, labels=LABELS, average="macro", zero_division=0)),
            "weighted_f1": float(f1_score(y_true, preds, labels=LABELS, average="weighted", zero_division=0)),
            "per_class": {
                label: {
                    "precision": float(report[label]["precision"]),
                    "recall": float(report[label]["recall"]),
                    "f1": float(report[label]["f1-score"]),
                    "support": int(report[label]["support"]),
                }
                for label in LABELS
            },
            "confusion_families": {
                name: _evaluate_family(y_true, preds, labels)
                for name, labels in CONFUSION_FAMILIES
            },
        }

    return {
        "raw": pack_metrics(raw_preds, raw_report),
        "adjusted": pack_metrics(adjusted_preds, adjusted_report),
        "adjusted_confidence_summary": {
            "mean": float(np.mean(adjusted_confidences)) if adjusted_confidences else 0.0,
            "min": float(np.min(adjusted_confidences)) if adjusted_confidences else 0.0,
            "max": float(np.max(adjusted_confidences)) if adjusted_confidences else 0.0,
        },
    }


def _benchmark_model(
    candidate: CandidateSpec,
    split_mode: str,
    Xtr: np.ndarray,
    ytr: np.ndarray,
    Xte: np.ndarray,
    test_rows: list[dict],
) -> dict[str, Any]:
    model = candidate.build()

    train_started = time.perf_counter()
    model.fit(Xtr, ytr)
    train_time_s = time.perf_counter() - train_started

    predict_started = time.perf_counter()
    prediction_metrics = _evaluate_predictions(model, Xte, test_rows)
    predict_time_s = time.perf_counter() - predict_started

    return {
        "model_key": candidate.key,
        "display_name": candidate.display_name,
        "params": candidate.params,
        "split_mode": split_mode,
        "train_time_s": round(train_time_s, 4),
        "predict_time_s": round(predict_time_s, 4),
        "metrics": prediction_metrics,
    }


def _family_safe_score(result: dict[str, Any]) -> tuple[float, float]:
    adjusted = result["metrics"]["adjusted"]
    family_macro = np.mean(
        [
            metrics["macro_f1"]
            for metrics in adjusted["confusion_families"].values()
            if metrics["macro_f1"] is not None
        ]
    )
    return float(family_macro), float(adjusted["macro_f1"])


def _choose_winners(results: list[dict[str, Any]]) -> dict[str, Any]:
    baseline = next(result for result in results if result["model_key"] == "svc_rbf")
    baseline_adjusted = baseline["metrics"]["adjusted"]

    best_overall = max(
        results,
        key=lambda result: (
            result["metrics"]["adjusted"]["accuracy"],
            result["metrics"]["adjusted"]["macro_f1"],
        ),
    )

    safe_candidates: list[dict[str, Any]] = []
    for result in results:
        adjusted = result["metrics"]["adjusted"]
        overall_gain = adjusted["accuracy"] - baseline_adjusted["accuracy"]
        macro_gain = adjusted["macro_f1"] - baseline_adjusted["macro_f1"]
        regressed = False
        for family_name, family_metrics in adjusted["confusion_families"].items():
            baseline_family = baseline_adjusted["confusion_families"][family_name]
            if (
                family_metrics["accuracy"] is not None
                and baseline_family["accuracy"] is not None
                and family_metrics["accuracy"] + 1e-9 < baseline_family["accuracy"]
            ):
                regressed = True
                break

        if regressed:
            continue
        if overall_gain >= PROMOTION_MIN_IMPROVEMENT or macro_gain >= PROMOTION_MIN_IMPROVEMENT:
            safe_candidates.append(result)

    best_safe = (
        max(safe_candidates, key=lambda result: _family_safe_score(result))
        if safe_candidates
        else baseline
    )

    return {
        "baseline": baseline["model_key"],
        "best_overall": best_overall["model_key"],
        "best_confusion_family_safe": best_safe["model_key"],
    }


def _run_split(records: list[dict], split_mode: str) -> dict[str, Any] | None:
    X, y = _build_dataset(records)
    if split_mode == "row_stratified":
        train_idx, test_idx = _row_stratified_split(records)
    elif split_mode == "signer_holdout":
        split = _signer_holdout_split(records)
        if split is None:
            return None
        train_idx, test_idx = split
    else:
        raise ValueError(f"Unknown split mode: {split_mode}")

    Xtr, ytr = X[train_idx], y[train_idx]
    Xte = X[test_idx]
    test_rows = [records[index] for index in test_idx]

    results = [
        _benchmark_model(candidate, split_mode, Xtr, ytr, Xte, test_rows)
        for candidate in CANDIDATES
    ]

    return {
        "split_mode": split_mode,
        "train_size": int(len(train_idx)),
        "test_size": int(len(test_idx)),
        "results": results,
        "winners": _choose_winners(results),
    }


def _print_leaderboard(report: dict[str, Any]) -> None:
    print("Landmark model benchmark")
    print(f"dataset size: {report['dataset']['total_approved_samples']} approved samples")
    print("")
    for split in report["splits"]:
        print(f"=== {split['split_mode']} ===")
        ranked = sorted(
            split["results"],
            key=lambda result: (
                result["metrics"]["adjusted"]["accuracy"],
                result["metrics"]["adjusted"]["macro_f1"],
            ),
            reverse=True,
        )
        for result in ranked:
            adjusted = result["metrics"]["adjusted"]
            print(
                f"{result['model_key']:24} "
                f"acc={adjusted['accuracy']:.3f} "
                f"macro_f1={adjusted['macro_f1']:.3f} "
                f"train={result['train_time_s']:.3f}s "
                f"predict={result['predict_time_s']:.3f}s"
            )
        print(f"baseline: {split['winners']['baseline']}")
        print(f"best overall: {split['winners']['best_overall']}")
        print(f"best confusion-family-safe: {split['winners']['best_confusion_family_safe']}")
        print("family comparisons:")
        for family_name, _ in CONFUSION_FAMILIES:
            family_ranked = sorted(
                split["results"],
                key=lambda result: (
                    result["metrics"]["adjusted"]["confusion_families"][family_name]["accuracy"]
                    if result["metrics"]["adjusted"]["confusion_families"][family_name]["accuracy"] is not None
                    else -1.0
                ),
                reverse=True,
            )
            best_family = family_ranked[0]
            best_accuracy = best_family["metrics"]["adjusted"]["confusion_families"][family_name]["accuracy"]
            print(
                f"  {family_name:12} best={best_family['model_key']} "
                f"acc={best_accuracy:.3f}" if best_accuracy is not None else f"  {family_name:12} no data"
            )
        print("")


def main() -> None:
    approved_records = load_approved_landmark_records()
    ok, deficits = _validate_benchmark_dataset(approved_records)
    if not ok:
        raise SystemExit(
            "Approved landmark dataset is too small for benchmarking.\n"
            + "\n".join(deficits[:12])
        )

    dataset_counts = _per_label_counts(approved_records)
    splits: list[dict[str, Any]] = []
    row_split = _run_split(approved_records, "row_stratified")
    if row_split is not None:
        splits.append(row_split)

    signer_split = _run_split(approved_records, "signer_holdout")
    if signer_split is not None:
        splits.append(signer_split)

    report = {
        "benchmark_version": 1,
        "random_seed": RANDOM_SEED,
        "dataset": {
            "total_approved_samples": len(approved_records),
            "labels": LABELS,
            "approved_counts_by_label": dataset_counts,
        },
        "splits": splits,
    }

    timestamp = time.strftime("%Y%m%d-%H%M%S")
    artifact_path = BENCHMARK_DIR / f"landmark-benchmark-{timestamp}.json"
    artifact_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    _print_leaderboard(report)
    print(f"artifact: {artifact_path}")


if __name__ == "__main__":
    main()
