import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/travel.db');

// 1. Delete test routes
const testRoutes = db.prepare(`SELECT id FROM routes WHERE route_name LIKE '%Test%'`).all();
for (const tr of testRoutes) {
  db.prepare(`DELETE FROM schedule_fares WHERE schedule_id IN (SELECT id FROM schedules WHERE route_id = ?)`).run(tr.id);
  db.prepare(`DELETE FROM schedules WHERE route_id = ?`).run(tr.id);
  db.prepare(`DELETE FROM route_stops WHERE route_id = ?`).run(tr.id);
  db.prepare(`DELETE FROM routes WHERE id = ?`).run(tr.id);
}
console.log(`Cleaned ${testRoutes.length} test routes.`);

// 2. Check or create Route for KA Putri Deli (Fleet 2: PTR-DEL)
// Route Outbound: Medan (1) -> Lubuk Pakam (2) -> Tebing Tinggi (3) -> Kisaran (4) -> Tanjung Balai (6)
let ptrOutbound = db.prepare(`SELECT id FROM routes WHERE fleet_id = 2 AND direction = 'OUTBOUND'`).get();
if (!ptrOutbound) {
  const res = db.prepare(`
    INSERT INTO routes (fleet_id, route_name, direction)
    VALUES (2, 'Lintas Timur Medan - Tanjung Balai (KA Putri Deli)', 'OUTBOUND')
  `).run();
  const routeId = Number(res.lastInsertRowid);
  ptrOutbound = { id: routeId };

  db.prepare(`
    INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
    VALUES
    (?, 1, 1, 0, 0),
    (?, 2, 2, 35, 38),
    (?, 3, 3, 75, 80),
    (?, 4, 4, 150, 155),
    (?, 6, 5, 210, 210)
  `).run(routeId, routeId, routeId, routeId, routeId);
  console.log('Created Route KA Putri Deli OUTBOUND:', routeId);
}

let ptrInbound = db.prepare(`SELECT id FROM routes WHERE fleet_id = 2 AND direction = 'INBOUND'`).get();
if (!ptrInbound) {
  const res = db.prepare(`
    INSERT INTO routes (fleet_id, route_name, direction)
    VALUES (2, 'Lintas Timur Tanjung Balai - Medan (KA Putri Deli)', 'INBOUND')
  `).run();
  const routeId = Number(res.lastInsertRowid);
  ptrInbound = { id: routeId };

  db.prepare(`
    INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
    VALUES
    (?, 6, 1, 0, 0),
    (?, 4, 2, 55, 60),
    (?, 3, 3, 130, 135),
    (?, 2, 4, 172, 175),
    (?, 1, 5, 210, 210)
  `).run(routeId, routeId, routeId, routeId, routeId);
  console.log('Created Route KA Putri Deli INBOUND:', routeId);
}

// 3. Check or create Route for Bus Pariwisata ULP (Fleet 3: BUS-JB5-01)
// Route Outbound: SMK Negeri 1 Percut Sei Tuan (9) -> Terminal Amplas (7) -> Tebing Tinggi (3)
let busOutbound = db.prepare(`SELECT id FROM routes WHERE fleet_id = 3 AND direction = 'OUTBOUND'`).get();
if (!busOutbound) {
  const res = db.prepare(`
    INSERT INTO routes (fleet_id, route_name, direction)
    VALUES (3, 'Lintas Wisata Medan - Danau Toba (Jetbus 5 ULP-01)', 'OUTBOUND')
  `).run();
  const routeId = Number(res.lastInsertRowid);
  busOutbound = { id: routeId };

  db.prepare(`
    INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
    VALUES
    (?, 9, 1, 0, 0),
    (?, 7, 2, 40, 45),
    (?, 3, 3, 120, 125)
  `).run(routeId, routeId, routeId);
  console.log('Created Route Bus Pariwisata OUTBOUND:', routeId);
}

// 4. Create schedules for KA Putri Deli & Bus Pariwisata for 2026-10-17 through 2026-10-25
const dates = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'];

for (const d of dates) {
  // Check KA Putri Deli Outbound
  const existPtrOut = db.prepare(`SELECT id FROM schedules WHERE route_id = ? AND departure_date = ?`).get(ptrOutbound.id, d);
  if (!existPtrOut) {
    const res = db.prepare(`
      INSERT INTO schedules (route_id, departure_date, base_departure_time, status, gate_info)
      VALUES (?, ?, '06:45', 'OPEN', 'Jalur 1 (Gate A)')
    `).run(ptrOutbound.id, d);
    const sid = Number(res.lastInsertRowid);

    // Fares for Putri Deli (Ekonomi Premium Rp 35.000)
    db.prepare(`
      INSERT INTO schedule_fares (schedule_id, origin_station_id, destination_station_id, wagon_class, subclass, price, quota)
      VALUES 
      (?, 1, 6, 'ECONOMY', 'C', 35000, 80),
      (?, 1, 4, 'ECONOMY', 'C', 28000, 80),
      (?, 1, 3, 'ECONOMY', 'C', 22000, 80)
    `).run(sid, sid, sid);
  }

  // Check KA Putri Deli Inbound
  const existPtrIn = db.prepare(`SELECT id FROM schedules WHERE route_id = ? AND departure_date = ?`).get(ptrInbound.id, d);
  if (!existPtrIn) {
    const res = db.prepare(`
      INSERT INTO schedules (route_id, departure_date, base_departure_time, status, gate_info)
      VALUES (?, ?, '12:50', 'OPEN', 'Jalur 2 (Gate B)')
    `).run(ptrInbound.id, d);
    const sid = Number(res.lastInsertRowid);

    db.prepare(`
      INSERT INTO schedule_fares (schedule_id, origin_station_id, destination_station_id, wagon_class, subclass, price, quota)
      VALUES 
      (?, 6, 1, 'ECONOMY', 'C', 35000, 80),
      (?, 4, 1, 'ECONOMY', 'C', 28000, 80)
    `).run(sid, sid);
  }

  // Check Bus Pariwisata
  const existBus = db.prepare(`SELECT id FROM schedules WHERE route_id = ? AND departure_date = ?`).get(busOutbound.id, d);
  if (!existBus) {
    const res = db.prepare(`
      INSERT INTO schedules (route_id, departure_date, base_departure_time, status, gate_info)
      VALUES (?, ?, '08:15', 'OPEN', 'Dermaga / Bay 03')
    `).run(busOutbound.id, d);
    const sid = Number(res.lastInsertRowid);

    db.prepare(`
      INSERT INTO schedule_fares (schedule_id, origin_station_id, destination_station_id, wagon_class, subclass, price, quota)
      VALUES 
      (?, 9, 3, 'EXECUTIVE', 'A', 65000, 40),
      (?, 7, 3, 'EXECUTIVE', 'A', 55000, 40)
    `).run(sid, sid);
  }
}

console.log('Seeded schedules for KA Putri Deli and Bus Pariwisata!');
