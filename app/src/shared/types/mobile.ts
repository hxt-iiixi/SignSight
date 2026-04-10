export type TranslatorMode = "LETTERS" | "WORDS";

export type HandednessValue = "Left" | "Right" | null;

export type PredictionViewModel = {
  label: string;
  confidence: number;
  rawLabel: string;
  handedness: HandednessValue;
  hasHand: boolean;
};

export type LandmarkTrainingMode = "bootstrap" | "full_reviewed";

export type ActiveModelSummary = {
  versionId: string | null;
  label: string;
  trainingMode?: LandmarkTrainingMode;
};

export type CaptureSessionDraft = {
  signerId: string;
  captureSessionId: string;
  variantTags: string[];
};

export type LabWorkspaceTab = "capture" | "dataset" | "models" | "metrics";
