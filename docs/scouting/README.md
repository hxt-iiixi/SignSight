# SignSight Scouting Guide

## What SignSight Is

SignSight is a mobile-first sign recognition platform that combines:

- live camera-based translation UI
- static hand-sign recognition
- dynamic gesture recognition
- built-in mobile tooling for dataset capture, inspection, and model training

It is best understood as a product-plus-ML-workbench system, not just a demo classifier.

## Why It Stands Out

SignSight is interesting because the product does not stop at inference. It includes the operational loop needed to improve recognition over time:

- capture reviewed samples on-device
- inspect dataset health
- train updated models
- switch and monitor model families inside the product workflow

That makes it more than a simple “camera plus classifier” prototype.

## Current Product Surface

- live translator with `Letters` and `Words` modes
- confidence-aware prediction
- landmark-model-aware static recognition
- gesture-model-aware dynamic recognition
- tutorial and feedback flows
- developer lab for capture, datasets, and models

## What To Look At First

If you are evaluating the project quickly, focus on:

1. [`README.md`](../../README.md)
2. [Architecture Reference](../references/architecture.md)
3. [ML Pipelines Reference](../references/ml-pipelines.md)
4. [`app/src/components/camera/CameraExperience.tsx`](../../app/src/components/camera/CameraExperience.tsx)
5. [`app/src/features/lab/screens/LabDeveloperScreen.tsx`](../../app/src/features/lab/screens/LabDeveloperScreen.tsx)
6. [`backend/app/services/landmark_classifier.py`](../../backend/app/services/landmark_classifier.py)
7. [`backend/app/services/gesture_classifier.py`](../../backend/app/services/gesture_classifier.py)

## What SignSight Does Well

- separates static and dynamic recognition paths
- uses the mobile app as both product surface and data-collection surface
- supports reviewed dataset capture rather than only ad hoc inference
- keeps model lifecycle visible inside the app

## Honest Current Boundaries

SignSight should be evaluated as:

- a sign recognition platform
- a dataset and model iteration workflow
- a strong applied ML/mobile systems project

It should not be oversold as:

- full natural-language sign interpretation
- phrase-level or sentence-level translation
- a generalized multimodal language system

## Good Demo Flow

For a short technical demo, the strongest sequence is:

1. show `Translator` in `Letters` mode
2. switch to `Words` mode
3. show the developer `Lab`
4. capture or inspect data
5. inspect models and dataset readiness

That demonstrates both user value and system depth.
