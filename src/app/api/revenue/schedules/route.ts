import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';

const CreateScheduleSchema = z.object({
  route_id: z.number().int().positive('Rute perjalanan wajib dipilih'),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  base_departure_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam keberangkatan harus HH:MM'),
  gate_info: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'DELAYED', 'DEPARTED']).default('OPEN'),
  base_executive_fare: z.number().int().min(10000).optional(),
  base_business_fare: z.number().int().min(10000).optional(),
  base_economy_fare: z.number().int().min(10000).optional(),
});

function getSeatsPerRow(layout: string): number {
  switch (layout) {
    case '2-2':
      return 4;
    case '3-2':
      return 5;
    case '2-1':
      return 3;
    default:
      return 4;
  }
}

// GET /api/revenue/schedules
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const routeId = searchParams.get('route_id');

    const db = getDatabase();
    let query = `
      SELECT s.*, r.route_name, r.direction, r.fleet_id,
             f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
             (SELECT COUNT(*) FROM schedule_fares WHERE schedule_id = s.id) as total_fares,
             (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id) as total_stops
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (date) {
      query += ` AND s.departure_date = ?`;
      params.push(date);
    }
    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }
    if (routeId) {
      query += ` AND s.route_id = ?`;
      params.push(Number(routeId));
    }

    query += ` ORDER BY s.departure_date DESC, s.base_departure_time ASC`;

    const schedules = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    console.error('Fetch schedules error:', error);
    return NextResponse.json({ error: 'Gagal memuat jadwal' }, { status: 500 });
  }
}

// POST /api/revenue/schedules
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const body = await request.json();
    const parse = CreateScheduleSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const {
      route_id,
      departure_date,
      base_departure_time,
      gate_info,
      status,
      base_executive_fare = 240000,
      base_business_fare = 170000,
      base_economy_fare = 130000,
    } = parse.data;

    const db = getDatabase();

    // 1. Verify route and get stops
    const route = db.prepare(`
      SELECT r.*, f.name as fleet_name, f.code as fleet_code
      FROM routes r
      JOIN fleets f ON r.fleet_id = f.id
      WHERE r.id = ?
    `).get(route_id) as {
      id: number;
      fleet_id: number;
      route_name: string;
      direction: string;
      fleet_name: string;
      fleet_code: string;
    } | undefined;

    if (!route) {
      return NextResponse.json({ error: 'Rute tidak ditemukan' }, { status: 404 });
    }

    const stops = db.prepare(`
      SELECT rs.*, s.code as station_code, s.name as station_name
      FROM route_stops rs
      JOIN stations s ON rs.station_id = s.id
      WHERE rs.route_id = ?
      ORDER BY rs.stop_order ASC
    `).all(route_id) as Array<{
      id: number;
      station_id: number;
      stop_order: number;
      arrival_offset_minutes: number;
      departure_offset_minutes: number;
      station_code: string;
      station_name: string;
    }>;

    if (stops.length < 2) {
      return NextResponse.json({ error: 'Rute harus memiliki minimal 2 titik stasiun untuk membuat jadwal' }, { status: 400 });
    }

    // 2. Determine classes and seat capacity from fleet wagons
    const wagons = db.prepare(`
      SELECT class, rows, cols_layout
      FROM wagons
      WHERE fleet_id = ?
    `).all(route.fleet_id) as Array<{
      class: string;
      rows: number;
      cols_layout: string;
    }>;

    const classSeatsMap: Record<string, number> = {};
    for (const w of wagons) {
      const seats = w.rows * getSeatsPerRow(w.cols_layout);
      classSeatsMap[w.class] = (classSeatsMap[w.class] || 0) + seats;
    }

    const availableClasses = Object.keys(classSeatsMap);
    if (availableClasses.length === 0) {
      // Fallback if no wagons configured yet
      availableClasses.push('EXECUTIVE', 'ECONOMY');
      classSeatsMap['EXECUTIVE'] = 50;
      classSeatsMap['ECONOMY'] = 80;
    }

    // Subclass tiers
    const subclassTiers: Record<string, Array<{ subclass: string; ratio: number; quotaRatio: number }>> = {
      EXECUTIVE: [
        { subclass: 'A', ratio: 1.0, quotaRatio: 0.7 },
        { subclass: 'H', ratio: 0.85, quotaRatio: 0.3 },
      ],
      BUSINESS: [
        { subclass: 'B', ratio: 1.0, quotaRatio: 0.7 },
        { subclass: 'K', ratio: 0.85, quotaRatio: 0.3 },
      ],
      ECONOMY: [
        { subclass: 'C', ratio: 1.0, quotaRatio: 0.7 },
        { subclass: 'P', ratio: 0.85, quotaRatio: 0.3 },
      ],
    };

    // 3. Insert schedule
    const insertSchedStmt = db.prepare(`
      INSERT INTO schedules (route_id, departure_date, base_departure_time, gate_info, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const schedRes = insertSchedStmt.run(route_id, departure_date, base_departure_time, gate_info || null, status);
    const newScheduleId = Number(schedRes.lastInsertRowid);

    // 4. Combinatorial Segment Fare Generator: N*(N-1)/2 segments
    const insertFareStmt = db.prepare(`
      INSERT INTO schedule_fares (
        schedule_id, origin_station_id, destination_station_id, wagon_class, subclass, price, quota
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];
    const totalJourneyMinutes = Math.max(1, lastStop.arrival_offset_minutes - firstStop.departure_offset_minutes);

    let generatedSegmentsCount = 0;
    let totalFareRowsCount = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const origin = stops[i];
        const dest = stops[j];
        generatedSegmentsCount++;

        // Travel time for this specific segment
        const segDuration = Math.max(1, dest.arrival_offset_minutes - origin.departure_offset_minutes);
        // Time proportion with min bound 0.25 to prevent trivially zero fares
        const proportion = Math.max(0.25, Math.min(1.0, segDuration / totalJourneyMinutes));

        for (const cls of availableClasses) {
          const totalSeats = classSeatsMap[cls] || 50;
          let baseFare = base_economy_fare;
          if (cls === 'EXECUTIVE') baseFare = base_executive_fare;
          else if (cls === 'BUSINESS') baseFare = base_business_fare;

          const tiers = subclassTiers[cls] || [{ subclass: 'A', ratio: 1.0, quotaRatio: 1.0 }];

          for (const tier of tiers) {
            // Price rounded to nearest 5,000 IDR
            const calculatedPrice = Math.max(
              25000,
              Math.round((baseFare * proportion * tier.ratio) / 5000) * 5000
            );
            // Quota
            const quota = Math.max(5, Math.round(totalSeats * tier.quotaRatio));

            insertFareStmt.run(
              newScheduleId,
              origin.station_id,
              dest.station_id,
              cls,
              tier.subclass,
              calculatedPrice,
              quota
            );
            totalFareRowsCount++;
          }
        }
      }
    }

    logAudit({
      userId: user.id,
      action: 'SCHEDULE_CREATE',
      targetId: String(newScheduleId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        scheduleId: newScheduleId,
        routeId: route_id,
        routeName: route.route_name,
        departureDate: departure_date,
        baseDepartureTime: base_departure_time,
        totalSegments: generatedSegmentsCount,
        totalFareRows: totalFareRowsCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Jadwal operasional berhasil dibuka dengan ${generatedSegmentsCount} segmen perjalanan & ${totalFareRowsCount} matriks tarif otomatis!`,
      scheduleId: newScheduleId,
      totalSegments: generatedSegmentsCount,
      totalFareRows: totalFareRowsCount,
    }, { status: 201 });
  } catch (error) {
    console.error('Create schedule error:', error);
    return NextResponse.json({ error: 'Gagal membuka jadwal dan menghasilkan matriks tarif' }, { status: 500 });
  }
}

