import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoice: string }> }
) {
  try {
    const { invoice } = await context.params;
    if (!invoice) {
      return NextResponse.json({ error: 'Nomor invoice wajib disertakan' }, { status: 400 });
    }

    const db = getDatabase();

    const booking = db.prepare(`
      SELECT b.*,
             (SELECT pnr_code FROM booking_segments WHERE booking_id = b.id ORDER BY id ASC LIMIT 1) as primary_pnr
      FROM bookings b
      WHERE b.invoice_number = ?
    `).get(invoice) as {
      id: number;
      invoice_number: string;
      user_id: number;
      total_amount: number;
      payment_status: string;
      locked_until: string;
      primary_pnr: string;
    } | undefined;

    if (!booking) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (booking.payment_status === 'PAID') {
      return NextResponse.json({
        success: true,
        message: 'Pesanan ini sudah lunas sebelumnya.',
        invoice_number: booking.invoice_number,
        pnr_code: booking.primary_pnr,
      });
    }

    if (booking.payment_status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Batas waktu pembayaran 15 menit telah habis. Kursi telah dilepas kembali ke publik.' },
        { status: 400 }
      );
    }

    // Check if locked_until has passed right now
    const nowCheck = db.prepare(`SELECT datetime('now') as now_time`).get() as { now_time: string };
    if (booking.locked_until <= nowCheck.now_time) {
      db.prepare(`UPDATE bookings SET payment_status = 'EXPIRED' WHERE id = ?`).run(booking.id);
      return NextResponse.json(
        { error: 'Batas waktu pembayaran 15 menit telah habis. Kursi telah dilepas kembali ke publik.' },
        { status: 400 }
      );
    }

    // Process Payment Settlement
    db.prepare(`
      UPDATE bookings
      SET payment_status = 'PAID'
      WHERE id = ?
    `).run(booking.id);

    const currentUser = await getCurrentUser();
    const operatorId = currentUser ? currentUser.id : booking.user_id;

    logAudit({
      userId: operatorId,
      action: 'BOOKING_PAY',
      targetId: booking.invoice_number,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        invoice: booking.invoice_number,
        totalAmount: booking.total_amount,
        pnrCode: booking.primary_pnr,
        paidByUserId: operatorId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pembayaran tiket berhasil dikonfirmasi lunas!',
      invoice_number: booking.invoice_number,
      pnr_code: booking.primary_pnr,
      payment_status: 'PAID',
    });
  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json({ error: 'Gagal memproses konfirmasi pembayaran' }, { status: 500 });
  }
}
