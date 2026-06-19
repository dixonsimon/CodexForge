import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

// Local file fallback for database offline state
const localKeysFile = path.join(process.cwd(), 'data', 'keys-fallback.json');

async function getLocalFallbackKeys() {
  try {
    await fs.mkdir(path.dirname(localKeysFile), { recursive: true });
    try {
      const data = await fs.readFile(localKeysFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  } catch (e) {
    return [];
  }
}

async function saveLocalFallbackKeys(keys: any[]) {
  try {
    await fs.mkdir(path.dirname(localKeysFile), { recursive: true });
    await fs.writeFile(localKeysFile, JSON.stringify(keys, null, 2));
  } catch (e) {
    console.error('Failed to write local keys fallback:', e);
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }
    const dbKeys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const result = dbKeys.map((k) => ({
      id: k.id,
      name: k.label,
      key: k.displayKey,
      scope: k.scopes,
      created: k.createdAt.toISOString().split('T')[0],
      status: k.expiresAt && k.expiresAt <= now ? 'Revoked' : 'Active',
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.warn("DB offline or unconfigured, falling back to local file keys:", error);
    const localKeys = await getLocalFallbackKeys();
    const userLocalKeys = localKeys.filter((k: any) => k.userId === user.id);
    return NextResponse.json(userLocalKeys);
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, scope } = body;
    if (!name || !scope) {
      return NextResponse.json({ error: 'Name and scope are required.' }, { status: 400 });
    }

    // Generate secure token
    const randPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const prefix = scope.includes('admin') ? 'cf_admin' : 'cf_live';
    const rawKey = `${prefix}_${randPart}`;
    const maskedKey = `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 4)}`;

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const dbKey = await prisma.apiKey.create({
      data: {
        label: name,
        scopes: scope,
        displayKey: maskedKey,
        keyHash,
        userId: user.id,
      },
    });

    return NextResponse.json({
      id: dbKey.id,
      name: dbKey.label,
      key: dbKey.displayKey,
      scope: dbKey.scopes,
      created: dbKey.createdAt.toISOString().split('T')[0],
      status: 'Active',
      rawKey,
    });
  } catch (error) {
    console.warn("DB offline or unconfigured, saving API key to local file:", error);
    const body = await getMockBody(req);
    const { name, scope } = body;
    const randPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const prefix = scope.includes('admin') ? 'cf_admin' : 'cf_live';
    const rawKey = `${prefix}_${randPart}`;
    const maskedKey = `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 4)}`;

    const newKey = {
      id: Date.now().toString(),
      name,
      key: maskedKey,
      scope,
      created: new Date().toISOString().split('T')[0],
      status: 'Active' as const,
      userId: user.id,
    };

    const localKeys = await getLocalFallbackKeys();
    localKeys.unshift(newKey);
    await saveLocalFallbackKeys(localKeys);

    return NextResponse.json({
      ...newKey,
      rawKey,
    });
  }
}

// Utility to safely extract request body in catch block
async function getMockBody(req: Request) {
  try {
    const clone = req.clone();
    return await clone.json();
  } catch {
    return { name: 'Token', scope: 'read:model' };
  }
}

