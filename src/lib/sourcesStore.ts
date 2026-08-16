import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteChunksForSource } from "./embeddingsStore";

export interface Source {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  /** Number of embedded chunks. 0/undefined means not indexed yet — retrieval will skip it. */
  chunkCount?: number;
}

// A single source is dumped raw into a small (256-token) embedding pass per
// chunk, so there's no hard ceiling from context size the way raw
// context-stuffing had — but we still cap per-source text to keep chunking
// and indexing fast and the source list legible.
export const MIN_SOURCE_CHARS = 20;
export const MAX_SOURCE_CHARS = 300_000;

const SOURCES_KEY = "edgemind:sources";

async function readSources(): Promise<Source[]> {
  const raw = await AsyncStorage.getItem(SOURCES_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeSources(sources: Source[]): Promise<void> {
  await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

export async function listSources(): Promise<Source[]> {
  const sources = await readSources();
  return sources.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addSource(title: string, text: string): Promise<Source> {
  const sources = await readSources();
  const source: Source = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    text: text.slice(0, MAX_SOURCE_CHARS),
    createdAt: Date.now(),
    chunkCount: 0,
  };
  sources.push(source);
  await writeSources(sources);
  return source;
}

export async function setChunkCount(id: string, chunkCount: number): Promise<void> {
  const sources = await readSources();
  const index = sources.findIndex((s) => s.id === id);
  if (index === -1) return;
  sources[index] = { ...sources[index], chunkCount };
  await writeSources(sources);
}

export async function deleteSource(id: string): Promise<void> {
  const sources = await readSources();
  await writeSources(sources.filter((s) => s.id !== id));
  await deleteChunksForSource(id);
}
