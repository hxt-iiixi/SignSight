# Archive

This folder holds inactive code paths kept only for reference.

Current canonical recognition path:
- `app/src/screens/CameraScreenVC.tsx`
- `app/src/ml/handLandmarksWebView.ts`
- `app/src/ml/handWebviewHtml.ts`
- `app/src/server/server.py` landmark and gesture endpoints

Archived here:
- `recognition/CameraScreen.tsx`: older `expo-camera` recognition screen
- `recognition/recognizer.ts`: legacy fake recognizer based on local dataset counts
- `recognition/hand_webview.html`: placeholder WebView HTML, unused by the active app
- `auth/AuthGate.tsx`: older auth gate with placeholder PIN flow
- `auth/localAuth.ts`: unused auth helper module from the older auth path

Do not restore these into active use unless the architecture is intentionally being revived.
