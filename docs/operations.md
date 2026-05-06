# Operations and Maintenance

## Service Startup Order

Recommended local startup order:

1. Start MongoDB.
2. Start FastAPI backend.
3. Start Expo mobile app.
4. Start Next.js web frontend.

MongoDB is only required for feedback, audit, and admin workflows. Core ML inference and filesystem dataset workflows can run without MongoDB if those routes are not used.

## Health Checks

Use:

```bash
curl http://127.0.0.1:8000/health
```

The response should include:

- `ok: true`
- Landmark model state.
- Gesture model state.
- Dataset counts.
- Model readiness details.

## Model Artifact Management

Landmark models are versioned. The active version is recorded in:

```text
backend/models/landmark_model_registry.json
```

The active model is also copied to stable alias paths:

```text
backend/models/asl_landmarks_model.joblib
backend/models/asl_landmarks_model_meta.json
```

Do not manually delete active model files while the backend is running.

## Dataset Backups

Back up the following directories before large training or promotion workflows:

```text
backend/landmarks/
backend/word_landmarks/
backend/gestures/
backend/models/
backend/uploads/
```

If MongoDB is used, also back up the `feedback` and `audit` collections.

## Environment and Secrets

Local defaults are intended for development only. For shared, staging, or production environments:

- Set a strong `JWT_SECRET`.
- Change `ADMIN_USER` and `ADMIN_PASS`.
- Restrict CORS origins.
- Avoid exposing the backend directly without authentication for admin routes.
- Confirm upload storage permissions.

## Logs

The backend currently prints model bootstrapping and training output to process logs. Training commands can emit classification reports.

For production-like operation, consider replacing print statements with structured logging.

## Repository Hygiene

Generated artifacts should not be committed:

- Python `__pycache__`
- virtual environments
- Expo caches
- Next.js `.next`
- Android `build`
- Gradle caches

Some generated Android module build artifacts are currently tracked under:

```text
app/modules/signsight-hand-tracker/android/build/
```

They should be removed from version control in a dedicated cleanup change.

## Verification Before Merge

Run at minimum:

```bash
python3 -m compileall -q backend/app backend/scripts
cd app && npx tsc --noEmit
cd web-frontend && npx tsc --noEmit
cd web-frontend && npm run lint
```

For native tracker changes, also validate with an Android development build:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

