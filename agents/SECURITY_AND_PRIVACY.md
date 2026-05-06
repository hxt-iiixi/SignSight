# Security And Privacy Guide

## Security Posture

SignSight is currently development-oriented. Agents should treat security-sensitive areas carefully before moving anything toward shared or production environments.

## Sensitive Data

Treat the following as sensitive:

- Camera-derived hand landmarks.
- Upper-body pose landmarks.
- signer IDs.
- capture session IDs.
- device IDs.
- screenshots uploaded with feedback.
- model artifacts derived from user samples.
- admin credentials.
- JWT secret.

Landmarks are not raw video, but they are biometric-like behavioral data and should be handled with privacy care.

## Authentication

Admin auth uses:

- username/password from backend settings
- JWT bearer token
- browser local storage token

Source files:

- `backend/app/core/security.py`
- `backend/app/core/config.py`
- `web-frontend/src/lib/api.ts`
- `web-frontend/src/app/page.tsx`

Current development defaults exist. Do not treat them as production-safe.

## Secrets

Backend settings:

- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS`
- `MONGO_URI`
- `MONGO_DB`

Agent rules:

- Do not hardcode new secrets.
- Do not print secrets.
- Do not add real secrets to docs.
- Prefer `.env.example` for examples.
- For production-like behavior, fail closed when defaults are detected.

## CORS

Backend currently allows broad CORS by default.

Risks:

- Browser clients from any origin can call public endpoints.
- Admin endpoints still require bearer token, but broad CORS increases exposure.

Recommended production direction:

- Parse allowed origins from environment.
- Use explicit origins for web admin and local mobile dev.
- Avoid `allow_origins=["*"]` with credentials in deployed environments.

## Uploads

Upload handling:

- accepts image content types
- limits extension to common image types
- uses basename-safe path joins
- stores under `backend/uploads/feedback` and `backend/uploads/audit`

Risks:

- no explicit file size limit
- no image re-encoding or scanning
- uploaded files served directly

Agent rules:

- Preserve basename/path traversal protection.
- Add size limits before increasing upload usage.
- Avoid serving arbitrary file paths.
- Avoid trusting client-provided content type alone.

## Dataset And Model Mutation Endpoints

Training and upload endpoints mutate filesystem state.

Risks:

- unauthenticated sample upload
- unauthenticated training/model activation
- accidental model artifact churn
- dataset poisoning

Recommended direction:

- Add authentication/authorization for lab/model operations in non-local environments.
- Separate public prediction from internal training/admin mutation.
- Track audit events for model activation, archive, and training.

## MongoDB

MongoDB stores feedback and audit records.

Agent rules:

- Do not expose raw ObjectIds unnecessarily.
- Do not place secrets in feedback/audit records.
- Ensure indexes are initialized when using text search.
- Keep export endpoints protected.

## Privacy Improvements To Consider

- Use pseudonymous signer IDs.
- Separate user identity from sample records.
- Add retention policy for uploads and datasets.
- Add dataset deletion workflow by signer/session.
- Add consent metadata to reviewed samples.
- Add role-based access for lab/model operations.
- Avoid shipping dataset artifacts in mobile builds.

## Security Checklist For Changes

If changing auth, uploads, datasets, or admin:

- Does the endpoint require auth if it mutates state?
- Is input validated at backend service layer?
- Are file paths sanitized?
- Are secrets kept out of source and logs?
- Are error messages safe?
- Are CORS assumptions explicit?
- Are tests covering rejection paths?

