import type { DownloadableFile } from "../lib/modelStore";

// Curated, tiny embedding model used to power retrieval over Sources — a
// separate model from chat, picked for size (fits comfortably alongside a
// loaded chat model on low-RAM phones) rather than max embedding quality.
export const EMBEDDING_MODEL: DownloadableFile & { label: string; dims: number } = {
  filename: "all-MiniLM-L6-v2.Q8_0.gguf",
  downloadUrl: "https://huggingface.co/leliuga/all-MiniLM-L6-v2-GGUF/resolve/main/all-MiniLM-L6-v2.Q8_0.gguf",
  sizeBytes: 25_008_064,
  label: "all-MiniLM-L6-v2",
  dims: 384,
};
