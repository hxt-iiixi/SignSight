# SignSight (ASL Recognition App)

SignSight is an Expo + React Native app that recognizes ASL letters using **hand landmarks (21 points)** extracted by **MediaPipe Hands** running inside a hidden WebView.

**Pipeline:**  
Camera snapshot → Base64 → WebView (MediaPipe Hands) → 21 landmarks → FastAPI backend → ML prediction

> “Live” tracking (optional) is implemented via rapid snapshots (~5 FPS), not true video.

---

## Tech Stack

- **Frontend:** Expo + React Native
- **Camera:** `expo-camera`
- **Hand landmarks:** `react-native-webview` + MediaPipe Hands (CDN)
- **Video splash (optional):** `expo-av`
- **Icons (dashboard):** `@expo/vector-icons`
- **Backend:** FastAPI + scikit-learn (KNN / SVC), joblib

---

## Project Structure

```text
src/
├─ screens/
│  ├─ CameraScreenVC.tsx      # Canonical camera recognition UI
│  ├─ DashboardScreen.tsx     # Post-auth dashboard
│  └─ VideoSplashScreen.tsx   # Video splash before biometrics
│
├─ ml/
│  ├─ labels.ts
│  ├─ smoother.ts
│  └─ dataset.ts
│
└─ server/
   ├─ server.py               # FastAPI backend
   ├─ dataset/                # Image dataset (A/B/C)
   └─ landmarks/              # Landmark jsonl + trained model
```

Legacy recognition and auth prototypes are stored under `app/archive/`.

---

## Requirements

### Frontend (Expo)
- Node.js (LTS recommended)
- npm or yarn
- Expo CLI (via `npx expo`)

### Backend (FastAPI)
- Python **3.10+**
- pip
- virtual environment (`venv`)

---

## Quick Start

Install local prerequisites first:
- Node.js 20 LTS+
- npm
- Python 3.10+
- MongoDB running locally

From the repo root:

```bash
./init.sh
./run.sh
```

`./init.sh` installs the Expo app, the admin app, and the backend virtualenv. It also writes local env files for:
- mobile app API base in `app/.env.local`
- admin API base in `app/signsight-admin/.env.local`

`./run.sh` starts:
- FastAPI backend on `http://127.0.0.1:8000`
- Next admin app on `http://localhost:3000`
- Expo dev server for the mobile app

If MongoDB is not already running, `./run.sh` will stop and tell you to start it first.

---

## Required Frontend Packages

```bash
npx expo install expo-camera
npx expo install expo-av
npx expo install react-native-webview
npx expo install react-native-svg
npx expo install @expo/vector-icons
npx expo install expo-local-authentication
```

---

## Important: Mobile Backend URL

The mobile app reads `EXPO_PUBLIC_API_BASE` from `app/.env.local`, which `./init.sh` and `./run.sh` generate automatically using your current LAN IP.

Phone and PC still need to be on the same Wi-Fi network for the mobile app to reach the backend.

---

## API Endpoints

### Landmarks Workflow

- **POST `/upload_landmarks`**  
  Saves landmarks to:
  ```
  src/server/landmarks/<LABEL>.jsonl
  ```

- **POST `/predict_landmarks`**  
  Returns:
  ```json
  { "label": "A", "confidence": 0.97 }
  ```

- **POST `/train_landmarks`**  
  Trains landmarks model and saves `asl_landmarks_model.joblib`

---

## Common Issues

### Phone can’t reach backend
- Use LAN IP, not `localhost`
- Same Wi-Fi network
- Allow port 8000 through firewall

### Android SVG crash
```bash
npx expo install react-native-svg
npx expo run:android
```

### Video splash not playing
- Convert `.MOV` → `.mp4`
- Keep video inside `assets/`
- Load via `require(...)`

---

## Notes

- MediaPipe runs fully inside WebView
- Backend learns from **landmarks**, not pixels
- “Live” mode uses snapshot polling, not video

---

## License

For academic / project use.
