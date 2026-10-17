import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { addMinutesToTime, formatDurationMinutes } from '@/lib/utils/travel';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const originParam = searchParams.get('origin')?.trim();
    const destParam = searchParams.get('destination')?.trim();
    const dateParam = searchParams.get('date')?.trim();
    const rawAdults = searchParams.get('adults');
    const adultsParam = rawAdults !== null && rawAdults !== '' ? Number(rawAdults) : 1;
    const rawInfants = searchParams.get('infants');
    const infantsParam = rawInfants !== null && rawInfants !== '' ? Number(rawInfants) : 0;

    // 1. Strict Validation
    if (!originParam || !destParam || !dateParam) {
      return NextResponse.json(
        { error: 'Parameter stasiun asal (origin), tujuan (destination), dan tanggal (date) wajib diisi.' },
        { status: 400 }
      );
    }

    if (originParam.toUpperCase() === destParam.toUpperCase()) {
      return NextResponse.json(
        { error: 'Stasiun asal dan tujuan tidak boleh sama.' },
        { status: 400 }
      );
    }

    if (adultsParam < 1 || adultsParam > 8) {
      return NextResponse.json(
        { error: 'Jumlah penumpang dewasa harus antara 1 sampai 8 orang.' },
        { status: 400 }
      );
    }

    if (infantsParam < 0 || infantsParam > 4) {
      return NextResponse.json(
        { error: 'Jumlah penumpang bayi maksimal 4 orang.' },
        { status: 400 }
      );
    }

    if (infantsParam > adultsParam) {
      return NextResponse.json(
        { error: 'Jumlah penumpang bayi tidak boleh melebihi jumlah penumpang dewasa (1 bayi wajib dipangku 1 dewasa).' },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 2. Resolve Station IDs
    const findStation = (param: string) => {
      const isNum = !isNaN(Number(param));
      if (isNum) {
        return db.prepare('SELECT id, code, name, city, type FROM stations WHERE id = ?').get(Number(param)) as {
          id: number;
          code: string;
          name: string;
          city: string;
          type: string;
        } | undefined;
      }
      return db.prepare('SELECT id, code, name, city, type FROM stations WHERE UPPER(code) = ?').get(param.toUpperCase()) as {
        id: number;
        code: string;
        name: string;
        city: string;
        type: string;
      } | undefined;
    };

    const originStation = findStation(originParam);
    const destStation = findStation(destParam);

    if (!originStation) {
      return NextResponse.json({ error: `Stasiun asal '${originParam}' tidak ditemukan.` }, { status: 404 });
    }
    if (!destStation) {
      return NextResponse.json({ error: `Stasiun tujuan '${destParam}' tidak ditemukan.` }, { status: 404 });
    }

    // 3. Find schedules with matching directional stops (origin.stop_order < dest.stop_order)
    const schedulesQuery = `
      SELECT s.id as schedule_id, s.route_id, s.departure_date, s.base_departure_time, s.status, s.gate_info,
             r.route_name, r.direction, r.fleet_id,
             f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
             rso.stop_order as origin_order, rso.departure_offset_minutes as origin_dep_offset,
             rsd.stop_order as dest_order, rsd.arrival_offset_minutes as dest_arr_offset
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      JOIN route_stops rso ON r.id = rso.route_id AND rso.station_id = ?
      JOIN route_stops rsd ON r.id = rsd.route_id AND rsd.station_id = ?
      WHERE s.departure_date = ?
        AND s.status IN ('OPEN', 'DELAYED')
        AND rso.stop_order < rsd.stop_order
      ORDER BY (
        (CAST(substr(s.base_departure_time, 1, 2) AS INTEGER) * 60 + CAST(substr(s.base_departure_time, 4, 2) AS INTEGER)) + rso.departure_offset_minutes
      ) ASC
    `;

    const matchedSchedules = db.prepare(schedulesQuery).all(originStation.id, destStation.id, dateParam) as Array<{
      schedule_id: number;
      route_id: number;
      departure_date: string;
      base_departure_time: string;
      status: string;
      gate_info: string | null;
      route_name: string;
      direction: string;
      fleet_id: number;
      fleet_name: string;
      fleet_code: string;
      fleet_type: string;
      origin_order: number;
      origin_dep_offset: number;
      dest_order: number;
      dest_arr_offset: number;
    }>;

    // 4. Query schedule_fares and calculate real-time available seats per fare option
    const faresStmt = db.prepare(`
      SELECT id, wagon_class, subclass, price, quota
      FROM schedule_fares
      WHERE schedule_id = ?
        AND origin_station_id = ?
        AND destination_station_id = ?
      ORDER BY wagon_class ASC, price ASC
    `);

    // Statement to count occupied seats overlapping the requested segment
    const overlapStmt = db.prepare(`
      SELECT COUNT(bp.id) as occupied_count
      FROM booking_passengers bp
      JOIN booking_segments bs ON bp.booking_segment_id = bs.id
      JOIN bookings b ON bs.booking_id = b.id
      JOIN wagons w ON bp.wagon_id = w.id
      JOIN schedules s ON bs.schedule_id = s.id
      JOIN route_stops rso ON s.route_id = rso.route_id AND bs.origin_station_id = rso.station_id
      JOIN route_stops rsd ON s.route_id = rsd.route_id AND bs.destination_station_id = rsd.station_id
      WHERE bs.schedule_id = ?
        AND w.class = ?
        AND (b.payment_status = 'PAID' OR (b.payment_status = 'PENDING' AND b.locked_until > datetime('now')))
        AND rso.stop_order < ?
        AND ? < rsd.stop_order
    `);

    const results = [];

    for (const sched of matchedSchedules) {
      const origDep = addMinutesToTime(sched.base_departure_time, sched.origin_dep_offset);
      const destArr = addMinutesToTime(sched.base_departure_time, sched.dest_arr_offset);
      const durationMins = Math.max(1, sched.dest_arr_offset - sched.origin_dep_offset);
      const durationFormatted = formatDurationMinutes(durationMins);

      const rawFares = faresStmt.all(sched.schedule_id, originStation.id, destStation.id) as Array<{
        id: number;
        wagon_class: string;
        subclass: string;
        price: number;
        quota: number;
      }>;

      // Group and enrich fares
      const enrichedFares = rawFares.map((f) => {
        // Query occupied seats overlapping this segment for this class
        const overlapRes = overlapStmt.get(
          sched.schedule_id,
          f.wagon_class,
          sched.dest_order,
          sched.origin_order
        ) as { occupied_count: number } | undefined;

        const occupied = overlapRes?.occupied_count || 0;
        const availableSeats = Math.max(0, f.quota - occupied);

        return {
          fare_id: f.id,
          wagon_class: f.wagon_class,
          subclass: f.subclass,
          adult_price: f.price,
          infant_price: 0,
          quota: f.quota,
          occupied_seats: occupied,
          available_seats: availableSeats,
        };
      });

      results.push({
        schedule_id: sched.schedule_id,
        fleet_id: sched.fleet_id,
        fleet_name: sched.fleet_name,
        fleet_code: sched.fleet_code,
        fleet_type: sched.fleet_type,
        route_name: sched.route_name,
        direction: sched.direction,
        status: sched.status,
        gate_info: sched.gate_info,
        departure_date: sched.departure_date,
        base_departure_time: sched.base_departure_time,
        origin_departure_time: origDep.time,
        destination_arrival_time: destArr.time,
        days_added: destArr.daysAdded,
        duration_minutes: durationMins,
        duration_formatted: durationFormatted,
        origin_stop_order: sched.origin_order,
        destination_stop_order: sched.dest_order,
        fares: enrichedFares,
        lowest_price: enrichedFares.length > 0 ? Math.min(...enrichedFares.map((f) => f.adult_price)) : 0,
      });
    }

    return NextResponse.json({
      success: true,
      origin: originStation,
      destination: destStation,
      date: dateParam,
      adults: adultsParam,
      infants: infantsParam,
      total_results: results.length,
      schedules: results,
    });
  } catch (error) {
    console.error('Schedule search error:', error);
    return NextResponse.json({ error: 'Gagal melakukan pencarian jadwal' }, { status: 500 });
  }
}
