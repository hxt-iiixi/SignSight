from typing import Optional

import joblib
import numpy as np
from PIL import Image
from sklearn.svm import SVC

from app.core.constants import LABELS
from app.core.paths import DATASET_DIR, MODEL_PATH
from app.ml.pixel import image_from_base64, preprocess


pixel_model: Optional[SVC] = None
train_count = 0
class_counts: dict[str, int] = {}


def load_dataset():
    X, y = [], []
    for label in LABELS:
        folder = DATASET_DIR / label
        if not folder.is_dir():
            continue

        files = [f for f in folder.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png"]]
        files = files[:500]

        for path in files:
            try:
                with Image.open(path) as pil:
                    X.append(preprocess(pil))
                    y.append(label)
            except Exception:
                pass

    return np.array(X), np.array(y)


def train_model() -> bool:
    global pixel_model, train_count, class_counts
    X_train, y_train = load_dataset()
    train_count = int(len(X_train))
    class_counts = {label: 0 for label in LABELS}
    for label in y_train:
        class_counts[label] += 1

    print("DEBUG: images found =", len(X_train))
    if len(X_train) == 0:
        print("⚠️ No images found in ./dataset/<LABEL>. Add images to train.")
        pixel_model = None
        return False

    model = SVC(kernel="rbf", probability=True, gamma="scale", C=10)
    model.fit(X_train, y_train)
    pixel_model = model
    joblib.dump(pixel_model, MODEL_PATH)
    print(f"✅ Trained on {len(X_train)} images")
    return True


def bootstrap_pixel_model() -> None:
    global pixel_model
    if MODEL_PATH.exists():
        pixel_model = joblib.load(MODEL_PATH)
        print("✅ Loaded pixel model from disk")
    else:
        train_model()


def predict_from_base64(image_base64: str) -> dict:
    global pixel_model
    if pixel_model is None:
        return {"label": "NO_MODEL", "confidence": 0.0}

    pil = image_from_base64(image_base64)
    vec = preprocess(pil).reshape(1, -1)
    pred = pixel_model.predict(vec)[0]
    prob = float(np.max(pixel_model.predict_proba(vec)))
    return {"label": pred, "confidence": prob}


def upload_training_image(label: str, image_base64: str) -> dict:
    normalized_label = label.strip().upper()
    if normalized_label not in LABELS:
        return {"ok": False, "error": f"Invalid label: {normalized_label}"}

    target_dir = DATASET_DIR / normalized_label
    target_dir.mkdir(parents=True, exist_ok=True)

    pil = image_from_base64(image_base64).convert("RGB")
    filename = f"{normalized_label}_{len(list(target_dir.iterdir()))}.jpg"
    path = target_dir / filename
    pil.save(path, format="JPEG", quality=90)
    return {"ok": True, "saved": str(path)}


def health_summary() -> dict:
    return {
        "trained_pixels": pixel_model is not None,
        "pixel_train_count": train_count,
        "pixel_class_counts": dict(list(class_counts.items())[:6]),
    }
