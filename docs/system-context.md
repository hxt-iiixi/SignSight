# System Context Initialization Report

## 1. Product and Goal Understanding

SignSight is a mobile-first ASL assistance app centered on camera-based sign recognition, tutorial content, and feedback collection. The shipped mobile experience is: splash/authentication, dashboard, camera-based recognition, tutorial browsing, and feedback submission. The app routes only to `DashboardScreen`, `CameraScreenVC`, `TutorialScreen`, and `FeedbackScreen` from the root `App` component, with biometric gating before entry ([App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L10), [App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L123)).

What is definitely implemented:
- Mobile app with splash/auth gate, dashboard, camera recognition, tutorial, and feedback flows ([App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L77), [DashboardScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/DashboardScreen.tsx#L22), [TutorialScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/TutorialScreen.tsx#L82), [FeedbackScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/FeedbackScreen.tsx#L28)).
- A FastAPI backend serving recognition, training, feedback, admin auth, audit, and upload endpoints ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L79), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L413), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L597)).
- A separate Next.js admin app for feedback and audit management ([page.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/app/page.tsx#L7), [AdminDashboard.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/components/AdminDashboard.tsx#L205)).

What appears partially implemented:
- “Real-time translation” is approximated by repeated snapshots, not continuous frame-native inference. In the active camera screen, landmarks are produced from `takeSnapshot` + file read + hidden WebView, inside a `setInterval`, while the `frameProcessor` is only used to count FPS ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L154), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L351)).
- Word recognition exists, but the current word label set is small and unevenly populated, and one dataset label (`PAKYU`) is in the repo but not in `GESTURE_LABELS`, so it is ignored by training/inference ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L55), repo counts gathered locally).
- The repo still contains an archived older recognition screen with a different capture/WebView path and leftover pixel-model affordances, but the app no longer routes to it ([App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L123), [CameraScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/archive/recognition/CameraScreen.tsx#L23)).

What is planned or implied but not fully present:
- Marketing copy promises broad “real-time sign language interpretation” and “text and speech output,” but the active UI displays a detected label on-screen; speech output exists only in the older, inactive archived `CameraScreen` via `expo-speech` ([DashboardScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/DashboardScreen.tsx#L61), [LandingPage.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/app/LandingPage.tsx#L14), [CameraScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/archive/recognition/CameraScreen.tsx#L145)).
- Tutorial UX hints at broader learning modes like “Practice,” “Challenges,” and “Profile,” but those bottom-nav items are visual only ([TutorialScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/TutorialScreen.tsx#L176)).

What is missing:
- No server-side user accounts or per-user data model for mobile users.
- No production-grade streaming inference pipeline.
- No robust model/version management, metrics, or evaluation storage.
- No real PIN implementation despite the older archived `AuthGate` placeholder naming it ([AuthGate.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/archive/auth/AuthGate.tsx#L49)).

## 2. Actual Architecture

### Mobile app
The active Expo/React Native app is simple, route-state driven, and mostly local-state based. There is no navigation library; screen switching is done with a `route` string in `App.js` ([App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L14), [App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L123)). The mobile API base now comes from `EXPO_PUBLIC_API_BASE` via a small shared config module ([api.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/config/api.ts#L1)).

### Recognition stack
The active recognition UI is `CameraScreenVC`, built on:
- `react-native-vision-camera` for capture
- `expo-file-system/legacy` to turn snapshots into base64
- a hidden `react-native-webview` wrapper for MediaPipe Hands
- backend HTTP calls for classification ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L10), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L24), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L351)).

### Backend
The backend is one monolithic FastAPI file with:
- ML training/inference for pixel, landmark, and gesture models
- MongoDB-backed feedback/audit storage
- admin JWT auth
- local filesystem image upload serving ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L32), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L94), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L413), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L597)).

### Admin app
The admin app is a separate Next.js app using `NEXT_PUBLIC_API_BASE`, localStorage token storage, and a single main dashboard with feedback/audit tabs ([api.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/lib/api.ts#L1), [page.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/app/page.tsx#L7), [AdminDashboard.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/components/AdminDashboard.tsx#L205)).

## 3. Recognition / Inference Pipeline

The README’s core claim is accurate for the active path: snapshot -> hidden WebView MediaPipe Hands -> 21 landmarks -> FastAPI -> scikit-learn prediction. That is implemented, but it is not true live video inference.

### Active letter pipeline
1. `CameraScreenVC` repeatedly calls `cameraRef.current.takeSnapshot({ quality: 55 })` inside a `setInterval(..., 70)` loop ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L351), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L358)).
2. The file path is converted to base64 with `expo-file-system` ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L361)).
3. `HandLandmarksWebView.process(base64)` posts a `PROCESS` message to a hidden WebView and awaits a `RESULT` reply with landmarks/handedness ([handLandmarksWebView.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handLandmarksWebView.ts#L39), [handLandmarksWebView.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handLandmarksWebView.ts#L71)).
4. The WebView HTML loads MediaPipe Hands from jsDelivr, downsamples to `TARGET_W = 192`, runs `hands.send`, and returns the first detected hand’s 21 landmarks plus handedness ([handWebviewHtml.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handWebviewHtml.ts#L15), [handWebviewHtml.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handWebviewHtml.ts#L37), [handWebviewHtml.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handWebviewHtml.ts#L82)).
5. The mobile app POSTs those landmarks to `/predict_landmarks` ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L395)).
6. The backend normalizes the 21 landmarks to a 63-d vector by translating to wrist origin, optionally flipping X for left hands, scale-normalizing, then flattening ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L312)).
7. The backend SVC predicts a label and probability ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L472)).
8. The client smooths label output with `MajorityVoteSmoother(3)` before display ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L98), [smoother.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/smoother.ts#L1)).

### J/Z motion handling
The active letter path has a secondary gesture-based override for motion letters. If the base landmark classifier returns something motion-like (`I`, `D`, `Z`, `J`), the app sends the last 10 landmark frames to `/predict_gesture`, and if the returned label is `J` or `Z` with confidence >= 0.75, it overrides the letter result ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L416), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L428)).

