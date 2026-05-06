# Data And ML Agent Guide

## ML Role In The Product

SignSight uses classic ML classifiers over MediaPipe landmark features. It is not currently an end-to-end neural sign language model.

The backend turns landmarks into fixed-width vectors and trains SVM classifiers.

## Data Locations

| Path | Data |
| --- | --- |
| `backend/landmarks/*.jsonl` | Static letter samples. |
| `backend/word_landmarks/*.jsonl` | Static word samples. |
| `backend/gestures/*.jsonl` | Dynamic gesture samples. |
| `backend/models/*.joblib` | Active model artifacts. |
| `backend/models/*.json` | Metadata and registry. |
| `backend/models/landmark_versions/` | Versioned landmark models. |
| `backend/models/archived_models/` | Archived landmark model versions. |

## JSONL Record Expectations

Each JSONL line is one sample record.

Landmark records should include:

- `label`
- `handedness`
- `landmarks`
- `signer_id`
- `capture_session_id`
- `device_id`
- `camera_position`
- `accepted`
- `review_status`
- `review_notes`
- `variant_tags`
- `captured_at`

Gesture records include:

- `label`
- `handedness`
- `frames`
- `framesV2`
- same review/session metadata as landmark records

## Review States

The backend categorizes records as:

- `approved`
- `pending`
- `rejected`
- `legacy`

Approved records are trainable only when required metadata exists and the sample is accepted.

Legacy records are older records missing reviewed dataset fields. Be careful not to break legacy loading unless migration is explicitly requested.

## Landmark Feature Vector

Source:

```text
backend/app/ml/landmarks.py
```

Feature vector currently combines:

- normalized 21x3 landmark coordinates
- finger extension scores
- extended flags
- curl scores
- adjacent fingertip distances
- thumb-to-tip distances
- tip-to-wrist distances
- MCP spread
- joint angle features
- palm orientation
- thumb crossing
- index direction
- motion letter hints

Current expected vector width in tests:

```text
115
```

If this changes:

- update tests
- retrain models
- check compatibility with existing `.joblib` artifacts
- document migration path

## Gesture Feature Vector

Source:

```text
backend/app/ml/gestures.py
```

Legacy gesture vector:

```text
GESTURE_FRAMES * 63
```

Gesture V2 vector:

```text
GESTURE_FRAMES * (63 + upper_body_key_count * 4)
```

Current upper body keys:

```text
nose leftEar rightEar leftShoulder rightShoulder leftElbow rightElbow leftWrist rightWrist leftHip rightHip
```

## Training Modes

Landmark training modes:

| Mode | Min approved samples per label | Min per hand | Min signers | Use |
| --- | ---: | ---: | ---: | --- |
| `bootstrap` | 40 | 20 | 1 | Early partial model iteration. |
| `full_reviewed` | 480 | 240 | 8 | More reliable reviewed model. |

Agents should not lower these quotas just to make a training request pass unless the task is explicitly about training policy.

## Model Registry

Landmark model registry:

```text
backend/models/landmark_model_registry.json
```

Expected concepts:

- `active_version_id`
- `versions`
- `archived_versions`

Model version metadata tracks:

- version id
- label
- note
- training mode
- accuracy
- active static letters
- active static word labels
- ready/unready labels
- deficits
- sample counts
- quotas used
- trained timestamp

## Active Model Aliases

The active landmark model is mirrored to:

```text
backend/models/asl_landmarks_model.joblib
backend/models/asl_landmarks_model_meta.json
```

Do not manually edit these unless the task is about model operations.

## Rule-Based Overrides

`landmark_classifier.py` includes rule-based corrections for known confusion families such as:

- `I` / `Y`
- `U` / `V` / `W`
- `R` / `U`
- `C` / `O` / `F`
- `A` / `S`
- `E` / `S` / `T`
- `M` / `N` / `T` / `S`

These rules are part of production behavior. Changing them affects prediction labels and confidence.

## Dataset Agent Rules

- Do not load all JSONL data into responses.
- Do not commit personal or sensitive sample data unless expected by project policy.
- Do not rewrite dataset files without backups.
- Preserve legacy compatibility when changing parsers.
- Prefer scripts for migrations.
- Add tests for normalizers when changing record shape.

## Training Agent Rules

- Treat training as mutating operational state.
- Do not train models unless asked.
- Do not archive models unless asked.
- Do not activate models unless asked.
- If training fails, report quota deficits rather than bypassing them.

