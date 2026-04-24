# SignSight

SignSight is a mobile-first sign recognition platform built for real-time camera-based translation, dataset iteration, and model improvement.

It combines:

- live `Letters` and `Words` recognition
- on-device hand and pose tracking
- trainable backend model pipelines
- an in-app developer lab for capture, datasets, and model workflows

## Architecture At A Glance

SignSight has two main runtime surfaces:

- [`app/`](./app)
  Expo and React Native mobile application
- [`backend/`](./backend)
  FastAPI backend for inference, training, dataset summaries, and model operations

## Quick Start

### Fast Path

From the repository root:

```bash
./init.sh
./run.sh
```

### Manual Setup

Install mobile dependencies:

```bash
cd app
npm ci
```

Install backend dependencies:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Start the backend:

```bash
cd backend
.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Start the app:

```bash
cd app
npx expo start -c
```

For Android native tracking changes, use a development build:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

## Documentation

The main docs hub lives in [docs/README.md](./docs/README.md).

Audience-based entry points:

- [Normal User Guide](./docs/users/getting-started.md)
- [Open Source Guide](./docs/open-source/README.md)
- [Scouting Guide](./docs/scouting/README.md)
- [Enterprise Guide](./docs/enterprise/README.md)

Shared technical references:

- [Architecture Reference](./docs/references/architecture.md)
- [ML Pipelines Reference](./docs/references/ml-pipelines.md)
- [Repository Map](./docs/references/repository-map.md)

## Project Scope

SignSight should be understood as:

- a sign recognition product
- a dataset collection and review workflow
- a model iteration platform for static and dynamic sign recognition

It should not be oversold as:

- full sentence-level sign language translation
- a general-purpose multimodal language model
- a complete back-office or administration platform

## Status

The project currently emphasizes:

- mobile-first translation workflows
- landmark and gesture model separation
- reviewed dataset capture
- iterative model improvement inside the app
