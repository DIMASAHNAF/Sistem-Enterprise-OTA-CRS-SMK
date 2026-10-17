import React from 'react';
import { getDatabase } from '@/lib/db';
import RouteBuilderClient from './RouteBuilderClient';

export const dynamic = 'force-dynamic';

export default function RoutesPage() {
  const db = getDatabase();

  const routes = db.prepare(`
    SELECT r.*, f.name as fleet_name, f.code as fleet_code, f.type as fleet_type
    FROM routes r
    JOIN fleets f ON r.fleet_id = f.id
    ORDER BY r.id DESC
  `).all() as unknown as Array<{
    id: number;
    fleet_id: number;
    route_name: string;
    direction: 'OUTBOUND' | 'INBOUND';
    created_at: string;
    fleet_name: string;
    fleet_code: string;
    fleet_type: string;
  }>;

  const allStops = db.prepare(`
    SELECT rs.*, s.code as station_code, s.name as station_name, s.city as station_city, s.type as station_type
    FROM route_stops rs
    JOIN stations s ON rs.station_id = s.id
    ORDER BY rs.route_id ASC, rs.stop_order ASC
  `).all() as unknown as Array<{
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

  const routesWithStops = routes.map((r) => ({
    ...r,
    stops: stopsByRoute[r.id] || [],
  }));

  const stations = db.prepare(`
    SELECT id, code, name, city, type
    FROM stations
    ORDER BY city ASC, name ASC
  `).all() as unknown as Array<{
    id: number;
    code: string;
    name: string;
    city: string;
    type: string;
  }>;

  const fleets = db.prepare(`
    SELECT id, code, name, type
    FROM fleets
    WHERE status = 'ACTIVE'
    ORDER BY type ASC, name ASC
  `).all() as unknown as Array<{
    id: number;
    code: string;
    name: string;
    type: string;
  }>;

  return (
    <RouteBuilderClient
      initialRoutes={routesWithStops}
      stations={stations}
      fleets={fleets}
    />
  );
}
