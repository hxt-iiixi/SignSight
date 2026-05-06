# Project Context

## One-Sentence Description

SignSight is a mobile-first ASL recognition platform that combines real-time camera tracking, backend ML inference, reviewed dataset capture, and iterative model management.

## Product Scope

SignSight currently supports:

- Static letter recognition from hand landmarks.
- Motion letter recognition for letters such as `J` and `Z`.
- Selected word/gesture recognition.
- In-app dataset capture and review-oriented metadata.
- Backend model training and model version activation.
- Mobile feedback submission.
- Web admin feedback and audit workflows.

Do not describe the product as:

- Full sentence-level sign language translation.
- A general ASL interpreter for all contexts.
- A production-scale multimodal model.

The accurate positioning is: camera-based sign recognition plus an internal model improvement workflow.

## Runtime Surfaces

### Mobile App

Path: `app/`

The mobile app is the primary user-facing product. It contains:

- Translator camera experience.
- Developer lab.
- Feedback screen.
- Tutorial/settings/dashboard screens.
- Local biometric unlock flow.

### Native Tracker

Path: `app/modules/signsight-hand-tracker/`

This is an Expo native module. The Android implementation registers a VisionCamera frame processor plugin that runs MediaPipe hand and pose landmarkers.

### Backend

Path: `backend/`

The backend is a FastAPI service. It owns:

- Prediction endpoints.
- Dataset upload endpoints.
- Model training endpoints.
- Dataset health summaries.
- Model version registry.
- Feedback and audit storage.
- Upload file serving.

### Web Frontend

Path: `web-frontend/`

The web frontend contains:

- Next.js admin dashboard.
- Login/token storage.
- Feedback inbox.
- Audit trail.
- CSV export.
- Public landing/download pages.

## Domain Vocabulary

| Term | Meaning |
| --- | --- |
| Landmark | A MediaPipe hand point with `x`, `y`, and `z`. Static signs use 21 hand landmarks. |
| Upper body | A selected subset of MediaPipe pose landmarks such as shoulders, elbows, wrists, hips, ears, and nose. |
| Static letter | A letter recognized from a single hand shape. |
| Motion-only letter | A letter requiring motion, currently `J` and `Z`. |
| Static word | A word-like sign recognized from one stable hand shape, currently `I_LOVE_YOU`. |
| Gesture | A dynamic sign recognized from a sequence of frames. |
| Gesture V2 | Gesture representation using hand landmarks plus upper-body pose features. |
| Reviewed dataset | Samples with signer/session/camera metadata and an explicit review status. |
| Bootstrap training | Lower-quota training mode for early iteration. |
| Full reviewed training | Higher-quota training mode intended for broader model confidence. |
| Active model | The landmark model version used by prediction endpoints. |
| Model registry | JSON file tracking active, available, and archived landmark model versions. |

## Label Sets

Static letters exclude motion-only letters:

```text
A B C D E F G H I K L M N O P Q R S T U V W X Y
```

Motion-only letters:

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

## User Types

| User | Needs |
| --- | --- |
| Learner/user | Clear camera feedback, stable recognition, simple tutorials, feedback path. |
| Dataset collector | Fast capture controls, signer/session metadata, hand balance visibility. |
| Model operator | Dataset health, training controls, version activation, readable failures. |
| Admin | Feedback inbox, audit trail, export, secure access. |
| Engineer/agent | Clear contracts, safe test commands, architecture map, known risks. |

## Current Verification Baseline

Useful commands:

```bash
python3 -m compileall -q backend/app backend/scripts
backend/.venv/bin/python -m unittest discover -s backend/tests -v
cd app && npx tsc --noEmit
cd web-frontend && npx tsc --noEmit
cd web-frontend && npm run lint
```

Current known state from recent scans:

- Backend Python compile passes.
- Backend unittest suite exists and passes.
- Mobile TypeScript passes.
- Web TypeScript passes.
- Web lint has known issues. See `KNOWN_RISKS.md`.

