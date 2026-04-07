LETTER_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
MOTION_ONLY_LETTER_LABELS = ["J", "Z"]
LABELS = [label for label in LETTER_LABELS if label not in MOTION_ONLY_LETTER_LABELS]
IMG_SIZE = (64, 64)

GESTURE_LABELS = [
    "HELLO",
    "THANK_YOU",
    "SORRY",
    "PLEASE",
    "YES",
    "NO",
    "HELP",
    "GOODBYE",
    "WHAT",
    "WHERE",
    "J",
    "Z",
]
STATIC_WORD_LABELS = ["I_LOVE_YOU"]
GESTURE_FRAMES = 8
AUDIT_CATEGORIES = ["ui", "bug", "performance", "feature", "security", "other"]
