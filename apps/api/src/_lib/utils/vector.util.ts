export function formatEmbeddingVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
