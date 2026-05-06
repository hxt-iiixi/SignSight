# Web Frontend Agent Guide

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9

## Entry Points

```text
web-frontend/src/app/page.tsx
web-frontend/src/app/LandingPage.tsx
web-frontend/src/app/download/page.tsx
web-frontend/src/components/AdminDashboard.tsx
web-frontend/src/lib/api.ts
```

## Environment

The web app reads:

```text
NEXT_PUBLIC_API_BASE
```

Example:

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

## Admin Auth Flow

```text
Login form
  -> POST /admin/login
  -> store token in localStorage as admin_token
  -> attach Authorization: Bearer <token>
  -> admin API calls
```

Token helpers live in:

```text
web-frontend/src/lib/api.ts
```

## Admin Dashboard Responsibilities

`AdminDashboard.tsx` owns:

- feedback/audit tabs
- search/filter state
- feedback list refresh
- optimistic feedback resolve with undo window
- audit record creation
- image preview modal
- CSV export
- toast notifications

Because it is a large file, make focused edits and avoid broad rewrites.

## Backend Route Dependencies

The admin frontend depends on:

- `POST /admin/login`
- `GET /admin/feedback`
- `POST /admin/feedback/{feedback_id}/resolve`
- `GET /admin/audit`
- `POST /admin/audit`
- `POST /admin/audit_multipart`
- `GET /admin/export.csv`
- `GET /uploads/{kind}/{filename}`

If a web admin call fails, check backend route registration and `NEXT_PUBLIC_API_BASE` before changing UI logic.

## Landing Page

`LandingPage.tsx` is public/product-facing.

When editing:

- Keep SignSight brand visible immediately.
- Avoid inaccurate claims such as universal ASL translation.
- Use product-specific visuals, not generic abstract decorations.
- Keep CTAs clear.

## Styling

The web project uses Tailwind classes directly. Existing palette is mostly warm orange/pink/white with some slate text.

For admin screens:

- Prioritize scanability.
- Use compact filters.
- Make statuses visible.
- Keep destructive/resolve actions clear.

For public pages:

- Be more expressive, but do not obscure product truth.

## Validation

Run:

```bash
cd web-frontend
npx tsc --noEmit
npm run lint
```

Current known state:

- TypeScript passes.
- Lint has known errors and warnings. See `KNOWN_RISKS.md`.

## Web Agent Pitfalls

- Do not assume `NEXT_PUBLIC_API_BASE` is defined in all environments. Consider fallbacks or explicit setup docs.
- Do not set `Content-Type` manually for multipart requests.
- Do not expose admin tokens in URLs.
- Do not use admin defaults as production assumptions.
- Do not make optimistic UI changes that cannot recover after failed API calls.

