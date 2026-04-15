# Development Setup

## Requirements

### Mobile

- Node.js 20+ recommended
- npm
- Android Studio or a physical Android device for native dev builds

### Backend

- Python 3.10+
- `venv`

## Quick Start

From the repository root:

```bash
./init.sh
./run.sh
```

This is the fastest local setup path for most contributors.

## Manual Setup

### 1. Install mobile dependencies

```bash
cd app
npm ci
```

### 2. Install backend dependencies

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. Start the backend

```bash
cd backend
.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start the app

For a regular Expo session:

```bash
cd app
npx expo start -c
```

For Android native tracking changes:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

## Environment

The mobile app reads `EXPO_PUBLIC_API_BASE` from `app/.env.local`.

The backend runs on port `8000` by default. The device running the app must be able to reach that backend over your local network.

## Practical Notes

- Native tracking changes require a rebuild.
- Most UI-only changes do not.
- Gesture and landmark models are separate; test both if your change affects recognition.
- The developer lab is the best place to inspect dataset capture and model lifecycle behavior.
