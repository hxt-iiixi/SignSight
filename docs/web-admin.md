# Web Admin and Landing Site

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9

## Entry Points

Admin dashboard:

```text
web-frontend/src/app/page.tsx
web-frontend/src/components/AdminDashboard.tsx
web-frontend/src/lib/api.ts
```

Landing page:

```text
web-frontend/src/app/LandingPage.tsx
web-frontend/src/app/download/page.tsx
```

## Environment

The web frontend reads:

```text
NEXT_PUBLIC_API_BASE
```

from `web-frontend/.env.local`.

Example:

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

## Running Locally

```bash
cd web-frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

## Admin Flow

The admin dashboard:

1. Reads an admin token from local storage.
2. Shows a login form when no token exists.
3. Calls `/admin/login`.
4. Stores the returned JWT.
5. Uses the token as a bearer token for admin requests.

Admin capabilities:

- Filter and search feedback.
- Resolve feedback.
- Create audit records.
- Upload audit screenshots.
- View audit history.
- Export feedback CSV.

## Current Integration Note

The frontend calls backend admin endpoints, but the backend must register `admin` and `feedback` routers before these calls work.

Required backend routes:

- `/admin/login`
- `/admin/feedback`
- `/admin/audit`
- `/admin/export.csv`
- `/feedback`
- `/feedback_multipart`

## Quality Gates

Run:

```bash
cd web-frontend
npx tsc --noEmit
npm run lint
```

Current status:

- TypeScript passes.
- ESLint fails with a small number of errors. See `known-issues.md`.

