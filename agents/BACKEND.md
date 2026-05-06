# Backend Agent Guide

## Stack

- FastAPI
- Pydantic
- Uvicorn
- NumPy
- scikit-learn
- joblib
- Motor/MongoDB
- python-jose
- filesystem JSONL storage

## Entry Points

```text
backend/server.py
backend/app/main.py
```

`backend/server.py` imports `app` from `app.main`.

`backend/app/main.py` creates the FastAPI app, configures CORS, includes routers, and bootstraps ML models at startup.

## Directory Map

| Path | Purpose |
| --- | --- |
| `backend/app/api/routes/` | HTTP route definitions. |
| `backend/app/schemas/` | Pydantic request models. |
| `backend/app/services/` | Business logic, ML orchestration, persistence behavior. |
| `backend/app/ml/` | Feature extraction and vectorization helpers. |
| `backend/app/repositories/` | MongoDB persistence wrappers. |
| `backend/app/core/` | Config, constants, security, path setup. |
| `backend/landmarks/` | Static letter JSONL samples. |
| `backend/word_landmarks/` | Static word JSONL samples. |
| `backend/gestures/` | Gesture JSONL samples. |
| `backend/models/` | Model artifacts, metadata, registry. |
| `backend/uploads/` | Feedback and audit uploads. |
| `backend/tests/` | Python unittest suite. |

## Route Ownership

| Route module | Owns |
| --- | --- |
| `health.py` | Combined health summary. |
| `landmarks.py` | Static landmark upload, prediction, training, model version management. |
| `gestures.py` | Gesture upload, prediction, training, summaries. |
| `models.py` | Model artifact listing. |
| `uploads.py` | Serving uploaded feedback/audit files. |
| `feedback.py` | Mobile feedback creation. |
| `admin.py` | Admin login, feedback inbox, audit records, export. |

## Service Ownership

### `landmark_classifier.py`

Owns:

- Static letter and static word upload validation.
- Landmark dataset summaries.
- Landmark training quota logic.
- SVM training.
- Model version registry.
- Prediction acceptance thresholds.
- Rule-based overrides for confusion families.

Be careful changing:

- Feature dimensions.
- Label constants.
- `_record_kind`.
- Training quota thresholds.
- Active model alias syncing.
- Archive/activate behavior.

### `gesture_classifier.py`

Owns:

- Legacy and Gesture V2 dataset loading.
- Gesture upload validation.
- Gesture model training.
- Gesture prediction.
- Gesture health summaries.

Be careful changing:

- Gesture V2 frame format.
- Resampling behavior.
- fallback between Gesture V2 and legacy.
- approved/legacy record handling.

### `feedback_service.py` and `audit_service.py`

Own:

- Feedback/audit document normalization.
- Upload handling.
- Feedback resolution audit records.
- CSV export.

Be careful changing:

- Mongo query fields.
- image URL format.
- CSV columns.
- status/resolved semantics.

## Configuration

Source:

```text
backend/app/core/config.py
```

Environment variables:

- `MONGO_URI`
- `MONGO_DB`
- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS`

Development defaults exist, but agents should not rely on them for deployed contexts.

## Model Startup

Startup currently loads:

- active landmark model from registry or alias path
- gesture legacy model if present
- gesture V2 model if present

If startup work grows, prefer FastAPI lifespan events rather than adding more `@app.on_event`.

## Validation Strategy

Use Pydantic for request shape and services for semantic validation.

Examples:

- Pydantic checks `camera_position` literal values.
- `upload_landmarks` checks exact 21 landmarks and required reviewed metadata.
- `upload_gesture` checks label validity and approved-record metadata.

Do not push all validation into frontend code. Backend must remain authoritative.

## Backend Test Commands

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
python3 -m compileall -q backend/app backend/scripts
```

## Adding Backend Tests

Prefer `unittest` unless the project explicitly adopts pytest.

Good test targets:

- Route registration.
- Pydantic schema errors.
- Feature vector shapes.
- Upload validation.
- Model registry operations with temporary dirs and mocks.
- Feedback/audit normalization with mocked repositories.

Avoid tests that:

- Write to real dataset files.
- Mutate real model registry.
- Require MongoDB unless explicitly integration tests.
- Require a trained model artifact.

## Common Backend Change Patterns

### Add A New Label

1. Update `backend/app/core/constants.py`.
2. Update mobile label lists in `app/src/ml/labels.ts` or lab screens.
3. Update dataset health expectations.
4. Update tests.
5. Verify training and prediction flows.

### Add A New Endpoint

1. Add schema in `backend/app/schemas/`.
2. Add service logic in `backend/app/services/`.
3. Add route in `backend/app/api/routes/`.
4. Include router in `backend/app/main.py` if new module.
5. Add tests.
6. Update `agents/API_CONTRACTS.md` and human docs if public.

### Change Dataset Record Shape

1. Add backward-compatible normalization.
2. Update upload services.
3. Update health summaries.
4. Update mobile payloads.
5. Add tests for old and new records.
6. Avoid one-way migration unless explicitly requested.

