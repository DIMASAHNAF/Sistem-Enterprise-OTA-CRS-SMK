import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { signBoardingData } from '@/lib/boarding/qr-crypto';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = searchParams.get('pnr')?.trim().toUpperCase();
    const identity = searchParams.get('identity')?.trim();

    if (!pnr) {
      return NextResponse.json({ error: 'Kode booking (PNR) wajib disertakan' }, { status: 400 });
    }

    const db = getDatabase();

    // 1. Query Segment & Booking details
    const segment = db.prepare(`
      SELECT 
        bs.id as segment_id,
        bs.pnr_code,
        bs.segment_type,
        bs.schedule_id,
        bs.booking_id,
        b.invoice_number,
        b.payment_status,
        b.trip_type,
        b.user_id as booking_user_id,
        u.name as booker_name,
        u.email as booker_email,
        u.identity_number as booker_identity,
        s.departure_date,
        s.base_departure_time,
        s.status as schedule_status,
        s.gate_info,
        f.name as fleet_name,
        f.code as fleet_code,
        f.type as fleet_type,
        r.route_name,
        so.name as origin_station_name,
        so.code as origin_station_code,
        so.city as origin_city,
        sd.name as dest_station_name,
        sd.code as dest_station_code,
        sd.city as dest_city,
        (
          SELECT time(s.base_departure_time, '+' || rso.departure_offset_minutes || ' minutes')
          FROM route_stops rso
          WHERE rso.route_id = s.route_id AND rso.station_id = bs.origin_station_id
        ) as origin_departure_time,
        (
          SELECT time(s.base_departure_time, '+' || rsd.arrival_offset_minutes || ' minutes')
          FROM route_stops rsd
          WHERE rsd.route_id = s.route_id AND rsd.station_id = bs.destination_station_id
        ) as dest_arrival_time
      FROM booking_segments bs
      JOIN bookings b ON bs.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN schedules s ON bs.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      JOIN stations so ON bs.origin_station_id = so.id
      JOIN stations sd ON bs.destination_station_id = sd.id
      WHERE bs.pnr_code = ?
    `).get(pnr) as Record<string, any> | undefined;

    if (!segment) {
      return NextResponse.json(
        { error: `Kode Booking (PNR) '${pnr}' tidak ditemukan dalam sistem.` },
        { status: 404 }
      );
    }

    // 2. Query Passengers in this segment
    const passengers = db.prepare(`
      SELECT 
        bp.id,
        bp.full_name,
        bp.identity_number,
        bp.pax_type,
        bp.wagon_id,
        bp.seat_number,
        bp.boarding_status,
        bp.qr_signature,
        bp.checked_in_at,
        bp.boarded_at,
        w.wagon_code,
        w.class as wagon_class
      FROM booking_passengers bp
      LEFT JOIN wagons w ON bp.wagon_id = w.id
      WHERE bp.booking_segment_id = ?
      ORDER BY bp.id ASC
    `).all(segment.segment_id) as Array<Record<string, any>>;

    // 3. Security verification: if identity is provided, verify match
    if (identity) {
      const matchPax = passengers.some(
        (p) => p.identity_number.toLowerCase() === identity.toLowerCase()
      );
      const matchBooker =
        segment.booker_identity &&
        segment.booker_identity.toLowerCase() === identity.toLowerCase();

      if (!matchPax && !matchBooker) {
        return NextResponse.json(
          {
            error:
              'Nomor identitas (NIK/NISN) tidak cocok dengan manifest penumpang pada kode booking ini.',
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      segment,
      passengers,
    });
  } catch (error) {
    console.error('Check-in lookup error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data check-in.' }, { status: 500 });
  }
}