### Word / gesture pipeline
The app also has a `WORDS` mode. It buffers up to 12 landmark frames, waits for at least 5, then POSTs them to `/predict_gesture` ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L487), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L496), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L508)). The backend resamples to `GESTURE_FRAMES = 8`, normalizes each frame, concatenates them, and classifies with another SVC ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L67), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L394), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L570)).

### Real-time claim vs reality
Definitely implemented:
- repeated snapshot-based inference, not raw video streaming.
- hidden WebView landmark extraction with MediaPipe Hands.
- backend landmark-based classification.

Not actually implemented:
- continuous on-device frame-native landmark extraction.
- end-to-end speech output in the active recognition path.
- sentence-level translation or language modeling.

The strongest proof is that the “live” path is a timer that repeatedly captures stills, reads them as files, then calls into a WebView and the backend; the Vision Camera frame processor is not used for ML inference ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L154), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L351)).

## 4. Training Pipeline

### Landmark training
Definitely implemented:
- Landmark samples are appended to `app/src/server/landmarks/<LABEL>.jsonl` via `/upload_landmarks` ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L451)).
- `/train_landmarks` loads all `A`-`Z` jsonl files, normalizes each sample, performs a train/test split, fits an RBF SVC, prints a classification report, and saves `asl_landmarks_model.joblib` ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L345), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L370)).
- The active mobile UI can capture and upload landmark samples and trigger this training from the app ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L171), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L224)).

Repo training data present now:
- Landmark dataset is substantial: 16,679 total samples across A-Z.
- Counts are uneven: e.g. `S:1177`, `F:1034`, `A:804`, `K:277`, `E:345`, `Z:362`.

### Gesture training
Definitely implemented:
- Gesture samples are appended to `app/src/server/gestures/<LABEL>.jsonl` via `/upload_gesture` ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L515)).
- `/train_gestures` resamples sequences, concatenates frame vectors, trains an RBF SVC, and persists `asl_gesture_model.joblib` ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L531), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L550)).
- The active mobile UI can record gesture samples and trigger gesture training ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L235), [CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L287)).

Repo training data present now:
- 530 total gesture samples across 11 labels in use.
- Distribution is thin and uneven: `THANK_YOU:95`, `YES:85`, `HELLO:82`, but `GOODBYE:6`.
- `PAKYU:3` exists on disk but is excluded from `GESTURE_LABELS`, so it is effectively orphaned.

