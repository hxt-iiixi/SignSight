# Backend Service

## Stack

- FastAPI
- Uvicorn
- Pydantic
- scikit-learn
- NumPy
- joblib
- Motor / MongoDB
- python-jose for JWT admin tokens

## Entry Points

Primary application factory:

```text
backend/app/main.py
```

Uvicorn module:

```text
backend/server.py
```

Start command:

```bash
cd backend
.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## Startup Behavior

On startup the backend currently:

- Bootstraps the active landmark model.
- Bootstraps the gesture model.

It should also initialize MongoDB indexes if feedback/admin search is enabled.

## Core Paths

Paths are centralized in `backend/app/core/paths.py`.

Important directories:

- `backend/landmarks`
- `backend/word_landmarks`
- `backend/gestures`
- `backend/models`
- `backend/uploads/feedback`
- `backend/uploads/audit`

The path module creates these directories on import.

## Configuration

Configuration is read from `backend/.env` and falls back to development defaults.

Supported environment variables:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string. |
| `MONGO_DB` | Mongo database name. |
| `JWT_SECRET` | Secret used for admin JWT signing. |
| `ADMIN_USER` | Admin username. |
| `ADMIN_PASS` | Admin password. |

The current defaults are development-only and should be overridden in any shared environment.

## Landmark Classifier

Implementation:

```text
backend/app/services/landmark_classifier.py
backend/app/ml/landmarks.py
```

Responsibilities:

- Validate and save landmark samples.
- Build feature vectors from normalized landmarks.
- Train partial or reviewed landmark models.
- Maintain model metadata and registry entries.
- Activate, rename, and archive model versions.
- Apply rule-based overrides for known confusion families.
- Return accepted or unclear predictions based on confidence and margin thresholds.

Training modes:

| Mode | Intent |
| --- | --- |
| `bootstrap` | Lower quotas for early model iteration. |
| `full_reviewed` | Higher quotas for production-quality reviewed data. |

## Gesture Classifier

Implementation:

```text
backend/app/services/gesture_classifier.py
backend/app/ml/gestures.py
```

Responsibilities:

- Validate and save gesture samples.
- Train legacy gesture models from hand landmark sequences.
- Train Gesture V2 models from hand plus upper-body sequence features.
- Predict dynamic signs.
- Report gesture dataset health.

## Feedback and Audit

Implementation:

```text
backend/app/api/routes/feedback.py
backend/app/api/routes/admin.py
backend/app/services/feedback_service.py
backend/app/services/audit_service.py
backend/app/repositories/mongo.py
```

These routes are intended to support mobile feedback and the web admin dashboard.

Current integration note: feedback and admin route modules exist, but the backend application must include those routers in `backend/app/main.py` for the endpoints to be reachable.

