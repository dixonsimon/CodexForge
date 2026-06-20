import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const debugInfo: any = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlMasked: process.env.DATABASE_URL
      ? `${process.env.DATABASE_URL.substring(0, 15)}...`
      : 'not set',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    envNodeEnv: process.env.NODE_ENV,
  };

  try {
    const user = await getAuthenticatedUser();
    debugInfo.currentUser = user ? { id: user.id, email: user.email } : null;
  } catch (err: any) {
    debugInfo.userAuthError = err.message || err;
  }

  try {
    const userCount = await prisma.user.count();
    debugInfo.prismaUserCount = userCount;
    
    const convCount = await prisma.conversation.count();
    debugInfo.prismaConversationCount = convCount;

    const msgCount = await prisma.message.count();
    debugInfo.prismaMessageCount = msgCount;

    debugInfo.dbConnection = "Success";
  } catch (err: any) {
    debugInfo.dbConnection = "Failed";
    debugInfo.dbError = err.message || err;
  }

  return NextResponse.json(debugInfo);
}
