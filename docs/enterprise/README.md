# SignSight Enterprise Guide

## Executive Summary

SignSight is a mobile-first sign recognition system with a paired API backend. It supports two distinct ML surfaces:

- `Landmark` models for static hand signs
- `Gesture` models for dynamic words and gesture sequences

The platform also includes an in-app operational workspace for:

- reviewed dataset capture
- dataset inspection
- model training
- model lifecycle visibility

## What An Enterprise Team Is Evaluating

If you are reviewing SignSight for technical fit, the key questions are usually:

- how recognition is performed
- what data is stored
- how models are trained and selected
- what parts run on-device vs backend
- what the current operational and product boundaries are

## System Shape

### Mobile

The mobile app is built with Expo and React Native and uses native camera and tracking capabilities for live recognition experiences.

The app is responsible for:

- capture and tracking
- translator experience
- confidence display
- mode switching
- lab capture, dataset inspection, and model operations

### Backend

The backend is built with FastAPI and handles:

- landmark inference and training
- gesture inference and training
- dataset summaries
- model listing and landmark model lifecycle actions

More detail is in the [Architecture Reference](../references/architecture.md).

## Recognition Model Families

### Landmark Models

Used for:

- letters
- static signs
- single-frame classification

### Gesture Models

Used for:

- dynamic words
- motion-aware gesture recognition
- sequence-based classification

These model families are intentionally separate because they solve materially different recognition problems.

## Data Flow

At a high level:

1. the mobile app captures tracking information
2. the app prepares landmark or gesture payloads depending on mode
3. the backend performs prediction or dataset persistence
4. the app presents confidence and active-model-aware UI

For dataset building, the developer lab can capture reviewed records rather than only transient prediction traffic.

## Operational Notes

### What Is Strong Today

- clear split between static and dynamic recognition paths
- mobile-first data collection workflow
- trainable backend models
- app-visible dataset and model tooling

### What To Treat As Current Boundaries

- SignSight is not a full sentence-level sign language translation platform
- enterprise identity, tenancy, and deployment hardening are not the main product story here
- the current docs focus on SignSight’s core translator and model capabilities, not back-office administration

## Recommended Reference Docs

- [Architecture Reference](../references/architecture.md)
- [ML Pipelines Reference](../references/ml-pipelines.md)
- [Repository Map](../references/repository-map.md)

## Good Enterprise Evaluation Questions

- What sign classes are covered today?
- How is model quality monitored before promoting a model?
- How are reviewed dataset captures separated from raw prediction traffic?
- What is the intended deployment topology for backend and mobile clients?
- Which product claims are in scope today, and which are future goals?

Those questions map well to the current SignSight architecture and help keep evaluation grounded in the real system.
