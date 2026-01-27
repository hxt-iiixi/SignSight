import * as FileSystem from "expo-file-system/legacy";
import { ASL_LABELS } from "./labels";

const FS = FileSystem as any;

export const getDatasetRoot = () => {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  return base ? `${base}dataset` : "No base directory";
};


export async function ensureDatasetRoot(): Promise<void> {
  const root = getDatasetRoot();
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
}

export async function getClipCounts(): Promise<Record<string, number>> {
  await ensureDatasetRoot();
  const root = getDatasetRoot();

  const counts: Record<string, number> = {};

  for (const label of ASL_LABELS) {
    const dir = `${root}/${label}`;
    const info = await FileSystem.getInfoAsync(dir);

    if (!info.exists) {
      counts[label] = 0;
      continue;
    }

    const files = await FileSystem.readDirectoryAsync(dir);

    // ✅ count photos now (jpg/jpeg)
    counts[label] = files.filter((f) => {
      const lower = f.toLowerCase();
      return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
    }).length;
  }

  return counts;
}
