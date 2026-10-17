import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/travel.db');

const query = `
  SELECT 
    s.id,
    s.route_id,
    s.departure_date,
    s.base_departure_time,
    s.status,
    s.gate_info,
    r.route_name,
    r.direction,
    f.name as fleet_name,
    f.code as fleet_code,
    f.type as fleet_type,
    MIN(sf.price) as min_price,
    SUM(sf.quota) as total_quota,
    (SELECT s_orig.code FROM route_stops rs_orig JOIN stations s_orig ON rs_orig.station_id = s_orig.id WHERE rs_orig.route_id = r.id ORDER BY rs_orig.stop_order ASC LIMIT 1) as origin_code,
    (SELECT s_orig.name FROM route_stops rs_orig JOIN stations s_orig ON rs_orig.station_id = s_orig.id WHERE rs_orig.route_id = r.id ORDER BY rs_orig.stop_order ASC LIMIT 1) as origin_name,
    (SELECT s_dest.code FROM route_stops rs_dest JOIN stations s_dest ON rs_dest.station_id = s_dest.id WHERE rs_dest.route_id = r.id ORDER BY rs_dest.stop_order DESC LIMIT 1) as dest_code,
    (SELECT s_dest.name FROM route_stops rs_dest JOIN stations s_dest ON rs_dest.station_id = s_dest.id WHERE rs_dest.route_id = r.id ORDER BY rs_dest.stop_order DESC LIMIT 1) as dest_name,
    (SELECT MAX(arrival_offset_minutes) FROM route_stops WHERE route_id = r.id) as trip_duration_minutes
  FROM schedules s
  JOIN routes r ON s.route_id = r.id
  JOIN fleets f ON r.fleet_id = f.id
  JOIN schedule_fares sf ON s.id = sf.schedule_id
  GROUP BY s.route_id
  ORDER BY s.base_departure_time ASC
  LIMIT 4
`;

const results = db.prepare(query).all();
console.log('QUERY RESULTS:');
for (const r of results) {
  console.log({
    id: r.id,
    fleet: r.fleet_name,
    time: r.base_departure_time,
    route: r.route_name,
    dir: r.direction,
    origin: r.origin_code,
    dest: r.dest_code,
    duration: r.trip_duration_minutes,
    min_price: r.min_price
  });
}
