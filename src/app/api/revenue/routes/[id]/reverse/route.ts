import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue Controller' }, { status: 403 });
    }

    const { id } = await context.params;
    const routeId = Number(id);
    if (!routeId) {
      return NextResponse.json({ error: 'ID rute tidak valid' }, { status: 400 });
    }

    const db = getDatabase();
    const sourceRoute = db.prepare(`
      SELECT r.*, f.name as fleet_name, f.code as fleet_code
      FROM routes r
      JOIN fleets f ON r.fleet_id = f.id
      WHERE r.id = ?
    `).get(routeId) as {
      id: number;
      fleet_id: number;
      route_name: string;
      direction: string;
      fleet_name: string;
      fleet_code: string;
    } | undefined;

    if (!sourceRoute) {
      return NextResponse.json({ error: 'Rute sumber tidak ditemukan' }, { status: 404 });
    }

    const stops = db.prepare(`
      SELECT rs.*, s.name as station_name, s.code as station_code, s.city as station_city
      FROM route_stops rs
      JOIN stations s ON rs.station_id = s.id
      WHERE rs.route_id = ?
      ORDER BY rs.stop_order ASC
    `).all(routeId) as Array<{
      id: number;
      station_id: number;
      stop_order: number;
      arrival_offset_minutes: number;
      departure_offset_minutes: number;
      station_name: string;
      station_code: string;
      station_city: string;
    }>;

    if (stops.length < 2) {
      return NextResponse.json({ error: 'Rute sumber harus memiliki minimal 2 titik stasiun untuk dapat dibalik' }, { status: 400 });
    }

    // Determine reversed direction and name
    const newDirection = sourceRoute.direction === 'OUTBOUND' ? 'INBOUND' : 'OUTBOUND';
    
    // Reverse stations order
    const reversedStations = [...stops].reverse();
    const firstNewStation = reversedStations[0];
    const lastNewStation = reversedStations[reversedStations.length - 1];

    let newRouteName = `${sourceRoute.fleet_name} (${firstNewStation.station_city} - ${lastNewStation.station_city})`;
    // Check if optional custom route_name provided in body
    try {
      const body = await request.json();
      if (body && body.route_name && typeof body.route_name === 'string' && body.route_name.trim().length > 0) {
        newRouteName = body.route_name.trim();
      }
    } catch {
      // Body not provided or empty, use generated name
    }

    // Calculate reversed arrival and departure offset minutes
    // N stops: 0 to N-1
    // stops[i]
    // run time between original (i-1) and (i) is stops[i].arr - stops[i-1].dep
    // dwell time at original i is stops[i].dep - stops[i].arr
    const newStops: Array<{
      station_id: number;
      stop_order: number;
      arrival_offset_minutes: number;
      departure_offset_minutes: number;
    }> = [];

    let currentDep = 0;
    for (let k = 0; k < reversedStations.length; k++) {
      const origIndex = reversedStations.length - 1 - k; // original index
      if (k === 0) {
        newStops.push({
          station_id: reversedStations[0].station_id,
          stop_order: 0,
          arrival_offset_minutes: 0,
          departure_offset_minutes: 0,
        });
        currentDep = 0;
      } else {
        // running time from previous reversed station to this station
        // In original sequence, this was travel from origIndex to origIndex + 1
        const runTime = stops[origIndex + 1].arrival_offset_minutes - stops[origIndex].departure_offset_minutes;
        const arr = currentDep + Math.max(1, runTime);
        
        let dep = arr;
        if (k < reversedStations.length - 1) {
          // intermediate stop has dwell time from original stop
          const dwell = stops[origIndex].departure_offset_minutes - stops[origIndex].arrival_offset_minutes;
          dep = arr + Math.max(0, dwell);
        }

        newStops.push({
          station_id: reversedStations[k].station_id,
          stop_order: k,
          arrival_offset_minutes: arr,
          departure_offset_minutes: dep,
        });
        currentDep = dep;
      }
    }

    // Insert new route
    const insertRouteStmt = db.prepare(`
      INSERT INTO routes (fleet_id, route_name, direction)
      VALUES (?, ?, ?)
    `);
    const rRes = insertRouteStmt.run(sourceRoute.fleet_id, newRouteName, newDirection);
    const newRouteId = Number(rRes.lastInsertRowid);

    const insertStopStmt = db.prepare(`
      INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const ns of newStops) {
      insertStopStmt.run(newRouteId, ns.station_id, ns.stop_order, ns.arrival_offset_minutes, ns.departure_offset_minutes);
    }

    logAudit({
      userId: user.id,
      action: 'ROUTE_REVERSE_GENERATE',
      targetId: String(newRouteId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        sourceRouteId: routeId,
        newRouteId,
        routeName: newRouteName,
        direction: newDirection,
        totalStops: newStops.length,
        totalDurationMinutes: currentDep,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Rute pulang (${newDirection}) berhasil digenerate otomatis!`,
      routeId: newRouteId,
      routeName: newRouteName,
      direction: newDirection,
    }, { status: 201 });
  } catch (error) {
    console.error('Reverse route error:', error);
    return NextResponse.json({ error: 'Gagal melakukan reverse route otomatis' }, { status: 500 });
  }
}
