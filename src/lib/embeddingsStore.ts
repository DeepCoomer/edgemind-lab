import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Chunk {
  id: string;
  sourceId: string;
  text: string;
  vector: number[];
}

const CHUNKS_KEY = "edgemind:chunks";

async function readChunks(): Promise<Chunk[]> {
  const raw = await AsyncStorage.getItem(CHUNKS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeChunks(chunks: Chunk[]): Promise<void> {
  await AsyncStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
}

export async function saveChunksForSource(sourceId: string, chunks: Chunk[]): Promise<void> {
  const all = await readChunks();
  const rest = all.filter((c) => c.sourceId !== sourceId);
  await writeChunks([...rest, ...chunks]);
}

export async function deleteChunksForSource(sourceId: string): Promise<void> {
  const all = await readChunks();
  await writeChunks(all.filter((c) => c.sourceId !== sourceId));
}

export async function countChunksForSource(sourceId: string): Promise<number> {
  const all = await readChunks();
  return all.filter((c) => c.sourceId === sourceId).length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// Below this cosine similarity, a chunk is treated as unrelated to the
// query rather than "least-bad of the top-k" — so a message that has
// nothing to do with the attached sources gets no injected context at all,
// without needing the model itself to decide anything.
export const MIN_RELEVANCE_SCORE = 0.35;

/** Brute-force top-k similarity search. Fine at "personal lab" scale (a few hundred chunks) — no vector DB needed. */
export async function retrieveRelevantChunks(
  sourceIds: string[],
  queryVector: number[],
  topK = 4,
  minScore = MIN_RELEVANCE_SCORE
): Promise<Chunk[]> {
  if (sourceIds.length === 0) return [];
  const all = await readChunks();
  const idSet = new Set(sourceIds);
  return all
    .filter((c) => idSet.has(c.sourceId))
    .map((chunk) => ({ chunk, score: cosineSimilarity(chunk.vector, queryVector) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.chunk);
}
