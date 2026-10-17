import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';

// GET /api/revenue/schedules/[id]/fares
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const { id } = await context.params;
    const scheduleId = Number(id);
    if (!scheduleId) return NextResponse.json({ error: 'ID jadwal tidak valid' }, { status: 400 });

    const db = getDatabase();

    // Verify schedule
    const schedule = db.prepare(`
      SELECT s.*, r.route_name, r.direction, f.name as fleet_name, f.code as fleet_code
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      WHERE s.id = ?
    `).get(scheduleId);

    if (!schedule) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
    }

    const fares = db.prepare(`
      SELECT sf.*,
             s1.code as origin_code, s1.name as origin_name, s1.city as origin_city,
             s2.code as dest_code, s2.name as dest_name, s2.city as dest_city,
             rs1.stop_order as origin_order, rs2.stop_order as dest_order,
             rs1.departure_offset_minutes as origin_dep_offset,
             rs2.arrival_offset_minutes as dest_arr_offset
      FROM schedule_fares sf
      JOIN stations s1 ON sf.origin_station_id = s1.id
      JOIN stations s2 ON sf.destination_station_id = s2.id
      JOIN schedules sched ON sf.schedule_id = sched.id
      JOIN route_stops rs1 ON sched.route_id = rs1.route_id AND rs1.station_id = sf.origin_station_id
      JOIN route_stops rs2 ON sched.route_id = rs2.route_id AND rs2.station_id = sf.destination_station_id
      WHERE sf.schedule_id = ?
      ORDER BY rs1.stop_order ASC, rs2.stop_order ASC, sf.wagon_class ASC, sf.subclass ASC
    `).all(scheduleId);

    return NextResponse.json({ success: true, schedule, fares });
  } catch (error) {
    console.error('Fetch schedule fares error:', error);
    return NextResponse.json({ error: 'Gagal memuat matriks tarif' }, { status: 500 });
  }
}

// PUT /api/revenue/schedules/[id]/fares
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const { id } = await context.params;
    const scheduleId = Number(id);
    if (!scheduleId) return NextResponse.json({ error: 'ID jadwal tidak valid' }, { status: 400 });

    const db = getDatabase();
    const schedule = db.prepare(`
      SELECT s.*, r.id as route_id
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      WHERE s.id = ?
    `).get(scheduleId) as { id: number; route_id: number } | undefined;

    if (!schedule) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();

    // Mode 1: Bulk Auto-Calculator
    if (body.bulk_calculator) {
      const {
        executive_base_price = 240000,
        business_base_price = 170000,
        economy_base_price = 130000,
        promo_discount_percent = 15,
      } = body.bulk_calculator;

      const promoRatio = Math.max(0.5, Math.min(1.0, (100 - promo_discount_percent) / 100));

      const stops = db.prepare(`
        SELECT rs.* FROM route_stops rs
        WHERE rs.route_id = ?
        ORDER BY rs.stop_order ASC
      `).all(schedule.route_id) as Array<{
        station_id: number;
        stop_order: number;
        arrival_offset_minutes: number;
        departure_offset_minutes: number;
      }>;

      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];
      const totalJourneyMinutes = Math.max(1, lastStop.arrival_offset_minutes - firstStop.departure_offset_minutes);

      const updateStmt = db.prepare(`
        UPDATE schedule_fares
        SET price = ?
        WHERE id = ?
      `);

      const currentFares = db.prepare(`
        SELECT sf.*,
               rs1.departure_offset_minutes as origin_dep,
               rs2.arrival_offset_minutes as dest_arr
        FROM schedule_fares sf
        JOIN schedules s ON sf.schedule_id = s.id
        JOIN route_stops rs1 ON s.route_id = rs1.route_id AND rs1.station_id = sf.origin_station_id
        JOIN route_stops rs2 ON s.route_id = rs2.route_id AND rs2.station_id = sf.destination_station_id
        WHERE sf.schedule_id = ?
      `).all(scheduleId) as Array<{
        id: number;
        wagon_class: string;
        subclass: string;
        origin_dep: number;
        dest_arr: number;
      }>;

      let count = 0;
      for (const f of currentFares) {
        const segDuration = Math.max(1, f.dest_arr - f.origin_dep);
        const proportion = Math.max(0.25, Math.min(1.0, segDuration / totalJourneyMinutes));

        let basePrice = economy_base_price;
        if (f.wagon_class === 'EXECUTIVE') basePrice = executive_base_price;
        else if (f.wagon_class === 'BUSINESS') basePrice = business_base_price;

        const isPromo = f.subclass === 'H' || f.subclass === 'K' || f.subclass === 'P';
        const tierRatio = isPromo ? promoRatio : 1.0;

        const recalculatedPrice = Math.max(
          25000,
          Math.round((basePrice * proportion * tierRatio) / 5000) * 5000
        );

        updateStmt.run(recalculatedPrice, f.id);
        count++;
      }

      logAudit({
        userId: user.id,
        action: 'SCHEDULE_FARES_AUTO_CALCULATE',
        targetId: String(scheduleId),
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: { scheduleId, faresRecalculated: count, bulkParams: body.bulk_calculator },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mengkalkulasi ulang ${count} baris tarif segmen secara otomatis!`,
      });
    }

    // Mode 2: Manual Update of specific fares
    if (Array.isArray(body.fares)) {
      const updateStmt = db.prepare(`
        UPDATE schedule_fares
        SET price = ?, quota = ?
        WHERE id = ? AND schedule_id = ?
      `);

      let updatedCount = 0;
      for (const f of body.fares) {
        if (typeof f.id === 'number' && typeof f.price === 'number' && typeof f.quota === 'number') {
          updateStmt.run(Math.max(0, f.price), Math.max(0, f.quota), f.id, scheduleId);
          updatedCount++;
        }
      }

      logAudit({
        userId: user.id,
        action: 'SCHEDULE_FARES_UPDATE',
        targetId: String(scheduleId),
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: { scheduleId, faresUpdated: updatedCount },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil memperbarui ${updatedCount} baris tarif segmen`,
      });
    }

    return NextResponse.json({ error: 'Format data tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Update schedule fares error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui tarif jadwal' }, { status: 500 });
  }
}
