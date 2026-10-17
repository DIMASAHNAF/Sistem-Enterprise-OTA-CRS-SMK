import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';

const StopSchema = z.object({
  station_id: z.number().int().positive('Stasiun wajib dipilih'),
  stop_order: z.number().int().min(0),
  arrival_offset_minutes: z.number().int().min(0),
  departure_offset_minutes: z.number().int().min(0),
});

const RouteSchema = z.object({
  fleet_id: z.number().int().positive('Armada wajib dipilih'),
  route_name: z.string().trim().min(3, 'Nama rute minimal 3 karakter'),
  direction: z.enum(['OUTBOUND', 'INBOUND']),
  stops: z.array(StopSchema).min(2, 'Rute harus memiliki minimal 2 titik stasiun pemberhentian'),
});

// GET /api/revenue/routes
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const db = getDatabase();
    const routes = db.prepare(`
      SELECT r.*, f.name as fleet_name, f.code as fleet_code, f.type as fleet_type
      FROM routes r
      JOIN fleets f ON r.fleet_id = f.id
      ORDER BY r.id DESC
    `).all() as Array<{
      id: number;
      fleet_id: number;
      route_name: string;
      direction: string;
      created_at: string;
      fleet_name: string;
      fleet_code: string;
      fleet_type: string;
    }>;

    const stopsStmt = db.prepare(`
      SELECT rs.*, s.code as station_code, s.name as station_name, s.city as station_city, s.type as station_type
      FROM route_stops rs
      JOIN stations s ON rs.station_id = s.id
      ORDER BY rs.route_id ASC, rs.stop_order ASC
    `);
    const allStops = stopsStmt.all() as Array<{
      id: number;
      route_id: number;
      station_id: number;
      stop_order: number;
      arrival_offset_minutes: number;
      departure_offset_minutes: number;
      station_code: string;
      station_name: string;
      station_city: string;
      station_type: string;
    }>;

    const stopsByRoute: Record<number, typeof allStops> = {};
    for (const st of allStops) {
      if (!stopsByRoute[st.route_id]) stopsByRoute[st.route_id] = [];
      stopsByRoute[st.route_id].push(st);
    }

    const result = routes.map((r) => ({
      ...r,
      stops: stopsByRoute[r.id] || [],
    }));

    return NextResponse.json({ success: true, routes: result });
  } catch (error) {
    console.error('Fetch routes error:', error);
    return NextResponse.json({ error: 'Gagal memuat daftar rute' }, { status: 500 });
  }
}

// POST /api/revenue/routes
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const body = await request.json();
    const parse = RouteSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { fleet_id, route_name, direction, stops } = parse.data;

    // Strict Validation:
    // 1. No duplicate station in the same route
    const stationIds = stops.map((s) => s.station_id);
    if (new Set(stationIds).size !== stationIds.length) {
      return NextResponse.json({ error: 'Stasiun pemberhentian tidak boleh duplikat dalam satu rute yang sama.' }, { status: 400 });
    }

    // Sort stops by stop_order
    const sortedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);

    // 2. First stop arrival must be 0
    if (sortedStops[0].arrival_offset_minutes !== 0) {
      return NextResponse.json({ error: 'Stasiun asal (awal) harus memiliki menit tiba (arrival offset) = 0.' }, { status: 400 });
    }

    // 3. Sequential timeline consistency
    for (let i = 0; i < sortedStops.length; i++) {
      const curr = sortedStops[i];
      if (curr.arrival_offset_minutes > curr.departure_offset_minutes) {
        return NextResponse.json({
          error: `Stasiun ke-${i + 1}: Menit berangkat (${curr.departure_offset_minutes}m) tidak boleh lebih awal dari menit tiba (${curr.arrival_offset_minutes}m).`,
        }, { status: 400 });
      }

      if (i > 0) {
        const prev = sortedStops[i - 1];
        if (curr.arrival_offset_minutes <= prev.departure_offset_minutes) {
          return NextResponse.json({
            error: `Stasiun ke-${i + 1}: Menit tiba (${curr.arrival_offset_minutes}m) harus lebih besar dari menit berangkat stasiun sebelumnya (${prev.departure_offset_minutes}m).`,
          }, { status: 400 });
        }
      }
    }

    const db = getDatabase();

    // Transactional insert
    const insertRoute = db.prepare(`
      INSERT INTO routes (fleet_id, route_name, direction)
      VALUES (?, ?, ?)
    `);
    const rRes = insertRoute.run(fleet_id, route_name, direction);
    const newRouteId = Number(rRes.lastInsertRowid);

    const insertStop = db.prepare(`
      INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let idx = 0; idx < sortedStops.length; idx++) {
      const st = sortedStops[idx];
      insertStop.run(newRouteId, st.station_id, idx, st.arrival_offset_minutes, st.departure_offset_minutes);
    }

    logAudit({
      userId: user.id,
      action: 'ROUTE_CREATE',
      targetId: String(newRouteId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { routeId: newRouteId, route_name, direction, stopsCount: sortedStops.length },
    });

    return NextResponse.json({
      success: true,
      message: 'Rute berarah dan urutan transit berhasil dibuat',
      routeId: newRouteId,
    }, { status: 201 });
  } catch (error) {
    console.error('Create route error:', error);
    return NextResponse.json({ error: 'Gagal membuat rute baru' }, { status: 500 });
  }
}

// DELETE /api/revenue/routes
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID rute wajib disertakan' }, { status: 400 });

    const db = getDatabase();
    const schedules = db.prepare('SELECT COUNT(*) as count FROM schedules WHERE route_id = ?').get(id) as { count: number };
    if (schedules.count > 0) {
      return NextResponse.json({
        error: `Rute tidak dapat dihapus karena masih digunakan pada ${schedules.count} jadwal perjalanan aktif. Hapus jadwal terlebih dahulu.`,
      }, { status: 400 });
    }

    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(id) as { route_name: string } | undefined;
    db.prepare('DELETE FROM route_stops WHERE route_id = ?').run(id);
    db.prepare('DELETE FROM routes WHERE id = ?').run(id);

    logAudit({
      userId: user.id,
      action: 'ROUTE_DELETE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id, name: route?.route_name },
    });

    return NextResponse.json({ success: true, message: 'Rute berhasil dihapus' });
  } catch (error) {
    console.error('Delete route error:', error);
    return NextResponse.json({ error: 'Gagal menghapus rute' }, { status: 500 });
  }
}
