# Scalability And Reliability Guide

## Current Scalability Profile

SignSight is currently optimized for local development and early-stage model iteration.

Strengths:

- On-device landmark extraction reduces backend compute per frame.
- Backend classifiers are lightweight.
- JSONL datasets are simple and inspectable.
- Model artifacts are easy to version locally.

Limitations:

- Training runs in request/response path.
- Dataset writes append directly to local files.
- Model artifacts are local filesystem state.
- Prediction endpoints load in-process global models.
- Feedback/admin depends on MongoDB availability.
- No structured metrics or tracing.

## Runtime Bottlenecks

### Mobile

Potential bottlenecks:

- VisionCamera frame processor interval.
- bitmap conversion and resizing in native module.
- MediaPipe hand and pose inference.
- JS state updates from frequent native results.
- network calls per recognition frame.

Mitigations:

- Adaptive frame interval is already used.
- Keep UI state updates minimal.
- Do not perform heavy JS processing in camera loop.
- Batch or throttle backend calls where practical.

### Backend Prediction

Potential bottlenecks:

- per-request feature extraction
- SVM probability prediction
- synchronous request handling
- model reload on missing global state

Mitigations:

- Keep models loaded at startup.
- Avoid retraining in same process used for serving if load grows.
- Add request metrics and latency budgets.

### Training

Potential bottlenecks:

- loading all approved samples into memory
- train/test split requirements
- SVM training cost as dataset grows
- file artifact writes

Recommended future:

- background job queue
- training run records
- model artifact object storage
- separate model serving service

### Dataset Storage

JSONL is useful now, but limited for concurrent writes and review workflows.

Future direction:

- store sample metadata in a database
- store large/raw artifacts in object storage
- keep exportable JSONL snapshots for reproducibility
- add sample version/migration metadata

## Reliability Concerns

### Model Registry Integrity

Risks:

- active version points to missing file
- metadata exists but model file missing
- archive operation partially moves files
- active alias out of sync

Agent guidance:

- Prefer atomic-ish operations where possible.
- Add tests around registry mutation.
- Report if registry and files disagree.

### Startup Reliability

Backend startup loads model artifacts. Corrupt artifacts can break startup or prediction.

Recommended direction:

- handle corrupt artifact load with safe degraded mode
- health endpoint should expose model load status
- logs should make active version clear

### Network Reliability

Mobile prediction depends on backend availability.

Recommended UX:

- clear offline/server unavailable state
- avoid repeated noisy failures
- keep camera usable even if predictions fail

### Mongo Reliability

Feedback/admin workflows depend on MongoDB.

Recommended direction:

- initialize indexes on startup
- expose Mongo health in admin/system health
- fail gracefully when feedback cannot submit

## Scalability Roadmap

### Phase 1: Local Robustness

- Add structured logging.
- Add backend tests for model registry operations.
- Add Mongo index startup.
- Fix web lint.
- Improve route coverage.

### Phase 2: Controlled Multi-User Use

- Protect training/model mutation endpoints.
- Add upload size limits.
- Add role-based admin/lab auth.
- Add sample review workflow backed by database.
- Add model training audit records.

### Phase 3: Production-Like Operation

- Move training to background workers.
- Store artifacts in object storage.
- Separate model serving from training.
- Add observability: metrics, traces, logs.
- Add CI/CD with test gates.
- Add disaster recovery and backups.

## Reliability Checklist For Agents

Before merging behavior changes:

- Does degraded mode still work?
- Are expensive operations off the hot path?
- Are global model variables updated consistently?
- Can partial failures leave files in inconsistent state?
- Is there a test for the new failure path?
- Is the user-facing error understandable?

