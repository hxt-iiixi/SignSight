# Testing And Validation

## Current Test Surface

Backend tests exist under:

```text
backend/tests/
```

They use Python's built-in `unittest` runner so they work without adding pytest.

Run:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The suite covers:

- FastAPI route registration.
- CORS middleware registration.
- Pydantic schema validation.
- Landmark feature vector shape.
- Gesture vectorization.
- Upload path safety.
- Feedback service normalization.
- Basic classifier input validation.

## Compile And Type Checks

Backend:

```bash
python3 -m compileall -q backend/app backend/scripts
```

Mobile:

```bash
cd app
npx tsc --noEmit
```

Web:

```bash
cd web-frontend
npx tsc --noEmit
npm run lint
```

## When To Run What

| Change type | Minimum validation |
| --- | --- |
| Backend route/schema/service | backend unittest + compileall |
| Landmark feature/model code | backend unittest + compileall + manual prediction if possible |
| Gesture feature/model code | backend unittest + compileall + manual word mode if possible |
| Mobile TypeScript UI/runtime | app TypeScript |
| Mobile camera/native | app TypeScript + Android dev build/manual camera check |
| Web admin/landing | web TypeScript + lint |
| Docs only | no test required, but check links/paths if feasible |

## Manual Backend Checks

Start backend:

```bash
cd backend
.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Health:

```bash
curl http://127.0.0.1:8000/health
```

Models:

```bash
curl http://127.0.0.1:8000/models
```

## Manual Mobile Checks

Use a development build for native tracker testing:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

Check:

- app starts
- camera permission flow works
- hand tracking produces overlay/debug state
- letter mode calls backend
- word mode records frames
- lab capture save path works
- no obvious frame-rate collapse

## Manual Web Checks

Start:

```bash
cd web-frontend
npm run dev
```

Check:

- login form renders
- admin login reaches backend
- feedback tab loads
- audit tab loads
- image previews work
- CSV export does not expose token in URL

## Test Gaps

Important missing areas:

- No frontend component tests.
- No native module automated tests.
- No integration tests requiring live FastAPI app.
- No MongoDB-backed repository integration tests.
- No model registry mutation tests with temporary model files.
- No camera frame simulation tests.
- No performance tests.

## Recommended Next Tests

Backend:

- model registry activate/rename/archive with temporary directories
- health summary from synthetic JSONL fixtures
- upload service file size/type behavior
- admin auth rejection and valid token flow
- Mongo index startup with mocked collections

Mobile:

- smoother behavior
- streaming recognition state reset
- process frame logic with mocked fetch
- lab capture payload construction

Web:

- API helper header behavior
- admin dashboard optimistic resolve behavior
- login token state initialization

## Agent Testing Rules

- Do not skip tests silently.
- If a command cannot run, say why.
- Prefer targeted tests first, broader checks before final response.
- Clean generated `__pycache__` under newly added test folders if needed.
- Do not require external services for unit tests unless the test is clearly marked integration.

