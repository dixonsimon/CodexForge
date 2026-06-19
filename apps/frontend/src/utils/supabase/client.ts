import { createBrowserClient } from '@supabase/ssr';

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
  }) as ReturnType<typeof createBrowserClient>;
};

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^["']|["']$/g, '').trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '').trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    console.warn('Supabase client-side environment variables are missing or invalid. Returning fallback mock client.');
    return createDummyClient();
  }

  try {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize browser Supabase client:', error);
    return createDummyClient();
  }
}
