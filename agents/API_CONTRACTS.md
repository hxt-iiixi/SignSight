# API Contracts

This document captures the contracts most likely to matter to AI agents. The backend schemas are the source of truth.

Source files:

- `backend/app/schemas/ml.py`
- `backend/app/schemas/admin.py`
- `backend/app/schemas/feedback.py`
- `backend/app/api/routes/*.py`

## Base URLs

Local backend:

```text
http://127.0.0.1:8000
```

Mobile device backend:

```text
http://<host-lan-ip>:8000
```

## Landmark Point

```json
{
  "x": 0.1,
  "y": 0.2,
  "z": 0.0
}
```

Static landmark endpoints expect exactly 21 points at service validation time.

## Upper Body Point

```json
{
  "x": 0.4,
  "y": 0.3,
  "z": 0.0,
  "visibility": 0.9
}
```

Supported upper-body keys:

- `nose`
- `leftEar`
- `rightEar`
- `leftShoulder`
- `rightShoulder`
- `leftElbow`
- `rightElbow`
- `leftWrist`
- `rightWrist`
- `leftHip`
- `rightHip`

## Landmark Prediction

Endpoint:

```text
POST /predict_landmarks
```

Request:

```json
{
  "landmarks": [],
  "handedness": "Right",
  "labelSpace": "letters"
}
```

`labelSpace` is optional:

- `letters`
- `words`

Response fields used by mobile:

- `label`
- `confidence`
- `accepted_prediction`
- `raw_label`
- `raw_confidence`
- `margin`
- `active_static_letters`
- `active_static_word_labels`
- `unknown_reason`

Agent warning:

If you rename any of these fields, update mobile recognition runtime and tests.

## Landmark Upload

Endpoint:

```text
POST /upload_landmarks
```

Request:

```json
{
  "label": "A",
  "landmarks": [],
  "handedness": "Right",
  "signer_id": "signer-001",
  "capture_session_id": "session-001",
  "device_id": "device-001",
  "camera_position": "back",
  "accepted": true,
  "review_status": "approved",
  "review_notes": "Approved from developer lab capture.",
  "variant_tags": [],
  "captured_at": "2026-05-06T12:00:00.000Z"
}
```

Semantic requirements:

- `label` must be a static letter label.
- `J` and `Z` are rejected because they are motion-only.
- `handedness` must normalize to `Left` or `Right`.
- `landmarks` must contain 21 points.
- `signer_id` is required.
- `capture_session_id` is required.
- `camera_position` must be `front` or `back`.
- approved records must set `accepted=true`.

## Static Word Upload

Endpoint:

```text
POST /upload_static_word_landmarks
```

Payload is the same as landmark upload.

Current valid static word label:

```text
I_LOVE_YOU
```

## Gesture Prediction

Endpoint:

```text
POST /predict_gesture
```

Request:

```json
{
  "frames": [[]],
  "handedness": "Right",
  "framesV2": [
    {
      "handLandmarks": [],
      "handedness": "Right",
      "upperBody": {},
      "timestampMs": 12345
    }
  ]
}
```

Backend behavior:

- If `framesV2` exists, backend tries Gesture V2 model.
- If no Gesture V2 model exists, response can be `GESTURE_V2_NOT_READY`.
- Mobile falls back to legacy gesture prediction when V2 is not ready.

Response:

```json
{
  "label": "HELLO",
  "confidence": 0.88,
  "ok": true,
  "schema": "gesture_v2"
}
```

## Gesture Upload

Endpoint:

```text
POST /upload_gesture
```

Request:

```json
{
  "label": "HELLO",
  "frames": [],
  "handedness": "Right",
  "framesV2": [],
  "signer_id": "signer-001",
  "capture_session_id": "session-001",
  "device_id": "device-001",
  "camera_position": "back",
  "accepted": true,
  "review_status": "approved",
  "review_notes": "Approved Gesture V2 capture from developer lab.",
  "variant_tags": [],
  "captured_at": "2026-05-06T12:00:00.000Z"
}
```

Semantic requirements:

- `label` must be in gesture label set.
- approved records require `signer_id`.
- approved records require `capture_session_id`.
- approved records require `camera_position`.

## Training

Landmark training:

```text
POST /train_landmarks
```

```json
{
  "trainingMode": "bootstrap",
  "label": "Bootstrap May 6",
  "note": "Early partial model."
}
```

Gesture training:

```text
POST /train_gestures
```

No request body.

## Model Version Operations

Activate:

```text
POST /activate_landmark_model
```

Rename:

```text
POST /rename_landmark_model
```

Archive:

```text
POST /archive_landmark_model
```

Do not archive the active model. Backend rejects it.

## Health And Summaries

Health:

```text
GET /health
```

Label summary:

```text
POST /landmark_label_summary
POST /gesture_label_summary
```

These are used heavily by the developer lab.

## Feedback/Admin

Feedback:

```text
POST /feedback
POST /feedback_multipart
```

Admin:

```text
POST /admin/login
GET /admin/feedback
POST /admin/feedback/{feedback_id}/resolve
POST /admin/audit
POST /admin/audit_multipart
GET /admin/audit
GET /admin/export.csv
```

Admin endpoints require:

```text
Authorization: Bearer <token>
```

except `/admin/login`.

