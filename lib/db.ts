import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaClient: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  // Vercel Serverless workaround: copy read-only db to writeable /tmp
  const tmpDbPath = '/tmp/dev.db';
  if (!fs.existsSync(tmpDbPath)) {
    try {
      // Find original db which Next.js output tracing should bring over
      const originalDbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      fs.copyFileSync(originalDbPath, tmpDbPath);
      console.log('Successfully copied SQLite DB to /tmp for write access.');
    } catch (error) {
      console.error('Failed to copy SQLite DB to /tmp:', error);
    }
  }
  
  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: 'file:/tmp/dev.db',
      },
    },
    log: ['error', 'warn'],
  });
} else {
  prismaClient = globalForPrisma.prisma || new PrismaClient({ log: ['error', 'warn'] });
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
