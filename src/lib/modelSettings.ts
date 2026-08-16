import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ModelSettings {
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  systemPrompt: "",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 512,
};

function keyFor(modelPath: string): string {
  return `edgemind:modelSettings:${modelPath}`;
}

export async function getModelSettings(modelPath: string): Promise<ModelSettings> {
  const raw = await AsyncStorage.getItem(keyFor(modelPath));
  if (!raw) return DEFAULT_MODEL_SETTINGS;
  return { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(raw) };
}

export async function saveModelSettings(modelPath: string, settings: ModelSettings): Promise<void> {
  await AsyncStorage.setItem(keyFor(modelPath), JSON.stringify(settings));
}
