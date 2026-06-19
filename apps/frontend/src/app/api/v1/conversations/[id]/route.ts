import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error: any) {
    console.error('Failed to retrieve conversation history:', error);
    return NextResponse.json({ error: error.message || 'Database error.' }, { status: 500 });
  }
}

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
    const result = await prisma.conversation.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Conversation not found or unauthorized.' }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json({ error: error.message || 'Database error.' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const { activeModel, title } = body;

    const updateData: any = {};
    if (activeModel !== undefined) updateData.activeModel = activeModel;
    if (title !== undefined) updateData.title = title;

    const conversation = await prisma.conversation.update({
      where: { id, userId: user.id },
      data: updateData,
    });

    return NextResponse.json(conversation);
  } catch (error: any) {
    console.error('Failed to update conversation:', error);
    return NextResponse.json({ error: error.message || 'Database error.' }, { status: 500 });
  }
}

