# ML Pipelines Reference

## Landmark Pipeline

The landmark pipeline is used for static recognition.

Typical flow:

1. hand landmarks are captured from the camera runtime
2. landmarks are normalized into a feature vector
3. the active landmark model predicts a static class
4. the app displays the result and confidence

Used for:

- letters
- static signs
- static-word classes

Primary backend service:

- [`backend/app/services/landmark_classifier.py`](../../backend/app/services/landmark_classifier.py)

## Gesture Pipeline

The gesture pipeline is used for dynamic recognition.

Typical flow:

1. gesture frames are recorded over time
2. the sequence can include hand landmarks plus pose information
3. the backend converts the sequence into a fixed feature representation
4. the gesture model predicts the dynamic label

Used for:

- dynamic words
- motion-aware gesture recognition

Primary backend service:

- [`backend/app/services/gesture_classifier.py`](../../backend/app/services/gesture_classifier.py)

## Gesture V2

Gesture V2 is the richer dynamic-sign path. It is designed to use more than isolated hand motion by incorporating body context into the sequence representation.

That makes it a better fit for dynamic signs than the landmark pipeline, which is intentionally single-frame and static.

## Data Capture

SignSight supports reviewed data capture inside the mobile app’s developer lab:

- static landmark samples
- dynamic gesture sequences

This lets the product support both recognition and dataset-building workflows in the same environment.
