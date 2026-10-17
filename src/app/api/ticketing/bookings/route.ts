import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { releaseExpiredBookings } from '@/lib/booking/generator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'TICKETING_OFFICER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Kasir Loket/Admin' }, { status: 403 });
    }

    const db = getDatabase();
    releaseExpiredBookings(db);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status')?.trim();

    let query = `
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             (SELECT pnr_code FROM booking_segments WHERE booking_id = b.id ORDER BY id ASC LIMIT 1) as primary_pnr,
             (SELECT COUNT(*) FROM booking_passengers bp JOIN booking_segments bs ON bp.booking_segment_id = bs.id WHERE bs.booking_id = b.id) as passenger_count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (status && status !== 'ALL') {
      query += ` AND b.payment_status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (
        b.invoice_number LIKE ? OR
        u.name LIKE ? OR
        u.email LIKE ? OR
        EXISTS (
          SELECT 1 FROM booking_segments bs2 WHERE bs2.booking_id = b.id AND bs2.pnr_code LIKE ?
        ) OR
        EXISTS (
          SELECT 1 FROM booking_passengers bp2
          JOIN booking_segments bs3 ON bp2.booking_segment_id = bs3.id
          WHERE bs3.booking_id = b.id AND (bp2.full_name LIKE ? OR bp2.identity_number LIKE ?)
        )
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    query += ` ORDER BY b.id DESC LIMIT 100`;

    const bookings = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error('Fetch ticketing bookings error:', error);
    return NextResponse.json({ error: 'Gagal memuat daftar pesanan loket' }, { status: 500 });
  }
}
