import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { verifyQRPayload } from '@/lib/boarding/qr-crypto';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

const VerifyQRSchema = z.object({
  payload: z.string().trim().min(5),
});

export async function POST(request: NextRequest) {
  try {
    // 1. RBAC Guard: Only BOARDING_OFFICER or SUPER_ADMIN
    const user = await getCurrentUser();
    if (!user || (user.role !== 'BOARDING_OFFICER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Boarding Officer atau Super Admin yang dapat memindai tiket boarding.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parse = VerifyQRSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { payload } = parse.data;
    const db = getDatabase();

    // 2. Cryptographic HMAC-SHA256 Verification
    const verification = verifyQRPayload(payload);

    if (!verification.valid || !verification.data) {
      // Log illegal/tampered attempt
      logAudit({
        userId: user.id,
        action: 'PASSENGER_BOARDING_FORBIDDEN',
        targetId: 'QR_VERIFY_FAILED',
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: {
          error: verification.error,
          tamperedPayload: payload,
          officerName: user.name,
        },
      });

      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_SIGNATURE',
          error: `QR CODE TIDAK VALID / TERINDIKASI PALSU! ${verification.error || 'Tanda tangan digital tidak cocok.'}`,
        },
        { status: 403 }
      );
    }

    const { pnr_code, passenger_id, schedule_id, seat_number } = verification.data;

    // 3. Database Integrity & State Check
    const paxRecord = db.prepare(`
      SELECT 
        bp.id,
        bp.full_name,
        bp.identity_number,
        bp.pax_type,
        bp.wagon_id,
        bp.seat_number,
        bp.boarding_status,
        bp.checked_in_at,
        bp.boarded_at,
        w.wagon_code,
        w.class as wagon_class,
        bs.pnr_code,
        bs.schedule_id,
        b.invoice_number,
        b.payment_status,
        f.name as fleet_name,
        f.code as fleet_code,
        r.route_name,
        so.name as origin_station,
        sd.name as dest_station
      FROM booking_passengers bp
      JOIN booking_segments bs ON bp.booking_segment_id = bs.id
      JOIN bookings b ON bs.booking_id = b.id
      JOIN schedules s ON bs.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      JOIN stations so ON bs.origin_station_id = so.id
      JOIN stations sd ON bs.destination_station_id = sd.id
      LEFT JOIN wagons w ON bp.wagon_id = w.id
      WHERE bp.id = ? AND bs.pnr_code = ?
    `).get(passenger_id, pnr_code) as Record<string, any> | undefined;

    if (!paxRecord) {
      return NextResponse.json(
        { error: `Data penumpang ID #${passenger_id} dengan PNR '${pnr_code}' tidak ditemukan di database.` },
        { status: 404 }
      );
    }

    // 4. Booking Payment Status Check
    if (paxRecord.payment_status !== 'PAID') {
      return NextResponse.json(
        {
          error: `Tiket tidak dapat digunakan untuk boarding karena status pembayaran adalah '${paxRecord.payment_status}'.`,
          payment_status: paxRecord.payment_status,
        },
        { status: 400 }
      );
    }

    // 5. Anti-Passback (Check if already BOARDED)
    if (paxRecord.boarding_status === 'BOARDED') {
      logAudit({
        userId: user.id,
        action: 'PASSENGER_BOARDING_FORBIDDEN',
        targetId: `${pnr_code}-${passenger_id}`,
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: {
          reason: 'DOUBLE_SCAN_DETECTED',
          passengerName: paxRecord.full_name,
          firstBoardedAt: paxRecord.boarded_at,
        },
      });

      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_BOARDED',
          error: `DOUBLE-SCAN TERDETEKSI: Penumpang atas nama ${paxRecord.full_name} sudah boarding sebelumnya pada ${paxRecord.boarded_at} WIB! Tiket tidak boleh digunakan dua kali.`,
          passenger: {
            name: paxRecord.full_name,
            identity: paxRecord.identity_number,
            wagon: paxRecord.wagon_code || 'EKS-1',
            seat: paxRecord.seat_number || 'PANGKU',
            boarded_at: paxRecord.boarded_at,
          },
        },
        { status: 409 }
      );
    }

    // 6. Valid Boarding Pass: Grant Boarding!
    db.prepare(`
      UPDATE booking_passengers
      SET boarding_status = 'BOARDED',
          boarded_at = datetime('now')
      WHERE id = ?
    `).run(passenger_id);

    const nowFormatted = new Date().toLocaleTimeString('id-ID', { hour12: false });

    // Log Audit
    logAudit({
      userId: user.id,
      action: 'PASSENGER_BOARDED',
      targetId: `${pnr_code}-${passenger_id}`,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        pnrCode: pnr_code,
        passengerId: passenger_id,
        passengerName: paxRecord.full_name,
        seatNumber: paxRecord.seat_number,
        wagonCode: paxRecord.wagon_code,
        boardedByOfficerId: user.id,
        boardedByOfficerName: user.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'BOARDING DIIZINKAN — SILAKAN NAIK KE ARMADA',
      timestamp: nowFormatted,
      passenger: {
        id: paxRecord.id,
        pnr_code: paxRecord.pnr_code,
        name: paxRecord.full_name,
        identity: paxRecord.identity_number,
        pax_type: paxRecord.pax_type,
        wagon: paxRecord.wagon_code || 'EKS-1',
        seat: paxRecord.seat_number || 'PANGKU',
        fleet: `${paxRecord.fleet_name} (${paxRecord.fleet_code})`,
        route: paxRecord.route_name,
        status: 'BOARDED',
        boarded_at: nowFormatted,
      },
    });
  } catch (error) {
    console.error('Boarding verify error:', error);
    return NextResponse.json({ error: 'Gagal memproses verifikasi boarding pass.' }, { status: 500 });
  }
}
