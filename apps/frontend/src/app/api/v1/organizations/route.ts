import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find organizations owned or where user is a member
    const orgs = await prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        projects: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(orgs);
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
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
    }

    // Create organization and add owner to memberships
    const newOrg = await prisma.organization.create({
      data: {
        name: name.trim(),
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'ADMIN'
          }
        }
      },
      include: {
        owner: true,
        projects: true
      }
    });

    return NextResponse.json(newOrg);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}
