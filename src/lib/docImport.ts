import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

export interface ImportedDocument {
  title: string;
  text: string;
  truncated: boolean;
}

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown"];

function stripExtension(filename: string): string {
  return filename.replace(/\.[^./]+$/, "");
}

function extensionOf(filename: string, mimeType: string | null | undefined): string {
  const match = filename.match(/\.[^./]+$/);
  if (match) return match[0].toLowerCase();
  // Some SAF providers omit an extension from the display name — fall back to mimeType.
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "text/markdown") return ".md";
  if (mimeType === "text/plain") return ".txt";
  return "";
}

async function extractPdfText(file: File): Promise<string> {
  // pdfjs-dist does browser sniffing on navigator.userAgent/navigator.platform
  // at module load — RN only polyfills a bare `navigator` object without
  // either, so those reads throw unless stubbed in first. Also imported
  // lazily (not at module top level) so opening the Sources screen doesn't
  // eagerly evaluate pdfjs at all unless a PDF is actually picked.
  const nav = globalThis.navigator as unknown as Record<string, unknown> | undefined;
  if (nav) {
    for (const key of ["userAgent", "platform", "vendor", "appVersion"]) {
      if (!nav[key]) {
        Object.defineProperty(nav, key, { value: "ReactNative", configurable: true, writable: true });
      }
    }
  }
  // Pinned to the pre-ESM-rewrite legacy build (2.16.x) — it runs synchronously
  // on the main thread without a Worker (RN/Hermes has no Worker global), and
  // doesn't reach for modern browser APIs (structuredClone, DOMMatrix) that
  // newer pdfjs-dist versions assume are present.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
  // pdfjs always reads GlobalWorkerOptions.workerSrc when constructing a
  // PDFWorker — and that read throws outside its own try/catch if unset, so
  // "disable the worker" isn't actually an option. Its documented no-worker
  // fallback is instead to pre-register the worker module's own exports on
  // globalThis.pdfjsWorker, which pdfjs checks first and, if present, uses
  // directly on the main thread without ever touching workerSrc.
  if (!(globalThis as any).pdfjsWorker) {
    (globalThis as any).pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker");
  }
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }
  return pages.join("\n\n");
}

/**
 * Opens the system file picker and extracts plain text from the selection.
 * Supports .txt/.md directly and .pdf via on-device text extraction —
 * the original file is never stored, only the extracted text.
 *
 * Uses expo-document-picker (not expo-file-system's File.pickFileAsync) —
 * the latter reconstructs name/extension by parsing the picked content://
 * URI, which never contains a filename on Android SAF, so it's always empty.
 * expo-document-picker reports the real display name and mimeType directly.
 */
export async function pickAndImportDocument(maxChars: number): Promise<ImportedDocument | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["text/plain", "text/markdown", "application/pdf"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const asset = picked.assets[0];
  const extension = extensionOf(asset.name, asset.mimeType);
  const title = stripExtension(asset.name);
  const file = new File(asset.uri);

  let text: string;
  if (extension === ".pdf") {
    text = await extractPdfText(file);
  } else if (TEXT_EXTENSIONS.includes(extension)) {
    const buffer = await file.arrayBuffer();
    text = new TextDecoder("utf-8").decode(buffer);
  } else {
    throw new Error(`Unsupported file type: ${extension || "unknown"}`);
  }

  text = text.trim();
  const truncated = text.length > maxChars;
  return { title, text: truncated ? text.slice(0, maxChars) : text, truncated };
}
