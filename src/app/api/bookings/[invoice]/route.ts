import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { releaseExpiredBookings } from '@/lib/booking/generator';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoice: string }> }
) {
  try {
    const { invoice } = await context.params;
    if (!invoice) {
      return NextResponse.json({ error: 'Nomor invoice wajib disertakan' }, { status: 400 });
    }

    const db = getDatabase();

    // Auto-release expired locks first
    releaseExpiredBookings(db);

    const booking = db.prepare(`
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.invoice_number = ?
    `).get(invoice) as {
      id: number;
      invoice_number: string;
      user_id: number;
      trip_type: string;
      total_amount: number;
      payment_status: string;
      locked_until: string;
      created_at: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
    } | undefined;

    if (!booking) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // IDOR Protection: Owner OR Staff (TICKETING_OFFICER, SUPER_ADMIN)
    const currentUser = await getCurrentUser();
    const isOwner = currentUser && currentUser.id === booking.user_id;
    const isStaff = currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TICKETING_OFFICER');

    // For public guest checking their invoice, allow read if matching invoice
    // but if authenticated user is someone else (non-staff customer), restrict:
    if (currentUser && currentUser.role === 'CUSTOMER' && !isOwner) {
      return NextResponse.json({ error: 'Akses ditolak: Anda tidak memiliki akses ke pesanan ini' }, { status: 403 });
    }

    // Fetch Segments
    const segments = db.prepare(`
      SELECT bs.*, s.departure_date, s.base_departure_time, s.gate_info,
             r.route_name, r.direction,
             f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
             s1.code as origin_code, s1.name as origin_name, s1.city as origin_city,
             s2.code as dest_code, s2.name as dest_name, s2.city as dest_city,
             rso.departure_offset_minutes as origin_dep_offset,
             rsd.arrival_offset_minutes as dest_arr_offset
      FROM booking_segments bs
      JOIN schedules s ON bs.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      JOIN stations s1 ON bs.origin_station_id = s1.id
      JOIN stations s2 ON bs.destination_station_id = s2.id
      JOIN route_stops rso ON s.route_id = rso.route_id AND bs.origin_station_id = rso.station_id
      JOIN route_stops rsd ON s.route_id = rsd.route_id AND bs.destination_station_id = rsd.station_id
      WHERE bs.booking_id = ?
      ORDER BY bs.id ASC
    `).all(booking.id) as Array<{
      id: number;
      booking_id: number;
      pnr_code: string;
      segment_type: string;
      schedule_id: number;
      origin_station_id: number;
      destination_station_id: number;
      departure_date: string;
      base_departure_time: string;
      gate_info: string | null;
      route_name: string;
      direction: string;
      fleet_name: string;
      fleet_code: string;
      fleet_type: string;
      origin_code: string;
      origin_name: string;
      origin_city: string;
      dest_code: string;
      dest_name: string;
      dest_city: string;
      origin_dep_offset: number;
      dest_arr_offset: number;
    }>;

    // Fetch Passengers per Segment
    const passengersStmt = db.prepare(`
      SELECT bp.*, w.wagon_code, w.class as wagon_class
      FROM booking_passengers bp
      LEFT JOIN wagons w ON bp.wagon_id = w.id
      WHERE bp.booking_segment_id = ?
      ORDER BY bp.id ASC
    `);

    const enrichedSegments = segments.map((seg) => {
      const paxList = passengersStmt.all(seg.id);
      return {
        ...seg,
        passengers: paxList,
      };
    });

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        segments: enrichedSegments,
      },
    });
  } catch (error) {
    console.error('Fetch booking error:', error);
    return NextResponse.json({ error: 'Gagal memuat rincian pesanan' }, { status: 500 });
  }
}
