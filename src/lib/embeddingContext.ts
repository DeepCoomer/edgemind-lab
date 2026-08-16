import { initLlama, type LlamaContext } from "llama.rn";

// Independent from the chat model's context (src/lib/llamaContext.ts) — this
// embedding model is small enough to stay loaded alongside the chat model
// rather than swapping the chat model out every time a source is indexed
// or a message needs retrieval.
let activeContext: LlamaContext | null = null;
let activeModelPath: string | null = null;

export async function loadEmbeddingModel(modelPath: string, onProgress?: (progress: number) => void): Promise<LlamaContext> {
  if (activeContext && activeModelPath === modelPath) {
    return activeContext;
  }
  if (activeContext) {
    await activeContext.release();
    activeContext = null;
  }
  const context = await initLlama(
    {
      model: modelPath,
      n_ctx: 256,
      n_threads: 2,
      embedding: true,
      embd_normalize: 2,
    },
    onProgress
  );
  activeContext = context;
  activeModelPath = modelPath;
  return context;
}

export function isEmbeddingModelLoaded(): boolean {
  return activeContext !== null;
}

export async function embedText(text: string): Promise<number[]> {
  if (!activeContext) throw new Error("Embedding model not loaded");
  const result = await activeContext.embedding(text);
  return result.embedding;
}
