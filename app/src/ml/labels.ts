export const ASL_LABELS = [
  "A","B","C"
] as const;

export type AslLabel = (typeof ASL_LABELS)[number];
