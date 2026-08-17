import { Directory, File, Paths, type DownloadTask } from "expo-file-system";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { MODEL_CATALOG } from "../constants/models";
import { EMBEDDING_MODEL } from "../constants/embeddingModel";
import { WHISPER_MODEL } from "../constants/whisperModel";

// Support models (embedding, whisper) and mmproj companion files share
// modelsDir with chat models for simplicity, but aren't valid chat-model
// selections on their own — exclude them from any "pick a chat model" listing.
const SUPPORT_MODEL_FILENAMES = new Set([
  EMBEDDING_MODEL.filename,
  WHISPER_MODEL.filename,
  ...MODEL_CATALOG.filter((m) => m.mmproj).map((m) => m.mmproj!.filename),
]);

// Maps a vision model's main filename to its mmproj companion filename, so
// generic "pick any downloaded model" flows (New Chat, Quick Actions, Live
// Tuning, Model Compare) still recognize it as vision-capable.
const MMPROJ_BY_MODEL_FILENAME = new Map(
  MODEL_CATALOG.filter((m) => m.mmproj).map((m) => [m.filename, m.mmproj!.filename])
);

export interface DownloadableFile {
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
}

export const modelsDir = new Directory(Paths.document, "models");

function ensureModelsDir() {
  if (!modelsDir.exists) {
    modelsDir.create({ intermediates: true });
  }
}

export function localFileFor(filename: string): File {
  return new File(modelsDir, filename);
}

export function isDownloaded(model: DownloadableFile): boolean {
  const file = localFileFor(model.filename);
  // Cheap integrity check: the known-good size from the catalog must match
  // exactly, so a partial/interrupted download never reads as "ready".
  return file.exists && file.size === model.sizeBytes;
}

export interface DownloadHandle {
  task: DownloadTask;
  promise: Promise<File | null>;
}

export function startDownload(
  model: DownloadableFile,
  onProgress: (fraction: number) => void
): DownloadHandle {
  ensureModelsDir();
  const destination = localFileFor(model.filename);
  if (destination.exists) destination.delete();

  // The native download (OkHttp, in-process) has no foreground service or
  // wake lock behind it, so on many Android devices the OS freezes it soon
  // after the screen turns off. Keeping the screen on for the duration of
  // the download is a cheap way to avoid that for the common case — it
  // doesn't help if the user manually locks the phone, but does stop the
  // normal screen-timeout from killing a multi-hundred-MB download. Each
  // call gets its own tag so concurrent downloads (e.g. a vision model's
  // main + mmproj files) don't deactivate each other's lock early.
  const keepAwakeTag = `model-download-${model.filename}-${Date.now()}`;
  activateKeepAwakeAsync(keepAwakeTag);

  const task = File.createDownloadTask(model.downloadUrl, destination, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress(bytesWritten / totalBytes);
    },
  });
  const promise = task
    .downloadAsync()
    .catch((error) => {
      // On Android, a cancelled or failed download can leave a partial file at
      // the destination — clean it up so it never gets picked up elsewhere as
      // a "downloaded" model.
      if (destination.exists) destination.delete();
      throw error;
    })
    .finally(() => deactivateKeepAwake(keepAwakeTag));
  return { task, promise };
}

export function deleteDownloadedModel(model: DownloadableFile) {
  const file = localFileFor(model.filename);
  if (file.exists) file.delete();
}

export interface DownloadedModel {
  path: string;
  filename: string;
  sizeBytes: number;
  /** Set only when this is a vision model and its mmproj companion is also downloaded. */
  mmprojPath?: string;
}

function labelFromFilename(filename: string): string {
  return filename
    .replace(/\.gguf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// No real quantized chat model is anywhere near this small — anything below
// it is a leftover partial file from a cancelled/failed download (mainly
// relevant for files downloaded before startDownload started cleaning up
// after itself).
const MIN_PLAUSIBLE_MODEL_BYTES = 50 * 1024 * 1024;

/** Scans modelsDir directly so it picks up models from any source — curated catalog, HF search, or manual import. */
export function listDownloadedModels(): (DownloadedModel & { label: string })[] {
  if (!modelsDir.exists) return [];
  return modelsDir
    .list()
    .filter(
      (entry): entry is File =>
        entry instanceof File &&
        entry.name.toLowerCase().endsWith(".gguf") &&
        !SUPPORT_MODEL_FILENAMES.has(entry.name) &&
        (entry.size ?? 0) >= MIN_PLAUSIBLE_MODEL_BYTES
    )
    .map((file) => {
      const mmprojFilename = MMPROJ_BY_MODEL_FILENAME.get(file.name);
      const mmprojFile = mmprojFilename ? localFileFor(mmprojFilename) : null;
      return {
        path: file.uri,
        filename: file.name,
        sizeBytes: file.size ?? 0,
        label: labelFromFilename(file.name),
        mmprojPath: mmprojFile?.exists ? mmprojFile.uri : undefined,
      };
    });
}

/** Removes any .gguf file in modelsDir by absolute path — used to clean up unwanted/orphaned files directly from a model picker. */
export function deleteModelFile(path: string) {
  const file = new File(path);
  if (file.exists) file.delete();
}

/**
 * Copies a manually-imported .gguf file into modelsDir so it's picked up by
 * listDownloadedModels() like any other model, instead of only living as
 * transient screen state pointing at wherever the picker returned it from.
 *
 * displayName should come from the picker's own metadata (e.g.
 * expo-document-picker's DocumentPickerAsset.name), not source.name — on
 * Android, source.name is reconstructed by parsing the picked content://
 * URI, which never contains a real filename for most SAF providers.
 */
export function importModelFile(source: File, displayName: string): File {
  ensureModelsDir();
  const safeName = /\.gguf$/i.test(displayName) ? displayName : `${displayName}.gguf`;
  const destination = localFileFor(safeName);
  if (destination.exists) destination.delete();
  source.copySync(destination);
  return destination;
}
