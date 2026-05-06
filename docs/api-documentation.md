# API Reference

Base URL in local development:

```text
http://127.0.0.1:8000
```

For mobile devices, use the host machine LAN IP instead of `127.0.0.1`.

## Health

### `GET /health`

Returns combined landmark and gesture health.

Response includes:

- Dataset totals.
- Per-label counts.
- Ready and unready static letters.
- Landmark model versions.
- Gesture model readiness.
- Training quota requirements.

## Models

### `GET /models`

Lists model artifacts under `backend/models`.

Response:

```json
{
  "models": [
    {
      "path": "landmark_versions/example.json",
      "type": "json",
      "info": {},
      "is_archived": false
    }
  ]
}
```

## Landmark Endpoints

### `POST /predict_landmarks`

Predict a static landmark sign.

Request:

```json
{
  "landmarks": [{ "x": 0.1, "y": 0.2, "z": 0.0 }],
  "handedness": "Right",
  "labelSpace": "letters"
}
```

`labelSpace` is optional and may be:

- `letters`
- `words`

Response:

```json
{
  "label": "A",
  "confidence": 0.91,
  "accepted_prediction": true,
  "raw_label": "A",
  "raw_confidence": 0.91,
  "margin": 0.32,
  "active_static_letters": ["A", "B"],
  "active_static_word_labels": [],
  "unknown_reason": null
}
```

### `POST /upload_landmarks`

Save a reviewed static letter sample.

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

Notes:

- Exactly 21 landmarks are required.
- `handedness` must be `Left` or `Right`.
- `signer_id`, `capture_session_id`, and `camera_position` are required.
- Motion-only letters such as `J` and `Z` should use the gesture pipeline.

### `POST /upload_static_word_landmarks`

Save a reviewed static word landmark sample.

Currently supported static word labels:

- `I_LOVE_YOU`

The payload shape matches `/upload_landmarks`.

### `POST /landmark_label_summary`

Return counts for one static landmark label.

Request:

```json
{
  "label": "A",
  "captureSessionId": "session-001",
  "signerId": "signer-001"
}
```

### `POST /train_landmarks`

Train a new landmark model version.

Request:

```json
{
  "trainingMode": "bootstrap",
  "label": "Bootstrap May 6",
  "note": "Early partial model."
}
```

`trainingMode` may be:

- `bootstrap`
- `full_reviewed`

### `POST /activate_landmark_model`

Activate an existing landmark model version.

Request:

```json
{
  "versionId": "landmarks_bootstrap_20260405T035749Z"
}
```

### `POST /rename_landmark_model`

Rename a landmark model version.

Request:

```json
{
  "versionId": "landmarks_bootstrap_20260405T035749Z",
  "label": "Improved Bootstrap Model"
}
```

### `POST /archive_landmark_model`

Archive a landmark model version.

Request:

```json
{
  "versionId": "landmarks_bootstrap_20260405T035749Z"
}
```

The active model cannot be archived.

## Gesture Endpoints

### `POST /predict_gesture`

Predict a dynamic gesture.

Request:

```json
{
  "frames": [[{ "x": 0.1, "y": 0.2, "z": 0.0 }]],
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

Response:

```json
{
  "label": "HELLO",
  "confidence": 0.88,
  "ok": true,
  "schema": "gesture_v2"
}
```

### `POST /upload_gesture`

Save a reviewed gesture sample.

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

### `POST /train_gestures`

Train the gesture model. If Gesture V2 samples exist, the backend prefers Gesture V2; otherwise it trains the legacy model.

### `POST /gesture_label_summary`

Return counts for one gesture label.

Request:

```json
{
  "label": "HELLO",
  "captureSessionId": "session-001",
  "signerId": "signer-001"
}
```

## Feedback and Admin Endpoints

These endpoints are implemented in route modules, but they must be included in `backend/app/main.py` before they are reachable.

### `POST /feedback`

Create feedback from JSON.

### `POST /feedback_multipart`

Create feedback with optional images.

### `POST /admin/login`

Return an admin JWT.

### `GET /admin/feedback`

List feedback. Requires bearer token.

### `POST /admin/feedback/{feedback_id}/resolve`

Resolve feedback and create an audit record. Requires bearer token.

### `POST /admin/audit`

Create audit record from JSON. Requires bearer token.

### `POST /admin/audit_multipart`

Create audit record with optional images. Requires bearer token.

### `GET /admin/audit`

List audit records. Requires bearer token.

### `GET /admin/export.csv`

Export feedback CSV. Requires bearer token.

## Upload Files

### `GET /uploads/{kind}/{filename}`

Serves uploaded files for:

- `feedback`
- `audit`

