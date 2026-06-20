import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function POST(req: Request, { params }: any) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;

  try {
    const { email, role = 'DEVELOPER' } = await req.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const org = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, role: 'ADMIN' } } }
        ]
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found or access denied.' }, { status: 404 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim() }
    });

    if (!targetUser) {
      return NextResponse.json({ error: `User with email "${email}" not found on CodexForge.` }, { status: 404 });
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId: org.id,
          userId: targetUser.id
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this organization.' }, { status: 400 });
    }

    const newMember = await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: targetUser.id,
        role: role
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(newMember);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: any) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const org = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, role: 'ADMIN' } } }
        ]
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found or access denied.' }, { status: 404 });
    }

    if (org.ownerId === userId) {
      return NextResponse.json({ error: 'The organization owner cannot be removed.' }, { status: 400 });
    }

    await prisma.orgMember.deleteMany({
      where: {
        orgId: org.id,
        userId: userId
      }
    });

    return NextResponse.json({ success: true, message: 'Member removed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

