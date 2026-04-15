# SignSight

SignSight is a mobile-first sign language recognition platform built with Expo, React Native, VisionCamera, and FastAPI. It combines real-time camera-based inference, on-device landmark and pose tracking, and trainable backend models for both static hand signs and dynamic gesture recognition.

## Overview

SignSight is designed around two complementary recognition paths:

- **Static landmark recognition**
  Detects single-frame signs such as alphabet letters and static words from hand landmarks.
- **Dynamic gesture recognition**
  Recognizes time-based gestures and word sequences from hand motion plus upper-body pose context.

At a product level, SignSight supports:

- real-time sign translation through the device camera
- confidence-aware predictions
- landmark model selection for translator mode
- gesture-model-aware word mode
- developer tools for dataset capture, dataset inspection, and model training

## Core Capabilities

### Real-time Translation

The translator experience is optimized for normal users:

- live prediction from the camera stream
- `Letters` and `Words` modes
- confidence display
- on-device hand and pose tracking
- model-aware empty states when a gesture model is unavailable
- optional overlay rendering for visual debugging

### Static Sign Recognition

The static pipeline is based on normalized hand landmarks and is best suited for:

- alphabet letters
- one-frame static signs
- static-word classes such as `I_LOVE_YOU`

This path uses the landmark model family and supports versioned training in the developer lab.

### Dynamic Gesture Recognition

The gesture pipeline is built for word-level and motion-based recognition:

- streaming frame sequences rather than single snapshots
- Gesture V2 support with hand landmarks plus pose landmarks
- reviewed sequence capture in the developer lab
- training and prediction through a dedicated gesture model path

### Developer Lab

The built-in lab workspace is the operational environment for improving SignSight:

- **Capture**
  Save reviewed landmark and gesture samples directly from the device.
- **Dataset**
  Inspect dataset health, handedness balance, readiness, and per-label coverage.
- **Models**
  Train landmark models, inspect model versions, and monitor gesture-model readiness.

The lab is intended for data collection, model iteration, and diagnostics without leaving the mobile environment.

### Feedback and Support Flows

The app also includes supporting user flows for:

- guided tutorial content
- feedback submission
- settings and translator preferences
- biometric-gated entry flow depending on device support

## Architecture

### Mobile App

The mobile app lives in [app](/home/fkrul3s47/Documents/Projects/SignSight/app) and is built with:

- Expo
- React Native
- React Navigation
- VisionCamera frame processors
- React Native SVG
- Expo Speech, Camera, Media Library, Image Picker, and Local Authentication

### Backend

The ML and API backend lives in [backend](/home/fkrul3s47/Documents/Projects/SignSight/backend) and is built with:

- FastAPI
- scikit-learn
- NumPy
- OpenCV
- joblib

The backend exposes routes for:

- landmark upload, prediction, and training
- gesture upload, prediction, and training
- dataset and model health
- model listing and landmark model lifecycle actions
- uploads and feedback handling

## Recognition Pipelines

### Landmark Pipeline

Used for static recognition:

1. Camera frames are processed through the native hand tracker.
2. Hand landmarks are normalized into feature vectors.
3. The backend predicts against the active landmark model.
4. The app presents smoothed recognition results and confidence.

### Gesture Pipeline

Used for dynamic word recognition:

1. The camera stream produces gesture sequence frames over time.
2. Each frame can include:
   - primary hand landmarks
   - multi-hand tracking metadata
   - upper-body pose landmarks
   - full pose landmarks for Gesture V2 capture
3. The backend converts reviewed sequences into gesture feature vectors.
4. A gesture classifier predicts the active dynamic label.

## Repository Layout

```text
SignSight/
├── app/                 # Expo / React Native mobile app
├── backend/             # FastAPI backend and ML services
├── docs/                # Project documentation
├── init.sh              # Local environment bootstrap
├── run.sh               # Local development runner
└── README.md
```

## Requirements

### Mobile

- Node.js 20+ recommended
- npm
- Android Studio or a physical Android device for native dev builds

### Backend

- Python 3.10+
- `venv`

### Optional local services

- MongoDB if you want the full feedback-related backend flows available locally

## Quick Start

From the repository root:

```bash
./init.sh
./run.sh
```

What these scripts do:

- install mobile dependencies
- create the backend virtual environment
- install Python requirements
- write local environment files
- start the FastAPI backend
- start the Expo dev server in the foreground

The default local backend is exposed on port `8000`.

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

### 4. Start the mobile app

```bash
cd app
npx expo start -c
```

For Android native tracker changes, use a development build:

```bash
cd app
npx expo run:android
```

## Environment

The mobile app reads `EXPO_PUBLIC_API_BASE` from `app/.env.local`.

By default, `init.sh` and `run.sh` generate this automatically using your LAN IP so a phone on the same Wi-Fi network can reach the backend.

## Main API Surface

The main product backend exposes endpoints for:

- `/predict_landmarks`
- `/upload_landmarks`
- `/train_landmarks`
- `/upload_static_word_landmarks`
- `/predict_gesture`
- `/upload_gesture`
- `/train_gestures`
- `/health`
- `/models`

These power the translator, lab capture flows, dataset summaries, and model-management UI.

## Dataset and Models

### Landmark Data

Static samples are stored as reviewed JSONL landmark records and are used to train versioned landmark models.

### Gesture Data

Dynamic samples are stored as gesture JSONL records and can include reviewed `framesV2` data for the Gesture V2 pipeline.

### Model Families

SignSight currently distinguishes between:

- **Landmark models**
  Used for letters and static signs.
- **Gesture models**
  Used for dynamic word/gesture recognition.

## Product Boundaries

This repository includes more than one surface, but this README is intentionally focused on:

- the mobile SignSight app
- the translator experience
- the developer lab
- the ML backend that powers them

It does **not** document the admin panel or unrelated internal dashboards.

## Status

SignSight currently includes:

- native hand tracking
- pose-assisted gesture capture
- landmark model version management
- gesture-model training path
- mobile-first dataset and model workflows

The project is best understood as an actively evolving sign recognition platform rather than a fixed demo app.

## License

No license is declared in this repository at the time of writing. Add an explicit license before public distribution or open-source release.
