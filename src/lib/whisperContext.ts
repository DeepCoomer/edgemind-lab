// whisper.rn's package.json "exports" map covers subpaths but not the bare
// package root, so a plain `from "whisper.rn"` fails to resolve under
// exports-aware resolution (both tsc and Metro) — importing the indexed
// subpath explicitly routes around that gap.
import { initWhisper, type WhisperContext } from "whisper.rn/index";

let activeContext: WhisperContext | null = null;
let activeModelPath: string | null = null;

export async function loadWhisperModel(modelPath: string): Promise<WhisperContext> {
  if (activeContext && activeModelPath === modelPath) {
    return activeContext;
  }
  if (activeContext) {
    await activeContext.release();
    activeContext = null;
  }
  const context = await initWhisper({ filePath: modelPath });
  activeContext = context;
  activeModelPath = modelPath;
  return context;
}

export async function transcribeFile(fileUri: string): Promise<string> {
  if (!activeContext) throw new Error("Whisper model not loaded");
  const { promise } = activeContext.transcribe(fileUri, { language: "en" });
  const result = await promise;
  return result.result.trim();
}
