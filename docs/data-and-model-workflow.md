# Data and Model Workflow

## Dataset Files

SignSight stores ML training samples in JSONL files under `backend/`.

| Dataset | Path | Purpose |
| --- | --- | --- |
| Static letters | `backend/landmarks/*.jsonl` | One hand-landmark frame per static letter sample. |
| Static words | `backend/word_landmarks/*.jsonl` | One hand-landmark frame per static word sample. |
| Gestures | `backend/gestures/*.jsonl` | Motion sequences for dynamic signs. |

Each line is one JSON record.

## Review Status

Records can be categorized as:

- `approved`
- `pending`
- `rejected`
- `legacy`

The backend treats approved records as trainable when they also satisfy required metadata.

Required landmark metadata includes:

- `label`
- `handedness`
- `landmarks`
- `signer_id`
- `capture_session_id`
- `camera_position`
- `accepted`
- `review_status`
- `captured_at`

## Static Landmark Training

The landmark training pipeline:

1. Read approved records.
2. Check per-label quota readiness.
3. Build engineered feature vectors.
4. Train an SVM classifier.
5. Evaluate a holdout split.
6. Write versioned model and metadata files.
7. Update the model registry.
8. Activate the new model version.

Training endpoint:

```text
POST /train_landmarks
```

## Landmark Training Modes

| Mode | Samples per label | Samples per hand | Signers per label | Intent |
| --- | ---: | ---: | ---: | --- |
| `bootstrap` | 40 | 20 | 1 | Early iteration and partial models. |
| `full_reviewed` | 480 | 240 | 8 | Higher-confidence reviewed model training. |

The backend also requires a minimum number of ready static letters before training a partial landmark model.

## Landmark Model Versions

Version artifacts live in:

```text
backend/models/landmark_versions/
```

Archived artifacts live in:

```text
backend/models/archived_models/
```

The active model is mirrored to:

```text
backend/models/asl_landmarks_model.joblib
backend/models/asl_landmarks_model_meta.json
```

The registry file is:

```text
backend/models/landmark_model_registry.json
```

Supported version operations:

- Activate model version.
- Rename model version.
- Archive inactive model version.

## Gesture Training

The gesture training pipeline:

1. Prefer Gesture V2 samples when available.
2. Fall back to legacy hand-landmark sequences when no Gesture V2 data exists.
3. Resample each gesture to a fixed number of frames.
4. Build vectors from hand landmarks and, for V2, upper-body landmarks.
5. Train an SVM classifier.
6. Save the model artifact.

Training endpoint:

```text
POST /train_gestures
```

Gesture model artifacts:

```text
backend/models/asl_gesture_model.joblib
backend/models/asl_gesture_model_v2.joblib
```

## Current Label Sets

Static letters exclude motion-only labels:

```text
A B C D E F G H I K L M N O P Q R S T U V W X Y
```

Motion-only letter labels:

```text
J Z
```

Gesture labels:

```text
HELLO THANK_YOU SORRY PLEASE YES NO HELP GOODBYE WHAT WHERE J Z
```

Static word labels:

```text
I_LOVE_YOU
```

## Dataset Health

Dataset health is available from:

```text
GET /health
```

The response includes:

- Per-label approved, pending, rejected, and legacy counts.
- Left/right hand balance.
- Signer counts.
- Gesture V2 sequence counts.
- Static letter readiness by training mode.
- Deficits by label.
- Active landmark model metadata.

