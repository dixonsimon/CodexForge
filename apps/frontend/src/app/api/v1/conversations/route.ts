import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('Failed to list conversations:', error);
    return NextResponse.json({ error: error.message || 'Database error.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { title = 'New Conversation', activeModel = 'CodexForge-Agent' } = body;

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title,
        activeModel,
      },
    });

    return NextResponse.json(conversation);
  } catch (error: any) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: error.message || 'Database error.' }, { status: 500 });
  }
}
