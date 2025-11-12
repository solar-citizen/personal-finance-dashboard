export const formatEmbeddingVector = (embedding: number[]): string => {
  return `[${embedding.join(',')}]`;
};
