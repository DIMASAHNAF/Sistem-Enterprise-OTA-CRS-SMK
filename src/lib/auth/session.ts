import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserRole } from '@/lib/db/types';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'smk-travel-enterprise-secure-jwt-key-minimum-32-characters-2026'
);

export const COOKIE_NAME = 'travel_auth_token';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  identity_number: string;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    identity_number: user.identity_number,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      id: Number(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as UserRole,
      identity_number: String(payload.identity_number),
    };
  } catch {
    return null;
  }
}

/**
 * Get current session user from Next.js server context
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}
