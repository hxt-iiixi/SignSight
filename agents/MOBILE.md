# Mobile Agent Guide

## Stack

- Expo SDK 54
- React 19
- React Native 0.81
- React Navigation
- VisionCamera
- React Native Worklets
- Expo Local Authentication
- Expo Image Picker
- Expo Speech

## Entry Points

```text
app/App.js
app/src/app/AppShell.tsx
app/src/app/navigation/AppNavigator.tsx
```

The app flow:

```text
Video splash
  -> local biometric/passcode auth if available
  -> tab navigator
  -> translator/lab stack screens
```

## Key Mobile Directories

| Path | Purpose |
| --- | --- |
| `app/src/app/` | App shell, navigation, providers. |
| `app/src/modules/camera/` | Reusable camera shell, camera runtime, recognition runtime. |
| `app/src/ml/` | Streaming recognition, labels, smoothing, webview fallback types/helpers. |
| `app/src/features/lab/` | Developer lab capture, dataset, model management. |
| `app/src/features/translator/` | Translator screen. |
| `app/src/features/feedback/` | Feedback service helper. |
| `app/src/screens/` | Legacy/top-level screens. |
| `app/modules/signsight-hand-tracker/` | Native tracker module. |

## Recognition Runtime

Core files:

- `app/src/ml/useStreamingHandTracking.ts`
- `app/src/ml/streamingRecognition.ts`
- `app/src/modules/camera/hooks/useRecognitionRuntime.ts`

The runtime:

1. Receives native frame processor results.
2. Normalizes upper-body output shape.
3. Maintains latest hand frame and debug state.
4. Applies hand-loss grace period.
5. Buffers frames for letters or words.
6. Calls backend prediction endpoints.
7. Smooths and exposes UI prediction state.

## Camera Runtime

Core file:

```text
app/src/modules/camera/hooks/useCameraRuntime.ts
```

It owns:

- Permission request.
- camera position.
- torch state.
- VisionCamera device and format.
- preview layout and oriented frame dimensions.

Be careful with render loops. Camera components can become performance-sensitive quickly.

## Native Hand Tracker

Core files:

- `app/modules/signsight-hand-tracker/src/SignSightHandTracker.types.ts`
- `app/modules/signsight-hand-tracker/src/SignSightHandTrackerModule.ts`
- `app/modules/signsight-hand-tracker/android/src/main/java/expo/modules/signsighthandtracker/SignSightHandTrackerFrameProcessorPlugin.kt`

The JS API exposes:

- `detectHands(frame, options)`
- `isHandTrackingSupported()`
- `getTrackingCapabilities()`
- `isUpperBodyTrackingSupported()`

Frame processor plugin name:

```text
signsightDetectHands
```

Native result shape includes:

- `landmarks`
- `handedness`
- `hands`
- `upperBody`
- `hasUpperBody`
- `upperBodyCount`
- `timestampMs`
- `hasHand`
- `sequenceId`

## Letter Mode

Letter mode calls:

```text
POST /predict_landmarks
```

It also buffers recent frames for motion-only letters and may call:

```text
POST /predict_gesture
```

Agent risk:

- If backend thresholds or response fields change, update mobile acceptance logic.
- If `active_static_letters` behavior changes, update local confidence threshold logic.

## Word Mode

Word mode:

1. Attempts static word detection with `labelSpace: "words"`.
2. Buffers live word frames.
3. Preferentially sends Gesture V2 frames when upper-body data is available.
4. Falls back to legacy gesture prediction.

Agent risk:

- Do not remove upper-body normalization without checking Gesture V2.
- Do not change `MIN_PREDICT_FRAMES` or frame counts without backend implications.

## Developer Lab

Core directory:

```text
app/src/features/lab/
```

Lab capabilities:

- Select letter/word mode.
- Select target label.
- Capture static samples.
- Record gesture samples.
- Show debug tracking state.
- Show dataset health.
- Train models.
- Activate/rename/archive landmark models.

Lab capture writes reviewed samples with:

- `accepted: true`
- `review_status: "approved"`
- `signer_id`
- `capture_session_id`
- `camera_position`
- `captured_at`

## Environment

Mobile reads:

```text
EXPO_PUBLIC_API_BASE
```

On physical devices, use host LAN IP:

```text
http://<host-lan-ip>:8000
```

not:

```text
http://127.0.0.1:8000
```

## Mobile Validation

For JS/TS-only changes:

```bash
cd app
npx tsc --noEmit
```

For native tracking changes:

```bash
cd app
npx expo run:android
npx expo start --dev-client
```

Manual checks:

- Camera opens.
- Hand overlay appears.
- Letter mode predicts or returns no clear sign.
- Word mode records frames.
- Lab capture saves samples.
- Flip camera and torch controls behave.
- App remains responsive.

## Mobile Agent Pitfalls

- Do not assume Expo Go supports this native module. Use a dev build.
- Do not add web-only APIs to native runtime paths.
- Do not make recognition calls on every render. They are frame-driven.
- Do not block the JS thread with heavy work in camera screens.
- Do not change native result shape without updating TypeScript types and consumers.

