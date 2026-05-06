# System Architecture

## High-Level Design

SignSight combines local camera tracking with backend ML inference.

```text
Mobile camera
  -> VisionCamera frame processor
  -> Native MediaPipe hand and pose tracking
  -> React Native recognition runtime
  -> FastAPI prediction endpoints
  -> Mobile UI prediction overlay
```

Dataset improvement follows a second path:

```text
Developer lab capture
  -> reviewed JSONL samples
  -> backend training endpoint
  -> joblib model artifact
  -> model metadata and registry
  -> activated model version
```

## Main Components

### Mobile App

Path: `app/`

Responsible for:

- Authentication splash and local biometric unlock.
- Main navigation.
- Camera translator experience.
- Developer lab capture and model management.
- Tutorials, settings, and feedback submission.

### Native Hand Tracker

Path: `app/modules/signsight-hand-tracker/`

Responsible for:

- Registering a VisionCamera frame processor plugin.
- Running MediaPipe hand landmarking.
- Running MediaPipe pose landmarking when word mode needs upper-body context.
- Returning normalized landmark payloads to JavaScript.

### Backend API

Path: `backend/`

Responsible for:

- Landmark prediction.
- Gesture prediction.
- Landmark and gesture sample upload.
- Landmark and gesture model training.
- Dataset health summaries.
- Landmark model version activation, rename, and archive.
- Feedback, audit, and upload storage.

### Web Frontend

Path: `web-frontend/`

Responsible for:

- Admin login.
- Feedback inbox.
- Audit trail.
- Feedback CSV export.
- Public landing and download pages.

## Model Families

### Landmark Model

The landmark model classifies single-frame static signs. It uses engineered features derived from 21 MediaPipe hand landmarks.

Artifacts:

- `backend/models/asl_landmarks_model.joblib`
- `backend/models/asl_landmarks_model_meta.json`
- `backend/models/landmark_model_registry.json`
- `backend/models/landmark_versions/*.joblib`
- `backend/models/landmark_versions/*.json`
- `backend/models/archived_models/*`

### Gesture Model

The gesture model classifies motion sequences. Legacy gestures use hand landmark frames. Gesture V2 can use hand landmarks plus upper-body pose features.

Artifacts:

- `backend/models/asl_gesture_model.joblib`
- `backend/models/asl_gesture_model_v2.joblib`

## Data Stores

### Filesystem JSONL Datasets

Landmark and gesture samples are stored as JSONL files:

- `backend/landmarks/*.jsonl`
- `backend/word_landmarks/*.jsonl`
- `backend/gestures/*.jsonl`

### MongoDB

MongoDB is used for:

- Feedback records.
- Audit records.

The repository defines indexes in `backend/app/repositories/mongo.py`, but index creation should be wired into backend startup before depending on text search in production.

