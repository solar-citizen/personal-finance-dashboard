import { prisma } from '../client';

async function createVectorIndex() {
  console.log('🔧 Creating vector index for Message.embedding...');

  await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS message_embedding_idx ON "Message" 
      USING hnsw (embedding vector_cosine_ops);
    `);

  console.log('✅ Vector index created successfully');
}

createVectorIndex()
  .catch((err: unknown) => {
    console.error('❌ Failed to create vector index:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
