export const ASL_LABELS = [
  "A","B","C","D","E","F","G","H","I","J",
  "K","L","M","N","O","P","Q","R","S","T",
  "U","V","W","X","Y","Z",
] as const;

export type AslLabel = (typeof ASL_LABELS)[number];
