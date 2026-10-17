import React from 'react';
import { getDatabase } from '@/lib/db';
import SchedulesRevenueClient from './SchedulesRevenueClient';

export const dynamic = 'force-dynamic';

export default function SchedulesRevenuePage() {
  const db = getDatabase();

  const schedules = db.prepare(`
    SELECT s.*, r.route_name, r.direction, r.fleet_id,
           f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
           (SELECT COUNT(*) FROM schedule_fares WHERE schedule_id = s.id) as total_fares,
           (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id) as total_stops
    FROM schedules s
    JOIN routes r ON s.route_id = r.id
    JOIN fleets f ON r.fleet_id = f.id
    ORDER BY s.departure_date DESC, s.base_departure_time ASC
  `).all() as unknown as Array<{
    id: number;
    route_id: number;
    route_name: string;
    direction: 'OUTBOUND' | 'INBOUND';
    fleet_name: string;
    fleet_code: string;
    fleet_type: string;
    departure_date: string;
    base_departure_time: string;
    status: 'OPEN' | 'CLOSED' | 'DELAYED' | 'DEPARTED';
    gate_info: string | null;
    total_fares: number;
    total_stops: number;
  }>;

  const routes = db.prepare(`
    SELECT r.id, r.route_name, r.direction,
           f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
           (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id) as total_stops
    FROM routes r
    JOIN fleets f ON r.fleet_id = f.id
    ORDER BY r.id DESC
  `).all() as unknown as Array<{
    id: number;
    route_name: string;
    direction: 'OUTBOUND' | 'INBOUND';
    fleet_name: string;
    fleet_code: string;
    fleet_type: string;
    total_stops: number;
  }>;

  return (
    <SchedulesRevenueClient
      initialSchedules={schedules}
      routes={routes}
    />
  );
}
