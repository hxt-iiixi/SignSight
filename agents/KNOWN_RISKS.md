# Known Risks And Technical Debt

This file helps agents avoid rediscovering known issues.

## Web Lint Is Currently Not Clean

Known `npm run lint` issues in `web-frontend` include:

- unescaped quotes in `LandingPage.tsx`
- synchronous state set inside an effect in `page.tsx`
- `any` usage in `src/lib/api.ts`
- warnings for raw `img` usage
- some unused variables

Do not assume web lint failure is caused by your change unless you compare before/after.

## FastAPI Startup Uses Deprecated `on_event`

Tests currently show deprecation warnings for:

```text
@app.on_event("startup")
```

Future cleanup should migrate to FastAPI lifespan handlers.

## `datetime.utcnow()` Warning

Python emits deprecation warnings for `datetime.utcnow()` in feedback/audit related services.

Future cleanup should use timezone-aware UTC datetimes.

## Development Secrets Exist In Source

Development defaults include:

- admin username/password
- JWT fallback secret

These are acceptable for local defaults only. Do not expand this pattern.

## Broad CORS Default

Backend CORS defaults are broad. This is convenient for local development but not production-safe.

## JSONL Datasets Are Operational State

Dataset files are source-controlled/operational artifacts. Agents should avoid casual edits.

Risks:

- breaking training quotas
- corrupting JSONL lines
- changing review status semantics
- losing legacy compatibility

## Model Artifacts Are Operational State

`backend/models` includes trained models and metadata.

Risks:

- active registry mismatch
- stale aliases
- archived model inconsistency
- unreviewed model activation

Do not mutate model artifacts unless directly asked.

## Generated Build Artifacts Have Existed In Repo History

The repo has had generated Android build artifacts under the native module path.

If doing cleanup:

- remove from git index carefully
- preserve source files
- keep ignore rules aligned

## Mobile Native Tracker Requires Dev Build

Do not test native tracker assumptions in Expo Go. Use development build.

## Backend Unit Tests Avoid External Services

Current backend tests are designed not to require MongoDB or real trained models. Preserve that property for unit tests.

## Agent Risk Summary

Highest-risk changes:

- landmark feature vector dimensions
- gesture V2 frame shape
- model registry operations
- dataset normalization
- native tracker output shape
- recognition thresholds
- admin/auth/upload security

For these changes, update docs and tests in the same task.

