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
│  ├─ CameraScreen.tsx        # Camera, landmarks, detection UI
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

## Install & Run (Frontend)

```bash
npm install
npx expo start -c
```

Run on:
- Android Emulator
- Physical phone via Expo Go or Dev Build

---

## Install & Run (Backend)

```bash
cd src/server
python -m venv .venv
```

### Activate virtual environment

**Windows (PowerShell)**
```bash
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
source .venv/bin/activate
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Run FastAPI server
```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Health check:
```
http://<YOUR_PC_IP>:8000/health
```

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

## Important: SERVER_URL

In `src/screens/CameraScreen.tsx`:

```ts
const SERVER_URL = "http://<YOUR_PC_IP>:8000";
```

Example:
```ts
const SERVER_URL = "http://192.168.1.7:8000";
```

Phone and PC must be on the same Wi-Fi network.

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
