import type { DownloadableFile } from "../lib/modelStore";

// Curated speech-to-text model — English-only "base" size strikes a good
// balance of accuracy vs. download size for voice dictation on old phones.
export const WHISPER_MODEL: DownloadableFile & { label: string } = {
  filename: "ggml-base.en.bin",
  downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
  sizeBytes: 147_964_211,
  label: "Whisper base.en",
};
