import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'BOARDING_OFFICER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Akses ditolak: Petugas boarding saja.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = Number(searchParams.get('schedule_id'));

    const db = getDatabase();

    // 1. Fetch Today's Schedules for selection
    const todayStr = new Date().toISOString().split('T')[0];
    const schedules = db.prepare(`
      SELECT 
        s.id,
        s.departure_date,
        s.base_departure_time,
        s.status,
        s.gate_info,
        f.name as fleet_name,
        f.code as fleet_code,
        f.type as fleet_type,
        r.route_name
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      WHERE s.departure_date = ?
      ORDER BY s.base_departure_time ASC
    `).all(todayStr) as Array<Record<string, any>>;

    const targetSchedId = scheduleId || (schedules[0]?.id as number | undefined);

    let manifest: Array<Record<string, any>> = [];
    let stats = {
      total_passengers: 0,
      checked_in_count: 0,
      boarded_count: 0,
      not_checked_in_count: 0,
    };

    if (targetSchedId) {
      manifest = db.prepare(`
        SELECT 
          bp.id,
          bp.full_name,
          bp.identity_number,
          bp.pax_type,
          bp.seat_number,
          bp.boarding_status,
          bp.checked_in_at,
          bp.boarded_at,
          w.wagon_code,
          w.class as wagon_class,
          bs.pnr_code,
          b.invoice_number,
          b.payment_status,
          so.code as origin_code,
          sd.code as dest_code
        FROM booking_passengers bp
        JOIN booking_segments bs ON bp.booking_segment_id = bs.id
        JOIN bookings b ON bs.booking_id = b.id
        JOIN stations so ON bs.origin_station_id = so.id
        JOIN stations sd ON bs.destination_station_id = sd.id
        LEFT JOIN wagons w ON bp.wagon_id = w.id
        WHERE bs.schedule_id = ? AND b.payment_status = 'PAID'
        ORDER BY bp.boarding_status DESC, bp.id ASC
      `).all(targetSchedId) as Array<Record<string, any>>;

      stats.total_passengers = manifest.length;
      stats.checked_in_count = manifest.filter((p) => p.boarding_status === 'CHECKED_IN').length;
      stats.boarded_count = manifest.filter((p) => p.boarding_status === 'BOARDED').length;
      stats.not_checked_in_count = manifest.filter((p) => p.boarding_status === 'BOOKED').length;
    }

    return NextResponse.json({
      success: true,
      active_schedule_id: targetSchedId,
      schedules,
      stats,
      manifest,
    });
  } catch (error) {
    console.error('Fetch manifest error:', error);
    return NextResponse.json({ error: 'Gagal memuat manifest keberangkatan.' }, { status: 500 });
  }
}