// PATCH /api/revenue/schedules
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, gate_info } = body;
    if (!id) return NextResponse.json({ error: 'ID jadwal wajib disertakan' }, { status: 400 });

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as { id: number; status: string } | undefined;
    if (!existing) return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (gate_info !== undefined) {
      updates.push('gate_info = ?');
      params.push(gate_info);
    }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    logAudit({
      userId: user.id,
      action: 'SCHEDULE_UPDATE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id, updates: body },
    });

    return NextResponse.json({ success: true, message: 'Status jadwal berhasil diperbarui' });
  } catch (error) {
    console.error('Update schedule error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui jadwal' }, { status: 500 });
  }
}

// DELETE /api/revenue/schedules
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID jadwal wajib disertakan' }, { status: 400 });

    const db = getDatabase();

    // Check if bookings exist
    const bookings = db.prepare('SELECT COUNT(*) as count FROM booking_segments WHERE schedule_id = ?').get(id) as { count: number };
    if (bookings.count > 0) {
      return NextResponse.json({
        error: `Jadwal tidak dapat dihapus karena sudah memiliki ${bookings.count} pemesanan tiket aktif. Ubah status menjadi CLOSED.`,
      }, { status: 400 });
    }

    db.prepare('DELETE FROM schedule_fares WHERE schedule_id = ?').run(id);
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

    logAudit({
      userId: user.id,
      action: 'SCHEDULE_DELETE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id },
    });

    return NextResponse.json({ success: true, message: 'Jadwal dan matriks tarif berhasil dihapus' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return NextResponse.json({ error: 'Gagal menghapus jadwal' }, { status: 500 });
  }
}
