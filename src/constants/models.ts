export type CompatTier = "green" | "yellow" | "red";
export type ModelCapability = "text" | "vision";

export interface MmprojFile {
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  description: string;
  hfRepo: string;
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
  quant: string;
  paramCount: string;
  /** Total device RAM (GB) below which we show a red/yellow compatibility badge. */
  recommendedMinRamGB: number;
  contextWindowDefault: number;
  /** "vision" models can see attached images in chat — requires downloading an mmproj companion file too. */
  capability: ModelCapability;
  mmproj?: MmprojFile;
}

// Curated MVP catalog. Deliberately small — a handful of models known to run
// on weak/old hardware, picked and size-checked by hand rather than pulled
// live from the HF search API. Dynamic HF browsing comes later.
export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "smollm2-360m-q8",
    name: "SmolLM2 360M Instruct",
    description:
      "Hugging Face's smallest SmolLM2 model, trained on a curated mix of web text, code, and textbook-style data. Handles simple instructions and short Q&A reasonably well, but struggles with multi-step reasoning or long, coherent answers.",
    hfRepo: "HuggingFaceTB/SmolLM2-360M-Instruct-GGUF",
    filename: "smollm2-360m-instruct-q8_0.gguf",
    downloadUrl:
      "https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf",
    sizeBytes: 386_404_992,
    quant: "Q8_0",
    paramCount: "360M",
    recommendedMinRamGB: 2,
    contextWindowDefault: 2048,
    capability: "text",
  },
  {
    id: "qwen2.5-0.5b-q4km",
    name: "Qwen2.5 0.5B Instruct",
    description:
      "Alibaba's Qwen2.5 family at its smallest size, trained on a very large corpus spanning text, code, and many languages. Strong multilingual support and broad general knowledge relative to its size.",
    hfRepo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    sizeBytes: 491_400_032,
    quant: "Q4_K_M",
    paramCount: "0.5B",
    recommendedMinRamGB: 3,
    contextWindowDefault: 2048,
    capability: "text",
  },
  {
    id: "llama3.2-1b-q4km",
    name: "Llama 3.2 1B Instruct",
    description:
      "Meta's smallest Llama 3.2 model, distilled from larger Llama 3.1 models specifically for on-device use. Generally the most coherent of the curated models here at following multi-step instructions, at the cost of a bigger download and more RAM.",
    hfRepo: "hugging-quants/Llama-3.2-1B-Instruct-Q4_K_M-GGUF",
    filename: "llama-3.2-1b-instruct-q4_k_m.gguf",
    downloadUrl:
      "https://huggingface.co/hugging-quants/Llama-3.2-1B-Instruct-Q4_K_M-GGUF/resolve/main/llama-3.2-1b-instruct-q4_k_m.gguf",
    sizeBytes: 807_690_656,
    quant: "Q4_K_M",
    paramCount: "1B",
    recommendedMinRamGB: 4,
    contextWindowDefault: 2048,
    capability: "text",
  },
  {
    id: "smolvlm2-2.2b-q4km",
    name: "SmolVLM2 2.2B Instruct",
    description:
      "Hugging Face's SmolVLM2 — a SmolLM2 language backbone paired with a vision encoder, built for image understanding on resource-constrained devices. Handles scene description and general visual Q&A reasonably well; precise counting is still unreliable, a known limitation of small vision models generally.",
    hfRepo: "ggml-org/SmolVLM2-2.2B-Instruct-GGUF",
    filename: "SmolVLM2-2.2B-Instruct-Q4_K_M.gguf",
    downloadUrl: "https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/resolve/main/SmolVLM2-2.2B-Instruct-Q4_K_M.gguf",
    sizeBytes: 1_112_602_656,
    quant: "Q4_K_M",
    paramCount: "2.2B",
    recommendedMinRamGB: 6,
    contextWindowDefault: 2048,
    capability: "vision",
    mmproj: {
      filename: "mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf",
      downloadUrl: "https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/resolve/main/mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf",
      sizeBytes: 592_523_200,
    },
  },
];
