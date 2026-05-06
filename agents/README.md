# SignSight Agent Context Pack

This folder is written for AI coding agents that need to work effectively in the SignSight repository.

The human-facing docs in `docs/` explain the product and systems broadly. These agent docs go one level deeper into how an agent should reason about the codebase, where to make changes, which contracts matter, and what risks to watch for.

## Read Order For New Agents

Start here:

1. `PROJECT_CONTEXT.md`
2. `AGENT_PLAYBOOK.md`
3. `ARCHITECTURE.md`
4. `DATA_AND_ML.md`
5. `API_CONTRACTS.md`

Then choose the surface you are working on:

- Backend: `BACKEND.md`
- Mobile: `MOBILE.md`
- Web/admin: `WEB_FRONTEND.md`
- Design/UI: `DESIGN.md`

Before shipping changes:

- `TESTING_AND_VALIDATION.md`
- `SECURITY_AND_PRIVACY.md`
- `SCALABILITY_AND_RELIABILITY.md`
- `KNOWN_RISKS.md`

## Agent Docs Map

| File | Purpose |
| --- | --- |
| `PROJECT_CONTEXT.md` | Product purpose, scope, runtime surfaces, labels, domain vocabulary. |
| `AGENT_PLAYBOOK.md` | How agents should explore, edit, test, and report work in this repo. |
| `ARCHITECTURE.md` | End-to-end architecture, data flow, boundaries, failure domains. |
| `DESIGN.md` | Semantic design system, tokens, UX rules, screen patterns, accessibility notes. |
| `BACKEND.md` | FastAPI layout, services, repositories, model pipeline, route ownership. |
| `MOBILE.md` | Expo app, camera runtime, recognition loop, native MediaPipe module, lab UI. |
| `WEB_FRONTEND.md` | Next.js admin/landing frontend, API helpers, auth flow, lint expectations. |
| `API_CONTRACTS.md` | Backend endpoint contracts and payload expectations for agents. |
| `DATA_AND_ML.md` | JSONL datasets, label sets, feature extraction, training modes, model versioning. |
| `SECURITY_AND_PRIVACY.md` | Secrets, auth, CORS, uploads, biometric-like data, privacy expectations. |
| `SCALABILITY_AND_RELIABILITY.md` | Bottlenecks, scaling strategy, performance risks, reliability guardrails. |
| `TESTING_AND_VALIDATION.md` | Test commands, current suite, manual validation matrix, CI recommendations. |
| `KNOWN_RISKS.md` | Current technical debt and high-impact issues to keep in mind. |

## Repository Surfaces

| Surface | Path | Main responsibility |
| --- | --- | --- |
| Mobile app | `app/` | Expo and React Native product experience, camera recognition, developer lab. |
| Native tracking module | `app/modules/signsight-hand-tracker/` | Android MediaPipe hand and pose tracking for VisionCamera frames. |
| Backend | `backend/` | FastAPI inference, training, datasets, model versions, feedback, audit. |
| Web frontend | `web-frontend/` | Next.js admin dashboard, public landing/download pages. |
| Human docs | `docs/` | Project documentation for setup, architecture, API, operations. |
| Agent docs | `agents/` | AI-agent-specialized context and work guidance. |

## High-Level Mental Model

SignSight is not a generic chat or LLM app. It is a camera-first recognition system:

```text
Camera frame
  -> MediaPipe hand and pose landmarks
  -> React Native recognition buffers
  -> FastAPI model inference
  -> prediction overlay / capture workflow
  -> reviewed samples
  -> retrained model versions
```

Most bugs come from contract drift between these layers. When changing one layer, always check the corresponding schema, frontend caller, model feature expectations, and dataset format.

