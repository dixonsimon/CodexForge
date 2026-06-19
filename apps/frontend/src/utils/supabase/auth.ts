import { prisma } from '@/lib/prisma';
import { createClient } from './server';

/**
 * Server helper to retrieve the authenticated user session and
 * ensure a corresponding user record exists in the local PostgreSQL database.
 */
export async function getAuthenticatedUser() {
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
}
