import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const getPrismaInstance = () => {
  let databaseUrl = process.env.DATABASE_URL || '';

  if (databaseUrl) {
    try {
      const urlObj = new URL(databaseUrl);
      // Disable prepared statements to prevent prepared statement already exists conflicts (ERROR 42P05)
      urlObj.searchParams.set('statement_cache_size', '0');
      
      // If connecting to PgBouncer transaction pooler port, ensure it is set to true
      if (urlObj.port === '6543') {
        urlObj.searchParams.set('pgbouncer', 'true');
      }
      databaseUrl = urlObj.toString();
    } catch (e) {
      console.error("Failed to append statement cache parameters to DATABASE_URL:", e);
    }
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl || undefined,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma || getPrismaInstance();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
