import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user) {
      logAudit({
        userId: user.id,
        action: 'AUTH_LOGOUT',
        targetId: String(user.id),
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: { role: user.role },
      });
    }

    const response = NextResponse.json({ success: true, message: 'Berhasil keluar' });
    response.cookies.delete(COOKIE_NAME);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Gagal keluar sistem' }, { status: 500 });
  }
}