const PostCheckInSchema = z.object({
  pnr_code: z.string().trim().min(5).max(10),
  identity_number: z.string().trim().optional(),
  passenger_ids: z.array(z.number().int().positive()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parse = PostCheckInSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { pnr_code, identity_number, passenger_ids } = parse.data;
    const cleanPnr = pnr_code.trim().toUpperCase();

    const db = getDatabase();

    // 1. Fetch Segment & Booking
    const segment = db.prepare(`
      SELECT 
        bs.id as segment_id,
        bs.pnr_code,
        bs.schedule_id,
        bs.booking_id,
        b.invoice_number,
        b.payment_status,
        b.user_id as booking_user_id
      FROM booking_segments bs
      JOIN bookings b ON bs.booking_id = b.id
      WHERE bs.pnr_code = ?
    `).get(cleanPnr) as {
      segment_id: number;
      pnr_code: string;
      schedule_id: number;
      booking_id: number;
      invoice_number: string;
      payment_status: string;
      booking_user_id: number;
    } | undefined;

    if (!segment) {
      return NextResponse.json({ error: 'Kode booking tidak ditemukan' }, { status: 404 });
    }

    // 2. Strict Payment Validation: ONLY PAID bookings can Check-In
    if (segment.payment_status !== 'PAID') {
      let msg = 'Tiket belum lunas. Silakan selesaikan pembayaran terlebih dahulu sebelum melakukan Check-In.';
      if (segment.payment_status === 'EXPIRED') {
        msg = 'Pemesanan tiket ini telah kedaluwarsa (EXPIRED). Kursi telah dilepas kembali ke publik.';
      } else if (segment.payment_status === 'REFUNDED') {
        msg = 'Tiket ini telah dibatalkan / di-refund. Tidak dapat melakukan Check-In.';
      }
      return NextResponse.json({ error: msg, payment_status: segment.payment_status }, { status: 400 });
    }

    // 3. Fetch Passengers
    let paxQuery = `
      SELECT id, full_name, identity_number, pax_type, seat_number, boarding_status
      FROM booking_passengers
      WHERE booking_segment_id = ?
    `;
    const passengers = db.prepare(paxQuery).all(segment.segment_id) as Array<{
      id: number;
      full_name: string;
      identity_number: string;
      pax_type: string;
      seat_number: string | null;
      boarding_status: string;
    }>;

    if (passengers.length === 0) {
      return NextResponse.json({ error: 'Tidak ada manifest penumpang pada tiket ini' }, { status: 400 });
    }

    // If specific passenger_ids provided, filter; otherwise check-in all unboarded passengers
    const targetPassengers = passenger_ids && passenger_ids.length > 0
      ? passengers.filter((p) => passenger_ids.includes(p.id))
      : passengers;

    const currentUser = await getCurrentUser();
    const operatorId = currentUser ? currentUser.id : segment.booking_user_id;

    // 4. Update Passengers to CHECKED_IN and generate HMAC signatures
    const updatePax = db.prepare(`
      UPDATE booking_passengers
      SET boarding_status = 'CHECKED_IN',
          checked_in_at = datetime('now'),
          qr_signature = ?
      WHERE id = ?
    `);

    const checkedInList = [];

    for (const pax of targetPassengers) {
      // If already BOARDED, do not downgrade
      if (pax.boarding_status === 'BOARDED') {
        checkedInList.push({ id: pax.id, name: pax.full_name, status: 'BOARDED' });
        continue;
      }

      const { signature, payload } = signBoardingData(
        cleanPnr,
        pax.id,
        segment.schedule_id,
        pax.seat_number
      );

      updatePax.run(signature, pax.id);

      checkedInList.push({
        id: pax.id,
        name: pax.full_name,
        seat_number: pax.seat_number,
        signature,
        payload,
        status: 'CHECKED_IN',
      });

      // Audit Log
      logAudit({
        userId: operatorId,
        action: 'PASSENGER_CHECKIN',
        targetId: `${cleanPnr}-${pax.id}`,
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: {
          pnrCode: cleanPnr,
          passengerId: pax.id,
          passengerName: pax.full_name,
          seatNumber: pax.seat_number,
          qrSignature: signature,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Check-In berhasil! E-Boarding Pass resmi siap dicetak atau disimpan di smartphone.',
      pnr_code: cleanPnr,
      redirect_url: `/boarding-pass/${cleanPnr}`,
      checked_in_count: checkedInList.length,
      passengers: checkedInList,
    });
  } catch (error) {
    console.error('Check-in processing error:', error);
    return NextResponse.json({ error: 'Gagal memproses check-in online.' }, { status: 500 });
  }
}
