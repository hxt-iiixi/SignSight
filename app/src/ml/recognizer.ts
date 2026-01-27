import { ASL_LABELS, type AslLabel } from "./labels";
import { getClipCounts } from "./dataset";

export type RecognitionResult = {
  label: AslLabel;
  confidence: number;
};

export class SignRecognizer {
  public lastConfidence: number = 0;
  async recognize(): Promise<RecognitionResult> {
    const counts = await getClipCounts();

    let bestLabel: AslLabel = ASL_LABELS[0];
    let bestCount = -1;

    for (const label of ASL_LABELS) {
      const c = counts[label] ?? 0;
      if (c > bestCount) {
        bestCount = c;
        bestLabel = label;
      }
    }
    this.lastConfidence = Math.min(0.95, 0.5 + bestCount / 50);
    return {
      label: bestLabel,
      confidence: Math.min(0.95, 0.5 + bestCount / 50),
    };
  }
}
