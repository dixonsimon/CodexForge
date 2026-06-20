import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (process.env.DATABASE_URL) {
      // Manually delete dependent entities first to avoid database constraint violations
      await prisma.conversation.deleteMany({ where: { userId: user.id } });
      await prisma.apiKey.deleteMany({ where: { userId: user.id } });
      await prisma.fileLock.deleteMany({ where: { userId: user.id } });
      await prisma.orgMember.deleteMany({ where: { userId: user.id } });
      await prisma.organization.deleteMany({ where: { ownerId: user.id } });

      // Delete user entry from users map table
      await prisma.user.delete({
        where: { id: user.id }
      });
    }

    return NextResponse.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error: any) {
    console.error('Failed to delete user account:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete account.' }, { status: 500 });
  }
}
