# Known Issues and Technical Debt

This page documents issues observed during the project scan and documentation pass.

## Backend Feedback and Admin Routes Are Not Registered

Feedback and admin route modules exist, but `backend/app/main.py` currently includes only:

- uploads
- landmarks
- gestures
- health
- models

As a result, the following implemented routes are likely unreachable until the routers are included:

- `POST /feedback`
- `POST /feedback_multipart`
- `POST /admin/login`
- `GET /admin/feedback`
- `POST /admin/feedback/{feedback_id}/resolve`
- `POST /admin/audit`
- `POST /admin/audit_multipart`
- `GET /admin/audit`
- `GET /admin/export.csv`

Recommended fix:

- Import `admin` and `feedback` route modules in `backend/app/main.py`.
- Add `app.include_router(admin.router)` and `app.include_router(feedback.router)`.

## MongoDB Indexes Are Defined But Not Initialized

`backend/app/repositories/mongo.py` defines `ensure_indexes()`, but startup does not currently call it.

Impact:

- Text search in feedback/admin routes may fail or underperform.
- Indexes may be missing in new MongoDB deployments.

Recommended fix:

- Call `await ensure_indexes()` during FastAPI startup.

## Development Credentials Are Present In Source

Development defaults exist in:

- `backend/app/core/config.py`
- `init.sh`
- `web-frontend/src/app/page.tsx`

Examples:

- `JWT_SECRET=change_me`
- `ADMIN_USER=admin`
- `ADMIN_PASS=admin123`

Recommended fix:

- Keep safe local examples in `.env.example`.
- Avoid pre-filling admin passwords in UI.
- Fail startup in production-like environments when secrets are default.

## Web Lint Fails

Command:

```bash
cd web-frontend
npm run lint
```

Current errors:

- Unescaped quotes in `web-frontend/src/app/LandingPage.tsx`.
- Synchronous `setState` inside an effect in `web-frontend/src/app/page.tsx`.
- `any` usage in `web-frontend/src/lib/api.ts`.

There are also warnings for raw `<img>` usage and unused variables.

## No Automated Test Suite Found

No meaningful test files were found during the scan.

Recommended coverage priorities:

1. Backend schema and route tests.
2. Landmark feature vector and prediction policy tests.
3. Gesture vectorization tests.
4. Model registry operation tests.
5. Mobile recognition runtime unit tests where practical.

## Generated Build Artifacts Are Tracked

The repository tracks generated Android module build artifacts under:

```text
app/modules/signsight-hand-tracker/android/build/
```

Recommended fix:

- Remove generated artifacts from git with `git rm --cached`.
- Ensure ignore rules cover module-level Android build output.

## Broad CORS Default

The backend allows all origins by default.

Recommended fix:

- Make CORS origins configurable through environment variables.
- Use explicit origins for shared or deployed environments.

## Silent Exception Handling

Several backend paths catch broad exceptions and ignore them.

Impact:

- Dataset parsing problems can be hidden.
- Upload failures can be difficult to diagnose.
- Model metadata issues may be masked.

Recommended fix:

- Replace silent catches with structured logs where appropriate.
- Include safe error details in admin/developer-facing workflows.

