# Agent Playbook

## Default Working Style

When you are assigned a task:

1. Inspect the relevant files before editing.
2. Identify the runtime surface: mobile, backend, web, native module, data/model, docs.
3. Check the contract across boundaries.
4. Make the smallest useful change.
5. Run targeted validation.
6. Report what changed, how it was verified, and what risk remains.

## Do Not Accidentally Break These Contracts

The highest-risk contracts are:

- Mobile recognition payloads to backend prediction endpoints.
- Dataset JSONL schemas.
- Landmark feature vector dimensionality.
- Gesture V2 frame shape.
- Landmark model registry structure.
- Active model alias files.
- Admin bearer token behavior.
- Upload path safety.

When one of these changes, update all callers and tests.

## First Files To Read By Task Type

### Backend API Work

Read:

- `backend/app/main.py`
- `backend/app/api/routes/*.py`
- `backend/app/schemas/*.py`
- Relevant `backend/app/services/*.py`
- Relevant tests under `backend/tests/`

### Landmark ML Work

Read:

- `backend/app/ml/landmarks.py`
- `backend/app/services/landmark_classifier.py`
- `backend/app/core/constants.py`
- `app/src/ml/streamingRecognition.ts`
- `app/src/features/lab/`

### Gesture ML Work

Read:

- `backend/app/ml/gestures.py`
- `backend/app/services/gesture_classifier.py`
- `app/src/ml/streamTypes.ts`
- `app/src/ml/streamingRecognition.ts`
- `app/modules/signsight-hand-tracker/`

### Mobile Camera Work

Read:

- `app/src/modules/camera/hooks/useCameraRuntime.ts`
- `app/src/modules/camera/hooks/useRecognitionRuntime.ts`
- `app/src/ml/useStreamingHandTracking.ts`
- `app/src/ml/streamingRecognition.ts`
- `app/modules/signsight-hand-tracker/src/SignSightHandTracker.types.ts`

### Native Android Tracking Work

Read:

- `app/modules/signsight-hand-tracker/android/src/main/java/expo/modules/signsighthandtracker/SignSightHandTrackerFrameProcessorPlugin.kt`
- `app/modules/signsight-hand-tracker/android/src/main/java/expo/modules/signsighthandtracker/SignSightHandTrackerModule.kt`
- `app/modules/signsight-hand-tracker/android/build.gradle`
- `app/app.json`

### Web Admin Work

Read:

- `web-frontend/src/app/page.tsx`
- `web-frontend/src/components/AdminDashboard.tsx`
- `web-frontend/src/lib/api.ts`
- `backend/app/api/routes/admin.py`
- `backend/app/api/routes/feedback.py`

### Design/UI Work

Read:

- `agents/DESIGN.md`
- `app/src/components/lab/shared/labColors.ts`
- `app/src/config/spacing.ts`
- `app/src/config/typography.ts`
- Similar screen/component in the same surface.

## Safe Commands

Backend tests:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

Backend compile:

```bash
python3 -m compileall -q backend/app backend/scripts
```

Mobile TypeScript:

```bash
cd app
npx tsc --noEmit
```

Web TypeScript:

```bash
cd web-frontend
npx tsc --noEmit
```

Web lint:

```bash
cd web-frontend
npm run lint
```

Start backend:

```bash
cd backend
.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Start mobile:

```bash
cd app
npx expo start -c
```

Start web:

```bash
cd web-frontend
npm run dev
```

## Editing Rules For Agents

- Prefer existing patterns over new abstractions.
- Do not rewrite large screens just to make a small change.
- Do not touch model artifacts unless the task is explicitly about model artifacts.
- Do not bulk edit JSONL datasets unless explicitly asked.
- Do not delete generated tracked files unless the task is repo hygiene.
- Treat `.env`, uploads, model files, and datasets as sensitive or operational files.
- If the repo is dirty, preserve unrelated user changes.

## Common Failure Modes

### Prediction Works In Backend But Not Mobile

Check:

- `EXPO_PUBLIC_API_BASE`
- backend host binding
- mobile device LAN access
- request payload shape
- `labelSpace`
- active model coverage and confidence thresholds

### Captures Save But Training Cannot Start

Check:

- `review_status`
- `accepted`
- `signer_id`
- `capture_session_id`
- `camera_position`
- left/right hand balance
- training mode quotas

### Word Recognition Never Uses Gesture V2

Check:

- native pose landmarker asset exists
- `runPoseLandmarker` is true in word mode
- upper body frames pass `hasUsableUpperBody`
- backend has trained `asl_gesture_model_v2.joblib`

### Admin Dashboard Cannot Login

Check:

- backend includes admin router
- backend `.env` admin credentials
- `NEXT_PUBLIC_API_BASE`
- CORS
- bearer token storage

## Final Response Checklist

When reporting back:

- Name changed files.
- State validation commands and results.
- Mention any warnings or skipped checks.
- Call out risk if the change touches camera/native/model/data behavior.

