import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { UserRole } from './lib/db/types';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'smk-travel-enterprise-secure-jwt-key-minimum-32-characters-2026'
);

const COOKIE_NAME = 'travel_auth_token';

// Role access rules mapping
const ROLE_ALLOWED_PREFIXES: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['/backoffice'],
  REVENUE_CONTROLLER: [
    '/backoffice',
    '/backoffice/revenue',
    '/backoffice/master/stations',
    '/backoffice/master/fleets',
  ],
  TICKETING_OFFICER: ['/backoffice', '/backoffice/ticketing'],
  TOUR_PLANNER: ['/backoffice', '/backoffice/tour'],
  BOARDING_OFFICER: ['/backoffice', '/backoffice/boarding'],
  CUSTOMER: ['/my-bookings', '/check-in'],
};

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Static assets, next internals, and public api paths are bypassed
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.includes('.')
    ) {
      return NextResponse.next();
    }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  // Backoffice protection
  if (pathname.startsWith('/backoffice')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      const role = payload.role as UserRole;

      // Customers are not allowed into the backoffice workspace
      if (role === 'CUSTOMER') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Check specific backoffice subpaths
      if (role !== 'SUPER_ADMIN') {
        const allowed = ROLE_ALLOWED_PREFIXES[role] || [];
        const isAllowed =
          pathname === '/backoffice' ||
          allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

        if (!isAllowed) {
          return NextResponse.redirect(new URL('/backoffice/unauthorized', request.url));
        }
      }

      // Append verified headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', String(payload.id));
      requestHeaders.set('x-user-role', role);
      requestHeaders.set('x-user-email', String(payload.email));

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch {
      // Invalid or expired token
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  // Already logged in user navigating to /login
  if (pathname === '/login' && token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      const role = payload.role as UserRole;
      if (role === 'CUSTOMER') {
        return NextResponse.redirect(new URL('/', request.url));
      }
      return NextResponse.redirect(new URL('/backoffice', request.url));
    } catch {
      // Token invalid, proceed to login
    }
  }

    return NextResponse.next();
  } catch (err) {
    console.error('Middleware execution error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/backoffice/:path*', '/login', '/api/backoffice/:path*'],
};
