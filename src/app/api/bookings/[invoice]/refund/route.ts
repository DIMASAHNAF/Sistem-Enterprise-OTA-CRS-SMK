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
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'TICKETING_OFFICER')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Kasir Loket (Ticketing Officer) atau Super Admin yang dapat memproses Refund.' },
        { status: 403 }
      );
    }

    const { invoice } = await context.params;
    if (!invoice) {
      return NextResponse.json({ error: 'Nomor invoice wajib disertakan' }, { status: 400 });
    }

    const db = getDatabase();

    const booking = db.prepare(`
      SELECT b.*
      FROM bookings b
      WHERE b.invoice_number = ?
    `).get(invoice) as {
      id: number;
      invoice_number: string;
      user_id: number;
      total_amount: number;
      payment_status: string;
    } | undefined;

    if (!booking) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (booking.payment_status !== 'PAID') {
      return NextResponse.json(
        { error: `Pesanan dengan status '${booking.payment_status}' tidak dapat di-refund. Hanya tiket berstatus 'PAID' yang dapat dibatalkan.` },
        { status: 400 }
      );
    }

    // Process Refund
    db.prepare(`
      UPDATE bookings
      SET payment_status = 'REFUNDED'
      WHERE id = ?
    `).run(booking.id);

    logAudit({
      userId: user.id,
      action: 'BOOKING_REFUND',
      targetId: booking.invoice_number,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        invoice: booking.invoice_number,
        totalAmountRefunded: booking.total_amount,
        refundedByUserId: user.id,
        refundedByRole: user.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Tiket pada pesanan ${booking.invoice_number} berhasil dibatalkan & di-refund. Kursi telah otomatis dibuka kembali untuk publik!`,
      invoice_number: booking.invoice_number,
      payment_status: 'REFUNDED',
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json({ error: 'Gagal memproses pembatalan/refund tiket' }, { status: 500 });
  }
}
