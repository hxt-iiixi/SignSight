import { create } from "zustand";

import type { PredictionViewModel } from "../../../shared/types/mobile";

const INITIAL_PREDICTION: PredictionViewModel = {
  label: "Ready",
  confidence: 0,
  rawLabel: "?",
  handedness: null,
  hasHand: false,
};

type LabCaptureState = {
  prediction: PredictionViewModel;
  setPrediction: (prediction: PredictionViewModel) => void;
};

export const useLabCaptureStore = create<LabCaptureState>((set) => ({
  prediction: INITIAL_PREDICTION,
  setPrediction: (prediction) => set({ prediction }),
}));
