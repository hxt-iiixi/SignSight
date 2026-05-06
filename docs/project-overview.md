# Project Overview

## Purpose

SignSight is designed to recognize sign language input from a mobile camera and convert it into readable output. It also provides tooling for collecting reviewed datasets and retraining recognition models over time.

The project should currently be described as:

- A sign recognition product.
- A dataset collection and review workflow.
- A model iteration platform for static and dynamic sign recognition.

It should not yet be presented as:

- Full sentence-level sign language translation.
- A general-purpose multimodal language model.

## Core Capabilities

- Real-time camera-based recognition for letters and selected words.
- On-device hand tracking and upper-body pose tracking through MediaPipe.
- Backend inference for static landmarks and dynamic gestures.
- In-app developer lab for sample capture, dataset inspection, model training, and model version management.
- Feedback collection from the mobile app.
- Web admin workflow for feedback and audit records.

## Recognition Modes

### Letters

Static letters use one-frame hand landmarks. Motion-only letters such as `J` and `Z` are routed through the gesture pipeline.

Static landmark labels are defined in `backend/app/core/constants.py` as all ASL letters except the motion-only labels.

### Words

Words use two paths:

- Static word landmarks for signs that can be represented as one stable shape, currently `I_LOVE_YOU`.
- Gesture sequences for dynamic signs such as `HELLO`, `THANK_YOU`, `PLEASE`, `YES`, and `NO`.

Gesture V2 can include both hand landmarks and upper-body landmarks.

## Key Product Areas

### Translator

The translator experience uses the camera runtime and recognition runtime to display live recognition results.

### Developer Lab

The developer lab is the model improvement workspace. It supports:

- Selecting letter or word targets.
- Capturing reviewed samples.
- Viewing dataset health.
- Training landmark and gesture models.
- Activating, renaming, and archiving landmark model versions.

### Feedback and Admin

The mobile app can submit feedback, optionally with screenshots. The web dashboard is intended to allow admin users to view feedback, resolve items, create audit records, and export feedback CSV data.

