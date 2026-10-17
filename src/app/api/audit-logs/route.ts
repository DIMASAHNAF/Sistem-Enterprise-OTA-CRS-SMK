import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getRecentAuditLogs } from '@/lib/audit/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const logs = getRecentAuditLogs(Math.min(limit, 200));
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Audit logs query error:', error);
    return NextResponse.json({ error: 'Gagal mengambil log audit' }, { status: 500 });
  }
}
