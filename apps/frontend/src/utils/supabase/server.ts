import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const createDummyClient = () => {
  return new Proxy({} as any, {
    get(target, prop) {
      if (prop === 'auth') {
        return new Proxy({} as any, {
          get(t, p) {
            if (p === 'getUser' || p === 'signUp' || p === 'signInWithPassword' || p === 'signInWithOAuth') {
              return () => Promise.resolve({ data: { user: null }, error: null });
            }
            return () => Promise.resolve({ data: null, error: null });
          }
        });
      }
      return () => Promise.resolve({ data: null, error: null });
    }
  }) as ReturnType<typeof createServerClient>;
};

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^["']|["']$/g, '').trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '').trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    console.warn('Supabase server-side environment variables are missing or invalid. Returning fallback mock client.');
    return createDummyClient();
  }

  try {
    return createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
  } catch (error) {
    console.error('Failed to initialize server Supabase client:', error);
    return createDummyClient();
  }
}
