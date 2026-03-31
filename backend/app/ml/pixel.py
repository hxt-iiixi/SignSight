import base64
import io

import numpy as np
from PIL import Image

from app.core.constants import IMG_SIZE


def clean_base64(data: str) -> str:
    if "," in data:
        return data.split(",", 1)[1]
    return data


def image_from_base64(data: str) -> Image.Image:
    raw = base64.b64decode(clean_base64(data))
    return Image.open(io.BytesIO(raw))


def preprocess(img: Image.Image) -> np.ndarray:
    img = img.convert("L")

    w, h = img.size
    crop_ratio = 0.65
    cw, ch = int(w * crop_ratio), int(h * crop_ratio)
    left = (w - cw) // 2
    top = (h - ch) // 2
    img = img.crop((left, top, left + cw, top + ch))

    img = img.resize(IMG_SIZE)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr.flatten()
