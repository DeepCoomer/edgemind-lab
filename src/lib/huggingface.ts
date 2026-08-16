const HF_API = "https://huggingface.co/api/models";

export interface HFSearchResult {
  id: string; // "org/repo"
  likes: number;
  downloads: number;
}

export interface HFGgufFile {
  filename: string;
  quant: string;
  sizeBytes: number;
  downloadUrl: string;
}

export async function searchHFModels(query: string): Promise<HFSearchResult[]> {
  const url = `${HF_API}?search=${encodeURIComponent(query)}&filter=gguf&sort=downloads&direction=-1&limit=25`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hugging Face search failed (${res.status})`);
  const data: any[] = await res.json();
  return data
    .filter((m) => Array.isArray(m.tags) && m.tags.includes("gguf"))
    .map((m) => ({ id: m.id, likes: m.likes ?? 0, downloads: m.downloads ?? 0 }));
}

function parseQuant(filename: string): string {
  const match = filename.match(/\b(q\d(?:_[a-z0-9]+)*|fp16|f16|f32|bf16)\b/i);
  return match ? match[1].toUpperCase() : filename.replace(/\.gguf$/i, "");
}

export async function getHFModelFiles(repoId: string): Promise<HFGgufFile[]> {
  const url = `${HF_API}/${repoId}?blobs=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${repoId} (${res.status})`);
  const data: any = await res.json();
  const siblings: any[] = data.siblings ?? [];
  return siblings
    .filter((s) => typeof s.rfilename === "string" && s.rfilename.toLowerCase().endsWith(".gguf"))
    .map((s) => ({
      filename: s.rfilename as string,
      quant: parseQuant(s.rfilename),
      sizeBytes: s.size ?? 0,
      downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${s.rfilename}`,
    }))
    .sort((a, b) => a.sizeBytes - b.sizeBytes);
}
