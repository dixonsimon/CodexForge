import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function DELETE(req: Request, { params }: any) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    if (org.ownerId !== user.id) {
      return NextResponse.json({ error: 'Only the owner can delete this organization.' }, { status: 403 });
    }

    // Delete organization and dependents
    await prisma.$transaction([
      prisma.fileIndex.deleteMany({ where: { project: { orgId: org.id } } }),
      prisma.fileLock.deleteMany({ where: { project: { orgId: org.id } } }),
      prisma.message.deleteMany({
        where: {
          conversation: {
            projectId: {
              in: (await prisma.project.findMany({ where: { orgId: org.id }, select: { id: true } })).map(p => p.id)
            }
          }
        }
      }),
      prisma.conversation.deleteMany({
        where: {
          projectId: {
            in: (await prisma.project.findMany({ where: { orgId: org.id }, select: { id: true } })).map(p => p.id)
          }
        }
      }),
      prisma.project.deleteMany({ where: { orgId: org.id } }),
      prisma.orgMember.deleteMany({ where: { orgId: org.id } }),
      prisma.organization.delete({ where: { id: orgId } })
    ]);

    return NextResponse.json({ success: true, message: 'Organization deleted.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}
