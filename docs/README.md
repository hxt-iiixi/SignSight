# SignSight Documentation

SignSight is a mobile-first sign recognition platform for real-time camera-based ASL recognition, dataset capture, and iterative model improvement.

This documentation describes the current project architecture, local development workflow, API surface, mobile runtime, backend model pipeline, and operational risks.

## Documentation Map

- [Project Overview](./project-overview.md)
- [Local Setup and Development](./local-development.md)
- [System Architecture](./architecture.md)
- [Backend Service](./backend.md)
- [API Reference](./api-reference.md)
- [Mobile App](./mobile-app.md)
- [Data and Model Workflow](./data-and-model-workflow.md)
- [Web Admin and Landing Site](./web-admin.md)
- [Operations and Maintenance](./operations.md)
- [Known Issues and Technical Debt](./known-issues.md)

## Runtime Surfaces

SignSight currently contains three main surfaces:

| Surface | Path | Purpose |
| --- | --- | --- |
| Mobile app | `app/` | Expo and React Native app for translation, feedback, tutorials, settings, and the developer lab. |
| Backend API | `backend/` | FastAPI service for prediction, training, dataset summaries, model versions, feedback, audit, and uploads. |
| Web frontend | `web-frontend/` | Next.js admin dashboard and public landing/download pages. |

## Quick Start

From the repository root:

```bash
make dev
```

Manual startup:

```bash
cd backend
.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

```bash
cd app
npx expo start -c
```

```bash
cd web-frontend
npm run dev
```

## Current Verification Snapshot

The following commands were run during the documentation pass:

```bash
python3 -m compileall -q backend/app backend/scripts
cd app && npx tsc --noEmit
cd web-frontend && npx tsc --noEmit
cd web-frontend && npm run lint
```

Results:

- Backend Python compile check passed.
- Mobile TypeScript check passed.
- Web TypeScript check passed.
- Web lint currently fails. See [Known Issues and Technical Debt](./known-issues.md).

