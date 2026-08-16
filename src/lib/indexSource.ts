import { chunkText } from "./chunking";
import { embedText } from "./embeddingContext";
import { saveChunksForSource, type Chunk } from "./embeddingsStore";
import { setChunkCount, type Source } from "./sourcesStore";

/** Chunks + embeds a source's text, storing vectors for later retrieval. Requires the embedding model to already be loaded. */
export async function indexSource(source: Source): Promise<number> {
  const pieces = chunkText(source.text);
  const chunks: Chunk[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const vector = await embedText(pieces[i]);
    chunks.push({ id: `${source.id}-${i}`, sourceId: source.id, text: pieces[i], vector });
  }
  await saveChunksForSource(source.id, chunks);
  await setChunkCount(source.id, chunks.length);
  return chunks.length;
}
