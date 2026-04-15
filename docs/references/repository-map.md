# Repository Map

## Top-Level Layout

```text
SignSight/
├── app/        # Expo / React Native mobile app
├── backend/    # FastAPI backend and ML services
├── docs/       # Project documentation
├── init.sh     # Local bootstrap script
├── run.sh      # Local development runner
└── README.md
```

## App Highlights

- [`app/src/app/navigation/`](../../app/src/app/navigation)
  Navigation and route structure
- [`app/src/components/camera/`](../../app/src/components/camera)
  Translator and camera experience
- [`app/src/modules/camera/`](../../app/src/modules/camera)
  Camera shell, overlays, and hooks
- [`app/src/features/lab/`](../../app/src/features/lab)
  Capture, dataset, and model lab flows
- [`app/src/screens/`](../../app/src/screens)
  Main user-facing screens such as Home, Tutorial, Feedback, and Settings

## Backend Highlights

- [`backend/app/api/routes/`](../../backend/app/api/routes)
  FastAPI route modules
- [`backend/app/services/`](../../backend/app/services)
  Classifier and operational services
- [`backend/app/schemas/`](../../backend/app/schemas)
  Request and response schemas
- [`backend/gestures/`](../../backend/gestures)
  Gesture dataset files

## Docs Highlights

- [`docs/users/`](../users)
  Normal-user oriented product docs
- [`docs/open-source/`](../open-source)
  Contributor and development docs
- [`docs/scouting/`](../scouting)
  Fast evaluation docs
- [`docs/enterprise/`](../enterprise)
  Architecture and operational framing for enterprise readers
- [`docs/references/`](.)
  Shared technical references
