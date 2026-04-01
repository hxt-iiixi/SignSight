export const ASL_LABELS = [
  "A","B","C","D","E","F","G","H","I","J",
  "K","L","M","N","O","P","Q","R","S","T",
  "U","V","W","X","Y","Z",
] as const;

export const STATIC_ASL_LABELS = ASL_LABELS.filter(
  (label) => label !== "J" && label !== "Z"
) as readonly Exclude<(typeof ASL_LABELS)[number], "J" | "Z">[];

export type AslLabel = (typeof ASL_LABELS)[number];
