import { initLlama, type LlamaContext } from "llama.rn";

let activeContext: LlamaContext | null = null;
let activeModelPath: string | null = null;
let activeMmprojPath: string | null = null;
let activeConversationId: string | null = null;

export async function loadModel(
  modelPath: string,
  contextSize: number,
  onProgress?: (progress: number) => void,
  mmprojPath?: string
): Promise<LlamaContext> {
  if (activeContext && activeModelPath === modelPath && activeMmprojPath === (mmprojPath ?? null)) {
    return activeContext;
  }
  await unloadModel();

  const context = await initLlama(
    {
      model: modelPath,
      n_ctx: contextSize,
      n_threads: 4,
    },
    onProgress
  );
  if (mmprojPath) {
    await context.initMultimodal({ path: mmprojPath, use_gpu: true });
  }
  activeContext = context;
  activeModelPath = modelPath;
  activeMmprojPath = mmprojPath ?? null;
  activeConversationId = null;
  return context;
}

export async function unloadModel() {
  if (activeContext) {
    await activeContext.release();
  }
  activeContext = null;
  activeModelPath = null;
  activeMmprojPath = null;
  activeConversationId = null;
}

/**
 * Call before generating in a given conversation thread. The same loaded
 * model context is reused across threads, but llama.rn's KV cache carries
 * state between calls — switching threads without clearing it contaminates
 * output with the previous conversation's context.
 */
export async function prepareForConversation(conversationId: string) {
  if (!activeContext) return;
  if (activeConversationId !== null && activeConversationId !== conversationId) {
    await activeContext.clearCache();
  }
  activeConversationId = conversationId;
}
