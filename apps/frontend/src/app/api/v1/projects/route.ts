import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function GET(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');

  try {
    const orgFilter = orgId 
      ? { id: orgId } 
      : {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } }
          ]
        };

    const projects = await prisma.project.findMany({
      where: {
        org: orgFilter
      },
      include: {
        org: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(projects);
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
    const { name, githubRepoUrl, orgId } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
    }
    if (!githubRepoUrl || !githubRepoUrl.trim()) {
      return NextResponse.json({ error: 'GitHub Repo URL is required.' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required.' }, { status: 400 });
    }

    // Verify user is member or owner of the organization
    const org = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found or access denied.' }, { status: 404 });
    }

    const newProject = await prisma.project.create({
      data: {
        name: name.trim(),
        githubRepoUrl: githubRepoUrl.trim(),
        orgId: org.id
      },
      include: {
        org: true
      }
    });

    return NextResponse.json(newProject);
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
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { org: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const member = await prisma.orgMember.findFirst({
      where: {
        orgId: project.orgId,
        userId: user.id,
        role: { in: ['ADMIN', 'DEVELOPER'] }
      }
    });

    if (project.org.ownerId !== user.id && !member) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.fileIndex.deleteMany({ where: { projectId } }),
      prisma.fileLock.deleteMany({ where: { projectId } }),
      prisma.message.deleteMany({ where: { conversation: { projectId } } }),
      prisma.conversation.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } })
    ]);

    return NextResponse.json({ success: true, message: 'Project deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

