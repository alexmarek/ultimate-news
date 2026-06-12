// lib/ai/embed.ts
//
// Voyage AI embedding call. [Inference] Using raw fetch rather than a Voyage
// SDK — there is an official @voyageai/sdk JS package but its API surface
// is small enough that the raw call is more transparent and one fewer dep.
//
// Model: voyage-3-lite
//   - 512-dim output
//   - 32k token context
//   - input_type='document' (vs 'query') — yields better retrieval pairing
//     when later querying with 'query' embeddings.
//
// Cost: free tier covers our projected volume easily. Negligible per article.
//
// Reference: https://docs.voyageai.com/docs/embeddings

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3-lite';

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

export async function embed(text: string): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');

  const input = text.slice(0, 16_000);

  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: [input],
      model: MODEL,
      input_type: 'document',
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Voyage ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await res.json()) as VoyageResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`Voyage returned unexpected embedding shape: ${embedding?.length ?? 'none'}`);
  }
  return embedding;
}

export async function queryEmbed(text: string): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');

  const input = text.slice(0, 16_000);

  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: [input],
      model: MODEL,
      input_type: 'query',
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Voyage ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await res.json()) as VoyageResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`Voyage returned unexpected embedding shape: ${embedding?.length ?? 'none'}`);
  }
  return embedding;
}

// ---------------------------------------------------------------------------
// Cosine similarity — used by lib/dedup/cluster.ts. Inlined here so the
// vector math has one canonical home. Runtime-checked for dimension mismatch.
// ---------------------------------------------------------------------------
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dim mismatch (query: ${a.length}d, article: ${b.length}d). Run scripts/reembed-articles.ts to normalize stored embeddings.`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
