import { PrismaClient } from '@prisma/client';
import { previewDatabaseUrl } from './2026-11-14-preview-database';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = previewDatabaseUrl(process.env);
export const prisma = globalForPrisma.prisma ?? new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
