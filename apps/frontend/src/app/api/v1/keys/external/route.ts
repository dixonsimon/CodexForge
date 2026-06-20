import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const keys = await prisma.externalKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        label: true,
        baseUrl: true,
        defaultModel: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { provider: 'asc' }
    });

    return NextResponse.json(keys);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider, label, apiKey, baseUrl, defaultModel } = await req.json();

    if (!provider || !provider.trim()) {
      return NextResponse.json({ error: 'Provider is required.' }, { status: 400 });
    }
    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'Label is required.' }, { status: 400 });
    }
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ error: 'API key is required.' }, { status: 400 });
    }

    const cleanProvider = provider.trim().toLowerCase();

    const upserted = await prisma.externalKey.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: cleanProvider
        }
      },
      update: {
        label: label.trim(),
        apiKey: apiKey.trim(),
        baseUrl: baseUrl ? baseUrl.trim() : null,
        defaultModel: defaultModel ? defaultModel.trim() : null,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        provider: cleanProvider,
        label: label.trim(),
        apiKey: apiKey.trim(),
        baseUrl: baseUrl ? baseUrl.trim() : null,
        defaultModel: defaultModel ? defaultModel.trim() : null
      }
    });

    return NextResponse.json({
      id: upserted.id,
      provider: upserted.provider,
      label: upserted.label,
      baseUrl: upserted.baseUrl,
      defaultModel: upserted.defaultModel,
      updatedAt: upserted.updatedAt
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider } = await req.json();
    if (!provider) {
      return NextResponse.json({ error: 'Provider is required.' }, { status: 400 });
    }

    await prisma.externalKey.deleteMany({
      where: {
        userId: user.id,
        provider: provider.trim().toLowerCase()
      }
    });

    return NextResponse.json({ success: true, message: 'External API key deleted.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}
