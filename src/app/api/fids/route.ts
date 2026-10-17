import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stationCode = searchParams.get('station_code')?.trim().toUpperCase();
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const db = getDatabase();

    // 1. Fetch Stations for filter dropdown
    const stations = db.prepare('SELECT id, code, name, city, type FROM stations ORDER BY code ASC').all();

    // 2. Fetch schedules for date
    let query = `
      SELECT 
        s.id as schedule_id,
        s.departure_date,
        s.base_departure_time,
        s.status as schedule_status,
        s.gate_info,
        f.id as fleet_id,
        f.name as fleet_name,
        f.code as fleet_code,
        f.type as fleet_type,
        r.id as route_id,
        r.route_name,
        r.direction
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      WHERE s.departure_date = ?
    `;
    const params: string[] = [dateParam];

    query += ` ORDER BY s.base_departure_time ASC`;

    const schedules = db.prepare(query).all(...params) as Array<Record<string, any>>;

    // 3. For each schedule, get stops sequence, passenger boarding counts, and calculate dynamic status
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    const items = [];

    for (const s of schedules) {
      // Query all stops in order
      const stops = db.prepare(`
        SELECT rs.stop_order, rs.arrival_offset_minutes, rs.departure_offset_minutes, st.code, st.name
        FROM route_stops rs
        JOIN stations st ON rs.station_id = st.id
        WHERE rs.route_id = ?
        ORDER BY rs.stop_order ASC
      `).all(s.route_id) as Array<{
        stop_order: number;
        arrival_offset_minutes: number;
        departure_offset_minutes: number;
        code: string;
        name: string;
      }>;

      // Filter by stationCode if specified
      if (stationCode && !stops.some((st) => st.code === stationCode)) {
        continue;
      }

      const stopsPath = stops.map((st) => st.code).join(' ➔ ');
      const destinationStation = stops[stops.length - 1];

      // Query passenger booked & boarded counts
      const counts = db.prepare(`
        SELECT 
          COUNT(bp.id) as booked_count,
          SUM(CASE WHEN bp.boarding_status = 'BOARDED' THEN 1 ELSE 0 END) as boarded_count
        FROM booking_passengers bp
        JOIN booking_segments bs ON bp.booking_segment_id = bs.id
        JOIN bookings b ON bs.booking_id = b.id
        WHERE bs.schedule_id = ? AND b.payment_status = 'PAID'
      `).get(s.schedule_id) as { booked_count: number; boarded_count: number };

      const bookedCount = counts?.booked_count || 0;
      const boardedCount = counts?.boarded_count || 0;

      // Dynamic FIDS Status Calculation:
      // If departure time has passed by > 15m -> DEPARTED
      // If current time is within 30m before departure -> BOARDING
      // Otherwise OPEN
      let displayStatus = s.schedule_status; // OPEN, CLOSED, DELAYED, DEPARTED
      if (s.schedule_status === 'OPEN') {
        const [depH, depM] = s.base_departure_time.split(':').map(Number);
        const [curH, curM] = currentTimeStr.split(':').map(Number);
        const depTotalM = depH * 60 + depM;
        const curTotalM = curH * 60 + curM;
        const diffM = depTotalM - curTotalM;

        if (diffM < -15) {
          displayStatus = 'DEPARTED';
        } else if (diffM <= 35 && diffM >= -15) {
          displayStatus = 'BOARDING';
        }
      }

      items.push({
        schedule_id: s.schedule_id,
        departure_time: s.base_departure_time,
        fleet_name: s.fleet_name,
        fleet_code: s.fleet_code,
        fleet_type: s.fleet_type,
        route_name: s.route_name,
        stops_sequence: stopsPath,
        destination_name: destinationStation ? `${destinationStation.code} - ${destinationStation.name}` : '-',
        gate_info: s.gate_info || (s.fleet_type === 'TRAIN' ? 'PERON 1' : 'GATE A'),
        booked_count: bookedCount,
        boarded_count: boardedCount,
        status: displayStatus,
      });
    }

    return NextResponse.json({
      success: true,
      current_time: currentTimeStr,
      date: dateParam,
      stations,
      items,
    });
  } catch (error) {
    console.error('FIDS error:', error);
    return NextResponse.json({ error: 'Gagal memuat data FIDS stasiun.' }, { status: 500 });
  }
}
