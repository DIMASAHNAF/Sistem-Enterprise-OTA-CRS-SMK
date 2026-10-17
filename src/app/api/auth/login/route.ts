import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/db';
import { User } from '@/lib/db/types';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan kata sandi wajib diisi' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email.trim().toLowerCase()) as unknown as User | undefined;

    if (!user) {
      logAudit({
        action: 'AUTH_LOGIN_FAILED_NOT_FOUND',
        targetId: email,
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: { email },
      });
      return NextResponse.json(
        { error: 'Kredensial login tidak valid' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      logAudit({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED_PASSWORD',
        targetId: String(user.id),
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: { email: user.email, role: user.role },
      });
      return NextResponse.json(
        { error: 'Kredensial login tidak valid' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      identity_number: user.identity_number,
    });

    // Record audit log
    logAudit({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      targetId: String(user.id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { role: user.role, name: user.name },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        identity_number: user.identity_number,
      },
      redirectTo: user.role === 'CUSTOMER' ? '/' : '/backoffice',
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal' },
      { status: 500 }
    );
  }
}
