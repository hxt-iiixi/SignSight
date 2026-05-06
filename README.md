# SignSight

SignSight is a mobile-first sign recognition platform built for real-time camera-based translation, dataset iteration, and model improvement.

It combines:

- live `Letters` and `Words` recognition
- on-device hand and pose tracking
- trainable backend model pipelines
- an in-app developer lab for capture, datasets, and model workflows

SignSight has two main runtime surfaces:

- [`app/`](./app)
  Expo and React Native mobile application
- [`backend/`](./backend)
  FastAPI backend for inference, training, dataset summaries, and model operations

## Quick Start

### Fast Run w/ Make (App & Backend)
Exception: Web Client

```bash
make dev
```

### Setup

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

Or, from the repository root:

```bash
make backend
make app
```

For Android native tracking changes, use a development build:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

## Project Scope

SignSight should be understood as:

- a sign recognition product
- a dataset collection and review workflow
- a model iteration platform for static and dynamic sign recognition

It should not be oversold yet as:

- full sentence-level sign language translation
- a general-purpose multimodal language model

## Status

The project currently emphasizes:

- mobile-first translation workflows
- landmark and gesture model separation
- reviewed dataset capture
- iterative model improvement inside the app
