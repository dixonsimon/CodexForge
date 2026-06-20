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
      // Delete all user conversations (cascades to messages)
      await prisma.conversation.deleteMany({
        where: { userId: user.id }
      });

      // Delete all API keys
      await prisma.apiKey.deleteMany({
        where: { userId: user.id }
      });

      // Delete all file locks
      await prisma.fileLock.deleteMany({
        where: { userId: user.id }
      });
    }

    return NextResponse.json({ success: true, message: 'All user data has been deleted.' });
  } catch (error: any) {
    console.error('Failed to delete user data:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete data.' }, { status: 500 });
  }
}
