# Mobile App

## Stack

- Expo SDK 54
- React 19
- React Native 0.81
- React Navigation
- VisionCamera
- React Native Worklets
- Expo Local Authentication
- Expo Image Picker
- Zustand

## Entry Point

```text
app/App.js
app/src/app/AppShell.tsx
app/src/app/navigation/AppNavigator.tsx
```

The app shows a splash screen, performs local biometric authentication when available, then loads the main tab navigation.

## Main Screens

| Screen | Purpose |
| --- | --- |
| Home | Product home/dashboard. |
| Tutorial | Learning/support content. |
| Feedback | Submit feedback and optional screenshots. |
| Settings | App settings. |
| Translator | Camera recognition experience. |
| Lab | Developer capture, dataset, and model tools. |

## Camera Runtime

Implementation:

```text
app/src/modules/camera/hooks/useCameraRuntime.ts
```

Responsibilities:

- Request camera permission.
- Select front/back camera.
- Select a 30 FPS 640x480-oriented format when available.
- Track camera preview layout.
- Expose torch and flip-camera controls.

## Recognition Runtime

Implementation:

```text
app/src/modules/camera/hooks/useRecognitionRuntime.ts
app/src/ml/streamingRecognition.ts
app/src/ml/useStreamingHandTracking.ts
```

Responsibilities:

- Run native hand tracking when enabled.
- Buffer frames for letters and words.
- Smooth labels with majority voting.
- Call backend prediction endpoints.
- Maintain UI-facing prediction state.
- Save reviewed lab samples.

## Native Hand Tracker Module

Path:

```text
app/modules/signsight-hand-tracker
```

Android implementation:

```text
app/modules/signsight-hand-tracker/android/src/main/java/expo/modules/signsighthandtracker/
```

The module:

- Registers a VisionCamera frame processor plugin named `signsightDetectHands`.
- Runs MediaPipe hand landmarking.
- Runs MediaPipe pose landmarking in word mode.
- Selects a primary hand by score and estimated area.
- Returns landmarks, handedness, detected hands, upper-body landmarks, timestamps, and sequence IDs.

Required model assets:

- `hand_landmarker.task`
- `pose_landmarker_full.task`
- `pose_landmarker_lite.task`

## Recognition Behavior

### Letter Mode

Letter mode calls:

```text
POST /predict_landmarks
```

It also buffers recent frames and may call:

```text
POST /predict_gesture
```

for motion-only letters such as `J` and `Z`.

### Word Mode

Word mode first attempts static word landmark recognition for labels such as `I_LOVE_YOU`. If no static word is accepted, it uses buffered gesture frames and calls:

```text
POST /predict_gesture
```

Gesture V2 is preferred when enough upper-body frames are available.

## Developer Lab

Implementation:

```text
app/src/features/lab/
```

Main capabilities:

- Capture reviewed static letter samples.
- Capture reviewed static word samples.
- Record dynamic word gesture samples.
- Inspect dataset health and per-label summaries.
- Train landmark and gesture models.
- Activate, rename, and archive landmark models.

## Mobile Environment

The app reads:

```text
EXPO_PUBLIC_API_BASE
```

from `app/.env.local`.

For physical devices, this should normally point to the host machine's LAN address, not `127.0.0.1`.