### Pixel-model training
Partially implemented / legacy:
- There is still a pixel-image dataset path (`dataset/<LABEL>`), `/upload`, `/train`, and `/predict` using grayscale cropped `64x64` images and an SVC ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L242), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L413)).
- The active app does not use this path. The old `CameraScreen` can still invoke it from the archive, but `App.js` no longer routes there ([App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L123), [CameraScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/archive/recognition/CameraScreen.tsx#L158)).
- Pixel dataset in repo is only A/B/C with 640 total images, which is not a full alphabet training set.

## 5. Major Screens, Modules, and Services

### Mobile screens
- `VideoSplashScreen`: intro splash before auth, active but not analyzed deeply here.
- `DashboardScreen`: landing screen with “Start Camera,” tutorial, and feedback actions; claims “real-time sign language interpretation” in copy ([DashboardScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/DashboardScreen.tsx#L57)).
- `CameraScreenVC`: active recognition screen with letter mode, word mode, sample collection, training triggers, and status HUD ([CameraScreenVC.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/CameraScreenVC.tsx#L63)).
- `TutorialScreen`: static A-Z learning content backed by bundled images, not connected to recognition feedback loops ([TutorialScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/TutorialScreen.tsx#L1)).
- `FeedbackScreen`: anonymous feedback form with optional image attachments, posting to backend ([FeedbackScreen.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/src/screens/FeedbackScreen.tsx#L71)).

### ML / recognition modules
- `handLandmarksWebView.ts`: request/response wrapper around hidden WebView landmark extraction ([handLandmarksWebView.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handLandmarksWebView.ts#L23)).
- `handWebviewHtml.ts`: the real embedded MediaPipe Hands implementation used by the active app ([handWebviewHtml.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handWebviewHtml.ts#L1)).
- `smoother.ts`: simple majority-vote label smoother ([smoother.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/smoother.ts#L1)).
- `labels.ts`: alphabet label constants.
- `app/archive/recognition/recognizer.ts`: legacy/local fake recognizer based on dataset file counts, not a real ML inference path ([recognizer.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/archive/recognition/recognizer.ts#L9)).
- `dataset.ts`: local device dataset directory helper, mainly used by old/legacy flow ([dataset.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/dataset.ts#L6)).

### Backend services
- Recognition and training endpoints live in one file.
- Feedback/audit storage uses MongoDB and local upload directories.
- Admin auth is a shared-secret username/password issuing a JWT token.

### Admin app
- `/` is login or dashboard depending on localStorage token ([page.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/app/page.tsx#L7)).
- Dashboard has two tabs: feedback inbox and audit trail, with server-side filtering and CSV export ([AdminDashboard.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/components/AdminDashboard.tsx#L205), [AdminDashboard.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/components/AdminDashboard.tsx#L302)).
- `/download` serves a marketing/landing page, distinct from the admin dashboard ([download/page.tsx](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/app/download/page.tsx#L1)).

### Legacy / stale artifacts
- `app/archive/recognition/CameraScreen.tsx`: older expo-camera + inline WebView pipeline, archived and inactive.
- `app/archive/recognition/hand_webview.html`: placeholder file with “Paste MediaPipe code here,” archived and unused by the active app ([hand_webview.html](/home/fkrul3s47/Documents/Projects/SignSight/app/archive/recognition/hand_webview.html#L1)).
- `app/archive/auth/AuthGate.tsx`: older auth component with placeholder PIN flow, archived and inactive.
- `db.py` and `models.py`: empty files.
- `server_old.py`: old backend file in repo root `app/`, not part of active flow.

## 6. Current Constraints

### Environment and setup
Definitely required:
- Node/npm for the Expo app and admin app ([init.sh](/home/fkrul3s47/Documents/Projects/SignSight/init.sh#L71)).
- Python 3.10+ and a venv for FastAPI/scikit-learn backend ([init.sh](/home/fkrul3s47/Documents/Projects/SignSight/init.sh#L73), [requirements.txt](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/requirements.txt#L1)).
- MongoDB reachable at `MONGO_URI`; `run.sh` refuses to start if Mongo is unreachable ([run.sh](/home/fkrul3s47/Documents/Projects/SignSight/run.sh#L73), [run.sh](/home/fkrul3s47/Documents/Projects/SignSight/run.sh#L150)).
- Network access from device to backend using `EXPO_PUBLIC_API_BASE` LAN IP written to `app/.env.local` ([init.sh](/home/fkrul3s47/Documents/Projects/SignSight/init.sh#L75), [run.sh](/home/fkrul3s47/Documents/Projects/SignSight/run.sh#L145)).

Current config defaults:
- `MONGO_URI=mongodb://127.0.0.1:27017`
- `MONGO_DB=signsight`
- `JWT_SECRET=change_me_now`
- `ADMIN_USER=admin`
- `ADMIN_PASS=admin123`  
from [`app/src/server/.env`](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/.env#L1).

### Runtime constraints
- Mobile inference depends on loading MediaPipe JS from jsDelivr inside the WebView; this is a network/runtime dependency, not a bundled asset ([handWebviewHtml.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handWebviewHtml.ts#L16)).
- Recognition is HTTP-bound and backend-bound; there is no offline on-device classifier in the active path.
- CORS is fully open with `allow_origins=["*"]` ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L84)).
- Feedback/audit images are stored on local disk under `uploads/`, not object storage ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L43), [server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L121)).

## 7. Risks and Technical Debt

### Architectural risks
- The active “real-time” loop is expensive: snapshot -> filesystem -> base64 -> WebView -> backend request on a timer. This creates latency, CPU load, and battery pressure on-device.
- Backend inference/training runs synchronously in the FastAPI app process. Training endpoints can block request handling.
- Gesture prediction resets buffers aggressively and uses simple thresholds, so UX may be unstable for subtle signs.

### Product/claim mismatch
- UI and marketing say “real-time sign language interpretation,” but the implementation is closer to repeated still-image landmark classification with small-word support. There is no phrase-level translation, and the active screen does not speak results aloud.
- The admin landing page claims “Built with MediaPipe & TensorFlow,” but the backend is scikit-learn SVC-based and I did not find TensorFlow in the actual runtime stack.

### Security / operations debt
- Default admin credentials and weak default JWT secret are committed in `.env`.
- Admin token is stored in `localStorage`.
- CORS is open to all origins.
- Anonymous feedback endpoints are unauthenticated and unthrottled.
- Upload storage is local filesystem only.

### Code organization debt
- Active and legacy recognition paths coexist.
- `SignRecognizer` is misleading because it is not the actual recognizer used by the active app.
- `db.py`, `models.py`, and `hand_webview.html` are dead or placeholder files that increase ambiguity.
- The main backend file mixes ML logic, auth, admin APIs, upload handling, and startup side effects in one module.

## 8. Recommended Future Development Priorities

1. Consolidate to one recognition path.  
`CameraScreenVC` is the canonical camera experience. Older recognition/auth prototypes are now archived under `app/archive/`.

2. Make runtime claims match reality.  
Update UI and marketing language to say “snapshot-based live detection” or build true streaming/on-device inference before claiming full real-time translation.

3. Separate backend concerns.  
Split FastAPI into modules for recognition, training, feedback, audit, auth, and uploads. Move startup model-loading and config handling out of the route file.

4. Harden configuration and security.  
Require non-default `JWT_SECRET`, remove committed admin defaults, tighten CORS, and consider proper admin session handling.

5. Improve dataset hygiene and model lifecycle.  
Add dataset stats endpoints, validation for orphan labels like `PAKYU`, model versioning, and recorded metrics instead of only console output.

6. Reduce inference latency.  
If future work stays with MediaPipe in a WebView, at least profile and lower the snapshot/file/base64 overhead. Longer term, move landmark extraction to a native/on-device frame path or a more direct pipeline.

7. Clarify the product boundary for words vs letters.  
The repo currently supports alphabet letters plus a small fixed gesture set. Future work should decide whether the app is primarily fingerspelling recognition, small-vocabulary gesture recognition, or full ASL translation, because those are materially different systems.

## 9. Repo-Specific Guidance I Should Follow In Future Tasks

- Treat `CameraScreenVC` as the active recognition screen unless the task explicitly targets legacy code. `App.js` routes there, not to `CameraScreen` ([App.js](/home/fkrul3s47/Documents/Projects/SignSight/app/App.js#L123)).
- Assume the real inference path is backend landmark classification, not `SignRecognizer`.
- Preserve the hidden WebView handshake contract:
  - app sends `PROCESS` with `reqId` and data URL
  - WebView returns `READY` and `RESULT`  
  as defined in [handLandmarksWebView.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handLandmarksWebView.ts#L39) and [handWebviewHtml.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/src/ml/handWebviewHtml.ts#L122).
- When changing recognition logic, check both letter and word modes. They share capture but diverge in buffering, thresholds, and endpoints.
- When changing backend ML behavior, preserve landmark normalization semantics unless there is an explicit migration plan; handedness flipping is part of current model behavior ([server.py](/home/fkrul3s47/Documents/Projects/SignSight/app/src/server/server.py#L312)).
- When working on setup or DX, respect the repo-root scripts:
  - [init.sh](/home/fkrul3s47/Documents/Projects/SignSight/init.sh#L78) installs app/admin/backend deps and writes local env files.
  - [run.sh](/home/fkrul3s47/Documents/Projects/SignSight/run.sh#L163) starts backend, admin, and Expo together.
- When touching admin behavior, remember the admin app depends entirely on `NEXT_PUBLIC_API_BASE` and localStorage token auth ([api.ts](/home/fkrul3s47/Documents/Projects/SignSight/app/signsight-admin/src/lib/api.ts#L1)).
- Be skeptical of claims in README or marketing copy until they are verified against:
  - `App.js`
  - `CameraScreenVC.tsx`
  - `handWebviewHtml.ts`
  - `server.py`
