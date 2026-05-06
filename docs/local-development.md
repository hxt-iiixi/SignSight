# Local Setup and Development

## Prerequisites

Install:

- Node.js 20 LTS or newer.
- npm.
- Python 3.10 or newer.
- MongoDB, if using feedback/admin/audit storage.
- Android Studio and Android SDK for native Android development builds.
- Expo tooling through `npx expo`.

## One-Command Initialization

The repository includes `init.sh`, which installs app and web dependencies, creates the backend virtual environment, installs Python dependencies, and writes local environment files.

```bash
./init.sh
```

Important behavior:

- Preserves an existing `backend/.env`.
- Rewrites `app/.env.local`.
- Rewrites `web-frontend/.env.local`.
- Detects a LAN API URL for the mobile app when possible.

Review generated credentials before using the admin dashboard outside local development.

## Manual Installation

Mobile app:

```bash
cd app
npm ci
```

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Web frontend:

```bash
cd web-frontend
npm ci
```

## Environment Files

Backend: `backend/.env`

```bash
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=signsight
JWT_SECRET=change_me_now
ADMIN_USER=admin
ADMIN_PASS=admin123
```

Mobile: `app/.env.local`

```bash
EXPO_PUBLIC_API_BASE=http://<lan-ip-or-localhost>:8000
```

Web frontend: `web-frontend/.env.local`

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

## Running Services

Backend:

```bash
make backend
```

Mobile app:

```bash
make app
```

Web frontend:

```bash
make web-client
```

Backend and mobile together:

```bash
make dev
```

All three surfaces:

```bash
make dev-all
```

## Native Android Development

The hand tracker is a native Expo module that depends on a development build. For Android native tracking changes:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

## Verification Commands

Backend syntax/import compile check:

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

