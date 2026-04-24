## 2026-04-15 - Adaptive Frame Throttle in react-native-vision-camera
**Learning:** High-frequency MediaPipe landmarker execution in a continuous mobile frame processor can cause severe thermal build-up and battery drain, even when no target object (e.g., hands) is present.
**Action:** Use `react-native-worklets-core` `useSharedValue` to track consecutive empty frames natively inside the worklet, and dynamically back-off the processing interval when idle to significantly reduce sustained CPU/GPU load without missing the target's re-entry.

## 2026-04-18 - Reduce PoseLandmarker Inference and State Churn
**Learning:** Running multiple heavy ML models per frame generates excessive heat, even if the results aren't actively used by the UI layer. Additionally, continuous identical state updates from the native module cause massive unnecessary React UI re-renders.
**Action:** Pass mode flags via the bridge to selectively run secondary inference models in the native layer (like PoseLandmarker). Implement strict equality checks when updating JS state from frame processors to stop identical data from causing React re-renders.
