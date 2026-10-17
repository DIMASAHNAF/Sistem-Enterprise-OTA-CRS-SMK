import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { releaseExpiredBookings } from '@/lib/booking/generator';

export const dynamic = 'force-dynamic';

function getColumnsByLayout(layout: string): { leftCols: string[]; rightCols: string[]; allCols: string[] } {
  switch (layout) {
    case '2-2':
      return { leftCols: ['A', 'B'], rightCols: ['C', 'D'], allCols: ['A', 'B', 'C', 'D'] };
    case '3-2':
      return { leftCols: ['A', 'B', 'C'], rightCols: ['D', 'E'], allCols: ['A', 'B', 'C', 'D', 'E'] };
    case '2-1':
      return { leftCols: ['A', 'B'], rightCols: ['C'], allCols: ['A', 'B', 'C'] };
    default:
      return { leftCols: ['A', 'B'], rightCols: ['C', 'D'], allCols: ['A', 'B', 'C', 'D'] };
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const scheduleId = Number(id);
    if (!scheduleId) {
      return NextResponse.json({ error: 'ID jadwal tidak valid' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const originStationId = Number(searchParams.get('origin_station_id'));
    const destStationId = Number(searchParams.get('destination_station_id'));
    const wagonClassFilter = searchParams.get('wagon_class')?.toUpperCase();

    if (!originStationId || !destStationId) {
      return NextResponse.json(
        { error: 'Parameter origin_station_id dan destination_station_id wajib disertakan.' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    releaseExpiredBookings(db);

    // 1. Verify schedule, route, and fleet
    const schedule = db.prepare(`
      SELECT s.*, r.route_name, r.direction, r.fleet_id,
             f.name as fleet_name, f.code as fleet_code, f.type as fleet_type
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      WHERE s.id = ?
    `).get(scheduleId) as {
      id: number;
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
    } | undefined;

    if (!schedule) {
      return NextResponse.json({ error: 'Jadwal perjalanan tidak ditemukan.' }, { status: 404 });
    }

    // 2. Lookup stop orders for origin and destination
    const origStop = db.prepare(`
      SELECT rs.*, s.code, s.name, s.city
      FROM route_stops rs
      JOIN stations s ON rs.station_id = s.id
      WHERE rs.route_id = ? AND rs.station_id = ?
    `).get(schedule.route_id, originStationId) as {
      stop_order: number;
      code: string;
      name: string;
      city: string;
    } | undefined;

    const destStop = db.prepare(`
      SELECT rs.*, s.code, s.name, s.city
      FROM route_stops rs
      JOIN stations s ON rs.station_id = s.id
      WHERE rs.route_id = ? AND rs.station_id = ?
    `).get(schedule.route_id, destStationId) as {
      stop_order: number;
      code: string;
      name: string;
      city: string;
    } | undefined;

    if (!origStop || !destStop) {
      return NextResponse.json(
        { error: 'Stasiun asal atau tujuan tidak berada dalam rute jadwal perjalanan ini.' },
        { status: 400 }
      );
    }

    if (origStop.stop_order >= destStop.stop_order) {
      return NextResponse.json(
        { error: 'Stasiun asal harus berada sebelum stasiun tujuan pada rute berarah.' },
        { status: 400 }
      );
    }

    // 3. Query wagons for fleet
    let wagonsQuery = `
      SELECT id, fleet_id, wagon_code, class, rows, cols_layout, direction_indicator
      FROM wagons
      WHERE fleet_id = ?
    `;
    const wagonsParams: (string | number)[] = [schedule.fleet_id];

    if (wagonClassFilter) {
      wagonsQuery += ` AND class = ?`;
      wagonsParams.push(wagonClassFilter);
    }

    wagonsQuery += ` ORDER BY wagon_code ASC`;
    const wagons = db.prepare(wagonsQuery).all(...wagonsParams) as Array<{
      id: number;
      fleet_id: number;
      wagon_code: string;
      class: string;
      rows: number;
      cols_layout: string;
      direction_indicator: string;
    }>;

    // 4. Query occupied seats that overlap this segment
    // Segment Overlap Rule: exist_origin < req_dest AND req_origin < exist_dest
    const occupiedSeats = db.prepare(`
      SELECT bp.wagon_id, bp.seat_number, b.payment_status, b.locked_until
      FROM booking_passengers bp
      JOIN booking_segments bs ON bp.booking_segment_id = bs.id
      JOIN bookings b ON bs.booking_id = b.id
      JOIN schedules s ON bs.schedule_id = s.id
      JOIN route_stops rso ON s.route_id = rso.route_id AND bs.origin_station_id = rso.station_id
      JOIN route_stops rsd ON s.route_id = rsd.route_id AND bs.destination_station_id = rsd.station_id
      WHERE bs.schedule_id = ?
        AND (b.payment_status = 'PAID' OR (b.payment_status = 'PENDING' AND b.locked_until > datetime('now')))
        AND rso.stop_order < ?
        AND ? < rsd.stop_order
    `).all(scheduleId, destStop.stop_order, origStop.stop_order) as Array<{
      wagon_id: number;
      seat_number: string;
      payment_status: string;
      locked_until: string | null;
    }>;

    const occupiedMap: Record<string, { status: 'BOOKED' | 'LOCKED'; locked_until: string | null }> = {};
    for (const occ of occupiedSeats) {
      const key = `${occ.wagon_id}_${occ.seat_number}`;
      if (occ.payment_status === 'PAID') {
        occupiedMap[key] = { status: 'BOOKED', locked_until: null };
      } else {
        occupiedMap[key] = { status: 'LOCKED', locked_until: occ.locked_until };
      }
    }

    // 5. Build Seat Grid per Wagon
    const wagonSeatMaps = wagons.map((w) => {
      const { leftCols, rightCols, allCols } = getColumnsByLayout(w.cols_layout);
      const rowsList = [];
      let availableCount = 0;
      let bookedCount = 0;
      let lockedCount = 0;

      for (let r = 1; r <= w.rows; r++) {
        const leftSeats = leftCols.map((col) => {
          const seatNum = `${r}${col}`;
          const key = `${w.id}_${seatNum}`;
          const occ = occupiedMap[key];
          let status: 'AVAILABLE' | 'BOOKED' | 'LOCKED' = 'AVAILABLE';
          let lockedUntil: string | null = null;

          if (occ) {
            status = occ.status;
            lockedUntil = occ.locked_until;
            if (status === 'BOOKED') bookedCount++;
            else lockedCount++;
          } else {
            availableCount++;
          }

          return {
            seat_number: seatNum,
            row: r,
            col,
            status,
            locked_until: lockedUntil,
          };
        });

        const rightSeats = rightCols.map((col) => {
          const seatNum = `${r}${col}`;
          const key = `${w.id}_${seatNum}`;
          const occ = occupiedMap[key];
          let status: 'AVAILABLE' | 'BOOKED' | 'LOCKED' = 'AVAILABLE';
          let lockedUntil: string | null = null;

          if (occ) {
            status = occ.status;
            lockedUntil = occ.locked_until;
            if (status === 'BOOKED') bookedCount++;
            else lockedCount++;
          } else {
            availableCount++;
          }

          return {
            seat_number: seatNum,
            row: r,
            col,
            status,
            locked_until: lockedUntil,
          };
        });

        rowsList.push({
          row_number: r,
          left_seats: leftSeats,
          right_seats: rightSeats,
          all_seats: [...leftSeats, ...rightSeats],
        });
      }

      return {
        id: w.id,
        wagon_code: w.wagon_code,
        class: w.class,
        rows: w.rows,
        cols_layout: w.cols_layout,
        direction_indicator: w.direction_indicator,
        total_seats: w.rows * allCols.length,
        available_seats: availableCount,
        booked_seats: bookedCount,
        locked_seats: lockedCount,
        seat_rows: rowsList,
      };
    });

    return NextResponse.json({
      success: true,
      schedule: {
        id: schedule.id,
        route_name: schedule.route_name,
        direction: schedule.direction,
        fleet_name: schedule.fleet_name,
        fleet_code: schedule.fleet_code,
        fleet_type: schedule.fleet_type,
        departure_date: schedule.departure_date,
        base_departure_time: schedule.base_departure_time,
      },
      segment: {
        origin: {
          id: originStationId,
          code: origStop.code,
          name: origStop.name,
          city: origStop.city,
          stop_order: origStop.stop_order,
        },
        destination: {
          id: destStationId,
          code: destStop.code,
          name: destStop.name,
          city: destStop.city,
          stop_order: destStop.stop_order,
        },
      },
      wagons: wagonSeatMaps,
    });
  } catch (error) {
    console.error('Fetch seat map error:', error);
    return NextResponse.json({ error: 'Gagal memuat peta kursi gerbong' }, { status: 500 });
  }
}
