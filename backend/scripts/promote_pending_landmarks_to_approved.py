import json
from pathlib import Path
from tempfile import NamedTemporaryFile

from app.core.constants import LABELS
from app.core.paths import LANDMARKS_DIR
from app.services.landmark_classifier import _normalize_landmark_record, _record_kind


def main() -> int:
    changed_files = 0
    converted_records = 0
    skipped_records = 0
    malformed_lines = 0

    for label in LABELS:
        path = LANDMARKS_DIR / f"{label}.jsonl"
        if not path.exists():
            continue

        file_changed = False
        rewritten_lines: list[str] = []

        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.rstrip("\n")
                try:
                    raw = json.loads(line)
                except Exception:
                    malformed_lines += 1
                    rewritten_lines.append(line)
                    continue

                normalized = _normalize_landmark_record(raw)
                if normalized.get("label") != label:
                    skipped_records += 1
                    rewritten_lines.append(json.dumps(raw))
                    continue

                kind = _record_kind(normalized)
                if kind == "pending":
                    raw["review_status"] = "approved"
                    raw["accepted"] = True
                    if not str(raw.get("review_notes") or "").strip():
                        raw["review_notes"] = (
                            "Promoted to approved by migration script."
                        )
                    converted_records += 1
                    file_changed = True
                    rewritten_lines.append(json.dumps(raw))
                    continue

                if kind in {"approved", "rejected", "legacy"}:
                    skipped_records += 1
                else:
                    skipped_records += 1
                rewritten_lines.append(json.dumps(raw))

        if not file_changed:
            continue

        with NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            delete=False,
        ) as tmp:
            tmp.write("\n".join(rewritten_lines))
            tmp.write("\n")
            temp_path = Path(tmp.name)

        temp_path.replace(path)
        changed_files += 1

    print(f"changed_files {changed_files}")
    print(f"converted_records {converted_records}")
    print(f"skipped_records {skipped_records}")
    print(f"malformed_lines {malformed_lines}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
