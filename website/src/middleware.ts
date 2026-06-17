import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth gate for /dashboard and /admin.
 *
 * Why middleware: the dashboard layout is a 'use client' component
 * that pulls auth from localStorage in a useEffect. That means the
 * page renders first with no auth, then redirects on the second
 * tick — the user sees a flash of the public shell. Middleware runs
 * server-side before render and redirects in a single round-trip.
 *
 * Caveat: the token is mirrored from localStorage to a non-HttpOnly
 * cookie in AuthContext (see login/logout). The cookie is a UX hint,
 * NOT a security boundary — the API still validates the JWT itself.
 * Middleware just needs *some* token to know "user has logged in on
 * this device"; it does not need to verify the token is valid here.
 *
 * If you want true SSR auth, the right move is to swap the cookie to
 * an HttpOnly one set by the login API and verify it via jose in
 * middleware. Out of scope for this patch.
 */

const PROTECTED_PREFIXES = ['/dashboard'];

// /admin is gated, except /admin/login (the admin sign-in screen).
const ADMIN_PROTECTED = (pathname: string) =>
  pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login');

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsDashboard = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const needsAdmin = ADMIN_PROTECTED(pathname);

  if (!needsDashboard && !needsAdmin) {
    return NextResponse.next();
  }

  const token = req.cookies.get('dryp_token')?.value;
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = needsAdmin ? '/admin/login' : '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match /dashboard/* (always protected) and /admin/* EXCEPT /admin/login
  // (admins use that route to sign in). Negative-lookahead matchers in
  // Next.js are not supported, so we match both and re-check the path
  // in the handler above.
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};