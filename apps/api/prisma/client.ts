import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/@generated/prisma-client/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Solely for scripts/seeds
export const prisma = new PrismaClient({ adapter });
