import { prisma } from '@/lib/prisma';
import { createClient } from './server';

/**
 * Server helper to retrieve the authenticated user session and
 * ensure a corresponding user record exists in the local PostgreSQL database.
 */
export async function getAuthenticatedUser() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables are missing. getAuthenticatedUser returning null.');
      return null;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Extract metadata fields synced from Google OAuth or custom manual registrations.
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

    // Ensure the user exists in our local database for foreign key constraints.
    try {
      if (process.env.DATABASE_URL) {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            email: user.email || '',
            name: fullName || null,
            avatarUrl: avatarUrl || null,
          },
          create: {
            id: user.id,
            email: user.email || '',
            name: fullName || null,
            avatarUrl: avatarUrl || null,
            billingTier: 'free',
          },
        });
      }
    } catch (error) {
      console.error('Failed to upsert user in database:', error);
    }

    return user;
  } catch (error: any) {
    if (error && (error.digest === 'DYNAMIC_SERVER_USAGE' || error.message?.includes('Dynamic server usage') || error.message?.includes('cookies'))) {
      throw error;
    }
    console.error('Failed to get authenticated user:', error);
    return null;
  }
}
