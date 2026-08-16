import { getTotalMemory } from "react-native-device-info";
import type { CompatTier, ModelCatalogEntry } from "../constants/models";

let cachedTotalRamBytes: number | null = null;

/**
 * Total physical RAM on the device. There is no reliable cross-platform way
 * to read *currently free* RAM (it's volatile and Android/iOS expose it
 * differently), so the MVP compatibility badge uses total RAM as a stable,
 * honest proxy instead. Real free-RAM checks at model-load time are a
 * native-bridge task for later (see the EdgeMind memory-guard idea).
 */
export async function getDeviceRamBytes(): Promise<number> {
  if (cachedTotalRamBytes === null) {
    cachedTotalRamBytes = await getTotalMemory();
  }
  return cachedTotalRamBytes;
}

export function bytesToGB(bytes: number): number {
  return bytes / 1024 ** 3;
}

export function getCompatibility(
  model: ModelCatalogEntry,
  deviceRamBytes: number
): CompatTier {
  return compatibilityForMinRam(model.recommendedMinRamGB, bytesToGB(deviceRamBytes));
}

/**
 * Same compatibility badge logic, but for models without a hand-curated
 * recommendedMinRamGB (e.g. anything found via Hugging Face search).
 * Estimates required RAM from the file size alone: inference needs the
 * weights plus room for the KV cache and buffers, roughly 1.2x the file
 * on disk for typical context sizes.
 */
export function getCompatibilityForSize(sizeBytes: number, deviceRamBytes: number): CompatTier {
  const estimatedMinRamGB = (sizeBytes * 1.2) / 1024 ** 3;
  return compatibilityForMinRam(estimatedMinRamGB, bytesToGB(deviceRamBytes));
}

function compatibilityForMinRam(minRamGB: number, deviceRamGB: number): CompatTier {
  if (deviceRamGB >= minRamGB) return "green";
  if (deviceRamGB >= minRamGB - 1) return "yellow";
  return "red";
}

/** Shrinks the context window on RAM-constrained devices to avoid OOM kills. */
export function recommendedContextTokens(
  deviceRamBytes: number,
  defaultCtx: number
): number {
  const deviceRamGB = bytesToGB(deviceRamBytes);
  if (deviceRamGB < 2) return 512;
  if (deviceRamGB < 3) return 1024;
  return defaultCtx;
}
