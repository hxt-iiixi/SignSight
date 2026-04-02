/**
 * Shared design tokens for the Developer Lab.
 *
 * Warm, internal-tool aesthetic:
 *   warm off-white surfaces, white elevated cards,
 *   warm orange accents, calm semantic feedback,
 *   rounded corners, premium internal product feel.
 */

// ── Brand / accent ──────────────────────────────────────────────
export const ACCENT = "#E67E22";
export const ACCENT_LIGHT = "#FFF3E0";
export const ACCENT_BORDER = "rgba(230,126,34,0.30)";

// ── Surfaces ────────────────────────────────────────────────────
export const BG = "#FFF9F2";
export const BG_CARD = "#FFFFFF";
export const BG_MUTED = "#F5F1EB";
export const BG_OVERLAY = "rgba(255,255,255,0.94)";

// ── Text ────────────────────────────────────────────────────────
export const TEXT = "#1F2937";
export const TEXT_SECONDARY = "#6B7280";
export const TEXT_TERTIARY = "#9CA3AF";

// ── Borders ─────────────────────────────────────────────────────
export const BORDER = "#E5E7EB";
export const BORDER_LIGHT = "rgba(229,231,235,0.65)";

// ── Semantic ────────────────────────────────────────────────────
export const SUCCESS = "#16A34A";
export const SUCCESS_LIGHT = "#F0FDF4";
export const SUCCESS_BORDER = "rgba(22,163,74,0.25)";

export const WARNING = "#D97706";
export const WARNING_LIGHT = "#FFFBEB";
export const WARNING_BORDER = "rgba(217,119,6,0.25)";

export const INFO = "#2563EB";
export const INFO_LIGHT = "#EFF6FF";
export const INFO_BORDER = "rgba(37,99,235,0.20)";

export const DANGER = "#DC2626";
export const DANGER_LIGHT = "#FEF2F2";
export const DANGER_BORDER = "rgba(220,38,38,0.25)";

export const RECORDING = "#DC2626";
export const RECORDING_LIGHT = "#FEE2E2";
export const RECORDING_BORDER = "rgba(220,38,38,0.35)";

// ── Spacing ─────────────────────────────────────────────────────
export const RADIUS_SM = 12;
export const RADIUS_MD = 16;
export const RADIUS_LG = 20;
export const RADIUS_XL = 24;
export const RADIUS_PILL = 999;

export const PAD_XS = 6;
export const PAD_SM = 10;
export const PAD_MD = 14;
export const PAD_LG = 18;

// ── Shadow (Android elevation + iOS shadow) ─────────────────────
export const CARD_SHADOW = {
  android: { elevation: 4 },
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
} as const;

export const ELEVATED_SHADOW = {
  android: { elevation: 8 },
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
} as const;
