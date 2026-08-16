// Character-based chunking (not token-based) — simple and fast, tuned so
// chunks comfortably fit the embedding model's small 256-token context.
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length === 0) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    if (end < clean.length) {
      // Prefer breaking on a paragraph or sentence boundary near the target end.
      const searchWindow = clean.slice(start, end);
      const lastParagraph = searchWindow.lastIndexOf("\n\n");
      const lastSentence = searchWindow.lastIndexOf(". ");
      const breakAt = Math.max(lastParagraph, lastSentence);
      if (breakAt > chunkSize * 0.5) {
        end = start + breakAt + 1;
      }
    }
    const piece = clean.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);
    const next = end - overlap;
    start = next > start ? next : end;
  }
  return chunks;
}
