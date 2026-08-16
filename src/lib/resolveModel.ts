import type { ModelRef } from "./chatStore";
import { getDeviceRamBytes, recommendedContextTokens } from "./device";
import { getModelSettings } from "./modelSettings";
import type { DownloadedModel } from "./modelStore";

/** Builds a full ModelRef (path + context size + saved settings) from a bare downloaded-model entry. */
export async function resolveModelRef(model: DownloadedModel & { label: string }): Promise<ModelRef> {
  const deviceRamBytes = await getDeviceRamBytes();
  const contextSize = recommendedContextTokens(deviceRamBytes, 2048);
  const settings = await getModelSettings(model.path);
  return { path: model.path, label: model.label, contextSize, mmprojPath: model.mmprojPath, ...settings };
}
