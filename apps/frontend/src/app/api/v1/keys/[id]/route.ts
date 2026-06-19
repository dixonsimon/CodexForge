import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

const localKeysFile = path.join(process.cwd(), 'data', 'keys-fallback.json');

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }

    const result = await prisma.apiKey.updateMany({
      where: { id, userId: user.id },
      data: { expiresAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Key not found or unauthorized.' }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("DB offline or unconfigured, revoking key in local file:", error);
    try {
      const content = await fs.readFile(localKeysFile, 'utf-8');
      const keys = JSON.parse(content);
      const targetKey = keys.find((k: any) => k.id === id && k.userId === user.id);
      if (!targetKey) {
        return NextResponse.json({ error: 'Key not found or unauthorized.' }, { status: 404 });
      }

      const updatedKeys = keys.map((k: any) => 
        (k.id === id && k.userId === user.id) ? { ...k, status: 'Revoked' } : k
      );
      await fs.writeFile(localKeysFile, JSON.stringify(updatedKeys, null, 2));
      return new Response(null, { status: 204 });
    } catch (e) {
      return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
    }
  }
}

