# Architecture

## System Overview

SignSight is a hybrid mobile and backend ML application.

```text
Expo React Native app
  -> VisionCamera frame stream
  -> Expo native Android module
  -> MediaPipe hand and pose landmarkers
  -> JS recognition runtime
  -> FastAPI inference/training API
  -> filesystem JSONL datasets and joblib model artifacts
  -> optional MongoDB feedback/audit storage
```

The system is intentionally split:

- Real-time landmark extraction runs on device.
- Classification and training run on the backend.
- Dataset and model operations are file-backed.
- Feedback/admin workflows are Mongo-backed.

## Main Data Flows

### Live Static Letter Prediction

```text
Camera frame
  -> native hand landmarker
  -> latest hand frame in React state
  -> POST /predict_landmarks
  -> backend landmark_feature_vector
  -> active SVM model
  -> rule override / acceptance policy
  -> mobile prediction overlay
```

Key files:

- `app/src/ml/useStreamingHandTracking.ts`
- `app/src/ml/streamingRecognition.ts`
- `backend/app/api/routes/landmarks.py`
- `backend/app/services/landmark_classifier.py`
- `backend/app/ml/landmarks.py`

### Motion Letter Prediction

```text
Static letter loop
  -> buffer recent hand frames
  -> detect motion-like base shape
  -> POST /predict_gesture
  -> gesture model predicts J or Z
  -> overwrite final label if confidence is high
```

This is why `J` and `Z` are excluded from static letter labels.

### Word Prediction

```text
Word mode frame
  -> try static word landmark prediction with labelSpace=words
  -> if no accepted static word, buffer gesture frames
  -> prefer Gesture V2 if enough upper-body frames exist
  -> fall back to legacy gesture model
  -> show word prediction
```

### Developer Lab Sample Capture

```text
Lab target selected
  -> current hand frame or recorded gesture frames
  -> upload endpoint
  -> JSONL record with review metadata
  -> dataset health endpoints reflect counts
  -> train endpoint uses approved records
```

### Landmark Model Training

```text
GET dataset summary
  -> calculate training quota readiness
  -> load approved landmark records
  -> build feature matrix
  -> train SVM
  -> write versioned .joblib and .json metadata
  -> update registry
  -> sync active aliases
```

### Feedback/Admin

```text
Mobile feedback screen
  -> POST /feedback or /feedback_multipart
  -> MongoDB feedback collection
  -> web admin dashboard
  -> resolve feedback / create audit / export CSV
```

## Component Boundaries

### Mobile Owns

- Camera permission and format selection.
- Native frame processor call frequency.
- Recognition buffering and smoothing.
- User-facing prediction display.
- Developer lab capture UX.
- Device-side feedback collection.

Mobile should not own:

- Training quotas.
- Model registry mutation.
- Final dataset readiness logic.
- Backend auth decisions.

### Backend Owns

- Input validation beyond Pydantic shape validation.
- Feature vector generation.
- Prediction thresholds and acceptance policy.
- Dataset persistence.
- Training and model artifacts.
- Model version operations.
- Feedback/audit persistence.

Backend should not own:

- Camera UI state.
- Frame processor lifecycle.
- Mobile-only smoothing UI.

### Native Module Owns

- MediaPipe initialization.
- Frame bitmap conversion.
- Hand/pose inference.
- Freshness of native tracking snapshots.
- Shape of raw tracking result returned to JS.

Native module should not own:

- Sign classification.
- Dataset upload.
- UI-specific labels.

## Data Stores

| Store | Path/system | Data |
| --- | --- | --- |
| JSONL files | `backend/landmarks` | Static letter reviewed samples. |
| JSONL files | `backend/word_landmarks` | Static word reviewed samples. |
| JSONL files | `backend/gestures` | Dynamic gesture reviewed samples. |
| Filesystem artifacts | `backend/models` | joblib models, metadata, registry. |
| MongoDB | `signsight.feedback` | Feedback documents. |
| MongoDB | `signsight.audit` | Audit documents. |
| Local storage | Browser | Admin JWT token. |

## Failure Domains

### Camera/Native

Failures appear as:

- No hand detected.
- No upper body detected.
- Low FPS.
- stale result snapshots.
- app crash in development build.

Validate with Android dev build, not only TypeScript.

### Backend Prediction

Failures appear as:

- `NO_LANDMARK_MODEL`
- `NO_GESTURE_MODEL`
- `GESTURE_V2_NOT_READY`
- low confidence / no clear sign
- shape errors in feature extraction

Validate with backend unit tests and representative payloads.

### Dataset/Training

Failures appear as:

- quota deficits
- invalid train/holdout split
- missing classes
- model registry mismatch
- active alias out of sync

Validate with health endpoint and model metadata.

### Admin/Feedback

Failures appear as:

- 404 route not registered
- Mongo connection errors
- missing text index
- expired bearer token
- upload path errors

Validate by checking route registration and Mongo availability.

## Scalability View

Current architecture is suitable for local development and early controlled usage. At larger scale, the most important changes are:

- Move training jobs out of request/response path.
- Move datasets/model artifacts to durable object storage.
- Add a database layer for sample metadata and review state.
- Version API contracts.
- Add metrics and structured logs.
- Add authentication/authorization beyond local admin defaults.
- Support model serving separately from model training.

See `SCALABILITY_AND_RELIABILITY.md` for details.

## Security View

Sensitive areas:

- Camera-derived landmarks and signer IDs.
- Uploaded screenshots.
- Admin credentials and JWT secret.
- Public CORS policy.
- File serving endpoints.
- Model artifact mutation endpoints.

See `SECURITY_AND_PRIVACY.md` before touching auth, uploads, datasets, or admin routes.

