# Open Source Guide

## Who This Is For

This guide is for developers who want to:

- run SignSight locally
- understand the codebase quickly
- contribute features or fixes
- inspect the recognition and model-training stack

## What SignSight Contains

The project has two main runtime surfaces:

- a mobile app in [`app/`](../../app)
- a FastAPI backend in [`backend/`](../../backend)

At a high level, the mobile app handles:

- camera access
- on-device tracking
- translator UI
- tutorial, feedback, settings, and lab flows

The backend handles:

- landmark prediction and training
- gesture prediction and training
- dataset summaries and health endpoints
- model lifecycle operations

## Start Here

- [Development Setup](./development.md)
- [Architecture Reference](../references/architecture.md)
- [ML Pipelines Reference](../references/ml-pipelines.md)
- [Repository Map](../references/repository-map.md)

## Contribution Mindset

The fastest way to contribute safely is to keep these boundaries in mind:

- `Letters` and static signs belong to the landmark model family
- `Words` and dynamic gestures belong to the gesture model family
- the translator flow is consumer-facing
- the lab flow is dataset and model oriented

When making changes, it helps to test both:

- normal translator behavior
- developer lab capture and training behavior

## Scope Notes

This documentation focuses on SignSight’s core product capabilities and ML workflows. It intentionally does not treat the admin panel as part of the main contributor path here.
