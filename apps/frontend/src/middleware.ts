import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  
  const path = request.nextUrl.pathname;
  
  // Define protected routes
  const isProtected = ['/chat', '/dashboard', '/keys'].some(route => 
    path === route || path.startsWith(route + '/')
  );

  // If visiting protected page and user is not logged in, redirect to login
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    // Keep reference to where the user was heading
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in and visiting login page, redirect to chat
  if (path === '/login' && user) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (API routes except callback/signout if you want)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
