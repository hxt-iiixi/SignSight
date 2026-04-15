# Architecture Reference

## High-Level View

SignSight is split into two main runtime surfaces:

- [`app/`](../../app)
  Expo and React Native mobile application
- [`backend/`](../../backend)
  FastAPI backend for inference, training, dataset summaries, and model lifecycle operations

## Mobile Application

The mobile app contains:

- navigation and screen flow
- camera and tracking runtime
- translator experience
- tutorial, feedback, and settings flows
- developer lab for capture, datasets, and models

Important entry points:

- [`app/src/app/navigation/AppNavigator.tsx`](../../app/src/app/navigation/AppNavigator.tsx)
- [`app/src/components/camera/CameraExperience.tsx`](../../app/src/components/camera/CameraExperience.tsx)
- [`app/src/features/lab/screens/LabDeveloperScreen.tsx`](../../app/src/features/lab/screens/LabDeveloperScreen.tsx)

## Backend

The backend is responsible for:

- prediction APIs
- training APIs
- model health and model listing
- dataset persistence and summaries

Key files:

- [`backend/app/main.py`](../../backend/app/main.py)
- [`backend/app/services/landmark_classifier.py`](../../backend/app/services/landmark_classifier.py)
- [`backend/app/services/gesture_classifier.py`](../../backend/app/services/gesture_classifier.py)

## Product Surfaces

### Translator

Normal-user recognition experience with:

- live camera preview
- prediction result
- confidence
- `Letters` and `Words` modes
- model-aware state

### Developer Lab

Operational workflow inside the app:

- `Capture`
- `Dataset`
- `Models`

This is where SignSight’s data and model iteration loop lives.

## Model Separation

SignSight intentionally separates:

- `Landmark` models
- `Gesture` models

This separation exists in both UX and backend services because static and dynamic recognition behave differently and use different feature shapes.
