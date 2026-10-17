import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'travel.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Execute complete schema DDL for 15 tables
db.exec(`
-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'REVENUE_CONTROLLER', 'TICKETING_OFFICER', 'TOUR_PLANNER', 'BOARDING_OFFICER', 'CUSTOMER')),
  phone TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. STATIONS
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('TRAIN_STATION', 'BUS_TERMINAL', 'MEETING_POINT')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_code ON stations(code);
CREATE INDEX IF NOT EXISTS idx_stations_type ON stations(type);
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);

-- 3. FLEETS
CREATE TABLE IF NOT EXISTS fleets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('TRAIN', 'BUS')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fleets_code ON fleets(code);
CREATE INDEX IF NOT EXISTS idx_fleets_type ON fleets(type);

-- 4. WAGONS
CREATE TABLE IF NOT EXISTS wagons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  wagon_code TEXT NOT NULL,
  class TEXT NOT NULL CHECK(class IN ('EXECUTIVE', 'BUSINESS', 'ECONOMY')),
  rows INTEGER NOT NULL CHECK(rows > 0),
  cols_layout TEXT NOT NULL,
  direction_indicator TEXT NOT NULL DEFAULT 'FORWARD' CHECK(direction_indicator IN ('FORWARD', 'BACKWARD', 'FACING')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fleet_id, wagon_code)
);
CREATE INDEX IF NOT EXISTS idx_wagons_fleet_id ON wagons(fleet_id);

-- 5. ROUTES
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE RESTRICT,
  route_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('OUTBOUND', 'INBOUND')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_routes_fleet_id ON routes(fleet_id);

-- 6. ROUTE STOPS
CREATE TABLE IF NOT EXISTS route_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  stop_order INTEGER NOT NULL CHECK(stop_order >= 0),
  arrival_offset_minutes INTEGER NOT NULL DEFAULT 0,
  departure_offset_minutes INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(route_id, stop_order)
);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_station_id ON route_stops(station_id);

-- 7. SCHEDULES
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  departure_date TEXT NOT NULL,
  base_departure_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'DEPARTED', 'DELAYED')),
  gate_info TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedules_route_date ON schedules(route_id, departure_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- 8. SCHEDULE FARES
CREATE TABLE IF NOT EXISTS schedule_fares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  origin_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  destination_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  wagon_class TEXT NOT NULL CHECK(wagon_class IN ('EXECUTIVE', 'BUSINESS', 'ECONOMY')),
  subclass TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  quota INTEGER NOT NULL DEFAULT 0 CHECK(quota >= 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(schedule_id, origin_station_id, destination_station_id, wagon_class, subclass)
);
CREATE INDEX IF NOT EXISTS idx_schedule_fares_lookup ON schedule_fares(schedule_id, origin_station_id, destination_station_id);

-- 9. BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trip_type TEXT NOT NULL CHECK(trip_type IN ('ONE_WAY', 'ROUND_TRIP')),
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'PAID', 'EXPIRED', 'REFUNDED')),
  locked_until DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_invoice ON bookings(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- 10. BOOKING SEGMENTS
CREATE TABLE IF NOT EXISTS booking_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pnr_code TEXT NOT NULL UNIQUE,
  segment_type TEXT NOT NULL CHECK(segment_type IN ('DEPARTURE', 'RETURN')),
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  origin_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  destination_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_segments_pnr ON booking_segments(pnr_code);
CREATE INDEX IF NOT EXISTS idx_booking_segments_booking_id ON booking_segments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_segments_schedule_id ON booking_segments(schedule_id);

-- 11. BOOKING PASSENGERS
CREATE TABLE IF NOT EXISTS booking_passengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_segment_id INTEGER NOT NULL REFERENCES booking_segments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  pax_type TEXT NOT NULL CHECK(pax_type IN ('ADULT', 'INFANT')),
  wagon_id INTEGER REFERENCES wagons(id) ON DELETE RESTRICT,
  seat_number TEXT,
  boarding_status TEXT NOT NULL DEFAULT 'BOOKED' CHECK(boarding_status IN ('BOOKED', 'CHECKED_IN', 'BOARDED')),
  qr_signature TEXT,
  checked_in_at DATETIME,
  boarded_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_segment ON booking_passengers(booking_segment_id);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_seat ON booking_passengers(wagon_id, seat_number);

-- 12. TOUR PACKAGES
CREATE TABLE IF NOT EXISTS tour_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  min_pax INTEGER NOT NULL DEFAULT 10,
  price_per_pax INTEGER NOT NULL DEFAULT 0,
  costing_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_packages_slug ON tour_packages(slug);
CREATE INDEX IF NOT EXISTS idx_tour_packages_status ON tour_packages(status);

-- 13. TOUR ITINERARIES
CREATE TABLE IF NOT EXISTS tour_itineraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_package_id INTEGER NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  activity_title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tour_itineraries_package ON tour_itineraries(tour_package_id, day_number);

-- 14. TOUR MANIFESTS
CREATE TABLE IF NOT EXISTS tour_manifests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_package_id INTEGER NOT NULL REFERENCES tour_packages(id) ON DELETE RESTRICT,
  bus_name TEXT NOT NULL,
  seat_number TEXT NOT NULL,
  room_number TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checkpoint_1_status INTEGER NOT NULL DEFAULT 0,
  checkpoint_2_status INTEGER NOT NULL DEFAULT 0,
  checkpoint_3_status INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tour_manifests_package ON tour_manifests(tour_package_id);
CREATE INDEX IF NOT EXISTS idx_tour_manifests_user ON tour_manifests(user_id);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  ip_address TEXT,
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`);

console.log('--- Memulai Seeding Database Enterprise OTA & CRS SMK ---');

async function seed() {
  // 1. SEED USERS (6 ROLES)
  console.log('1. Menanam 6 Akun Pengguna Nyata...');
  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash('Password123!', salt);

  const users = [
    {
      name: 'Bpk. Drs. H. Suryadi, M.Kom',
      email: 'admin@smk-nusantara.sch.id',
      identity_number: '197805122005011003',
      role: 'SUPER_ADMIN',
      phone: '081260112233',
    },
    {
      name: 'Rina Anggraini',
      email: 'revenue@smk-nusantara.sch.id',
      identity_number: '0067891234',
      role: 'REVENUE_CONTROLLER',
      phone: '081370223344',
    },
    {
      name: 'Dimas Prasetyo',
      email: 'loket@smk-nusantara.sch.id',
      identity_number: '0067891235',
      role: 'TICKETING_OFFICER',
      phone: '081370334455',
    },
    {
      name: 'Anisa Rahmawati',
      email: 'tour@smk-nusantara.sch.id',
      identity_number: '0067891236',
      role: 'TOUR_PLANNER',
      phone: '081370445566',
    },
    {
      name: 'Fajar Siregar',
      email: 'boarding@smk-nusantara.sch.id',
      identity_number: '0067891237',
      role: 'BOARDING_OFFICER',
      phone: '081370556677',
    },
    {
      name: 'Budi Santoso',
      email: 'budi.santoso@gmail.com',
      identity_number: '1271021508890001',
      role: 'CUSTOMER',
      phone: '085270667788',
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, identity_number, role, phone)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      name=excluded.name,
      password_hash=excluded.password_hash,
      identity_number=excluded.identity_number,
      role=excluded.role,
      phone=excluded.phone
  `);

  for (const u of users) {
    insertUser.run(u.name, u.email, commonPassword, u.identity_number, u.role, u.phone);
  }
  console.log('   ✓ 6 Akun Role Berhasil Dibuat (Password default: Password123!)');

  // 2. SEED STATIONS (SUMATERA UTARA & SCHOOL MEETING POINTS)
  console.log('2. Menanam Master Data Stasiun Sumatera Utara & Titik Kumpul...');
  const stations = [
    { code: 'MDN', name: 'Stasiun Besar Medan', city: 'Kota Medan', type: 'TRAIN_STATION' },
    { code: 'LBP', name: 'Stasiun Lubuk Pakam', city: 'Kabupaten Deli Serdang', type: 'TRAIN_STATION' },
    { code: 'TBI', name: 'Stasiun Tebing Tinggi', city: 'Kota Tebing Tinggi', type: 'TRAIN_STATION' },
    { code: 'KIS', name: 'Stasiun Kisaran', city: 'Kabupaten Asahan', type: 'TRAIN_STATION' },
    { code: 'RAP', name: 'Stasiun Rantau Prapat', city: 'Kabupaten Labuhanbatu', type: 'TRAIN_STATION' },
    { code: 'TNB', name: 'Stasiun Tanjung Balai', city: 'Kota Tanjung Balai', type: 'TRAIN_STATION' },
    { code: 'AMB', name: 'Terminal Terpadu Tipe A Amplas', city: 'Kota Medan', type: 'BUS_TERMINAL' },
    { code: 'PIN', name: 'Terminal Tipe A Pinang Baris', city: 'Kota Medan', type: 'BUS_TERMINAL' },
    { code: 'SMK1', name: 'Gedung Utama SMK Negeri 1 Percut Sei Tuan', city: 'Kabupaten Deli Serdang', type: 'MEETING_POINT' },
    { code: 'SMK2', name: 'Kampus Praktik ULP SMK Pariwisata', city: 'Kota Medan', type: 'MEETING_POINT' },
  ];

  const insertStation = db.prepare(`
    INSERT INTO stations (code, name, city, type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name,
      city=excluded.city,
      type=excluded.type
  `);

  for (const s of stations) {
    insertStation.run(s.code, s.name, s.city, s.type);
  }
  console.log('   ✓ 10 Stasiun & Titik Kumpul Berhasil Dibuat');

  // 3. SEED FLEETS & WAGONS
  console.log('3. Menanam Armada Kereta & Bus Pariwisata Beserta Susunan Gerbong...');
  const fleets = [
    { code: 'SRB-UTM', name: 'KA Sribilah Utama (U50 - U51)', type: 'TRAIN', status: 'ACTIVE' },
    { code: 'PTR-DEL', name: 'KA Putri Deli (U72 - U75)', type: 'TRAIN', status: 'ACTIVE' },
    { code: 'BUS-JB5-01', name: 'Mercedes-Benz Jetbus 5 Pariwisata ULP-01', type: 'BUS', status: 'ACTIVE' },
    { code: 'BUS-SCN-02', name: 'Scania K410IB Kunjungan Industri ULP-02', type: 'BUS', status: 'ACTIVE' },
  ];

  const insertFleet = db.prepare(`
    INSERT INTO fleets (code, name, type, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name,
      type=excluded.type,
      status=excluded.status
  `);

  for (const f of fleets) {
    insertFleet.run(f.code, f.name, f.type, f.status);
  }

  // Get fleet IDs
  const getFleet = db.prepare('SELECT id, code FROM fleets');
  const fleetRows = getFleet.all();
  const fleetMap = {};
  for (const row of fleetRows) {
    fleetMap[row.code] = row.id;
  }

  // Clear and insert wagons
  const insertWagon = db.prepare(`
    INSERT INTO wagons (fleet_id, wagon_code, class, rows, cols_layout, direction_indicator)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(fleet_id, wagon_code) DO UPDATE SET
      class=excluded.class,
      rows=excluded.rows,
      cols_layout=excluded.cols_layout,
      direction_indicator=excluded.direction_indicator
  `);

  // Wagons for SRB-UTM (Train 1)
  const srbId = fleetMap['SRB-UTM'];
  insertWagon.run(srbId, 'EKS-1', 'EXECUTIVE', 10, '2-2', 'FORWARD'); // 40 seats
  insertWagon.run(srbId, 'EKS-2', 'EXECUTIVE', 10, '2-2', 'FORWARD'); // 40 seats
  insertWagon.run(srbId, 'EKO-1', 'ECONOMY', 16, '2-2', 'FACING');   // 64 seats
  insertWagon.run(srbId, 'EKO-2', 'ECONOMY', 16, '3-2', 'FACING');   // 80 seats

  // Wagons for PTR-DEL (Train 2)
  const ptrId = fleetMap['PTR-DEL'];
  insertWagon.run(ptrId, 'EKS-1', 'EXECUTIVE', 10, '2-2', 'FORWARD'); // 40 seats
  insertWagon.run(ptrId, 'EKO-1', 'ECONOMY', 16, '3-2', 'FORWARD');   // 80 seats
  insertWagon.run(ptrId, 'EKO-2', 'ECONOMY', 16, '3-2', 'BACKWARD');  // 80 seats

  // Wagons for BUS-JB5-01 (Bus 1)
  const bus1Id = fleetMap['BUS-JB5-01'];
  insertWagon.run(bus1Id, 'BUS-A', 'EXECUTIVE', 8, '2-2', 'FORWARD');  // 32 seats

  // Wagons for BUS-SCN-02 (Bus 2)
  const bus2Id = fleetMap['BUS-SCN-02'];
  insertWagon.run(bus2Id, 'BUS-B', 'EXECUTIVE', 6, '2-1', 'FORWARD');  // 18 seats VIP

  console.log('   ✓ 4 Armada & 9 Gerbong/Kabin Lengkap Berhasil Dikonfigurasi');

  // 4. SEED ROUTES & ROUTE STOPS
  console.log('4. Menanam Master Rute Berarah & Pemberhentian...');
  const stationRows = db.prepare('SELECT id, code FROM stations').all();
  const stMap = {};
  for (const s of stationRows) {
    stMap[s.code] = s.id;
  }

  const insertRoute = db.prepare(`
    INSERT INTO routes (fleet_id, route_name, direction)
    VALUES (?, ?, ?)
  `);

  // Clear existing routes & schedules for clean re-seed
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM booking_passengers');
  db.exec('DELETE FROM bookings');
  db.exec('DELETE FROM route_stops');
  db.exec('DELETE FROM schedule_fares');
  db.exec('DELETE FROM schedules');
  db.exec('DELETE FROM routes');
  db.exec('PRAGMA foreign_keys = ON;');

  // Outbound 1: Medan -> Lubuk Pakam -> Tebing Tinggi -> Kisaran -> Rantau Prapat (KA Sribilah)
  const r1 = insertRoute.run(srbId, 'Lintas Utama Medan - Rantau Prapat', 'OUTBOUND');
  const route1Id = Number(r1.lastInsertRowid);

  const insertStop = db.prepare(`
    INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertStop.run(route1Id, stMap['MDN'], 0, 0, 0);       // Departure 00:00
  insertStop.run(route1Id, stMap['LBP'], 1, 35, 40);     // 35m arr, 40m dep
  insertStop.run(route1Id, stMap['TBI'], 2, 95, 105);    // 1h35m arr, 1h45m dep
  insertStop.run(route1Id, stMap['KIS'], 3, 175, 185);   // 2h55m arr, 3h05m dep
  insertStop.run(route1Id, stMap['RAP'], 4, 320, 320);   // 5h20m arr (Terminal)

  // Inbound 1: Rantau Prapat -> Medan (KA Sribilah)
  const r2 = insertRoute.run(srbId, 'Lintas Utama Rantau Prapat - Medan', 'INBOUND');
  const route2Id = Number(r2.lastInsertRowid);
  insertStop.run(route2Id, stMap['RAP'], 0, 0, 0);
  insertStop.run(route2Id, stMap['KIS'], 1, 135, 145);
  insertStop.run(route2Id, stMap['TBI'], 2, 215, 225);
  insertStop.run(route2Id, stMap['LBP'], 3, 280, 285);
  insertStop.run(route2Id, stMap['MDN'], 4, 320, 320);

  // Outbound 2: Medan -> Kisaran -> Tanjung Balai (KA Putri Deli)
  const r3 = insertRoute.run(ptrId, 'Lintas Pesisir Medan - Tanjung Balai', 'OUTBOUND');
  const route3Id = Number(r3.lastInsertRowid);
  insertStop.run(route3Id, stMap['MDN'], 0, 0, 0);
  insertStop.run(route3Id, stMap['LBP'], 1, 35, 40);
  insertStop.run(route3Id, stMap['TBI'], 2, 95, 105);
  insertStop.run(route3Id, stMap['KIS'], 3, 175, 185);
  insertStop.run(route3Id, stMap['TNB'], 4, 250, 250);

  // Inbound 2: Tanjung Balai -> Kisaran -> Medan (KA Putri Deli)
  const r4 = insertRoute.run(ptrId, 'Lintas Pesisir Tanjung Balai - Medan', 'INBOUND');
  const route4Id = Number(r4.lastInsertRowid);
  insertStop.run(route4Id, stMap['TNB'], 0, 0, 0);
  insertStop.run(route4Id, stMap['KIS'], 1, 65, 75);
  insertStop.run(route4Id, stMap['TBI'], 2, 145, 155);
  insertStop.run(route4Id, stMap['LBP'], 3, 210, 215);
  insertStop.run(route4Id, stMap['MDN'], 4, 250, 250);

  // 5. SEED SCHEDULES & COMBINATORIAL SEGMENT FARES (7 DAYS AHEAD)
  console.log('5. Menanam Jadwal Operasional & Matriks Tarif Kombinatorial untuk 7 Hari ke Depan (Pagi, Sore, & Malam)...');
  const insertSchedule = db.prepare(`
    INSERT INTO schedules (route_id, departure_date, base_departure_time, status, gate_info)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertFare = db.prepare(`
    INSERT INTO schedule_fares (schedule_id, origin_station_id, destination_station_id, wagon_class, subclass, price, quota)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Helper to generate combinatorial fares for a schedule
  const generateFaresForSchedule = (schedId, routeStops, execBase, econBase) => {
    const totalMinutes = routeStops[routeStops.length - 1].arrival_offset_minutes;
    for (let i = 0; i < routeStops.length - 1; i++) {
      for (let j = i + 1; j < routeStops.length; j++) {
        const orig = routeStops[i];
        const dest = routeStops[j];
        const segMinutes = Math.max(1, dest.arrival_offset_minutes - orig.departure_offset_minutes);
        const prop = Math.max(0.25, Math.min(1.0, segMinutes / totalMinutes));

        // Prices rounded to 5000
        const execAPrice = Math.round((execBase * prop) / 5000) * 5000;
        const execHPrice = Math.round((execBase * prop * 0.85) / 5000) * 5000;
        const econCPrice = Math.round((econBase * prop) / 5000) * 5000;
        const econPPrice = Math.round((econBase * prop * 0.85) / 5000) * 5000;

        insertFare.run(schedId, orig.station_id, dest.station_id, 'EXECUTIVE', 'A', execAPrice, 40);
        insertFare.run(schedId, orig.station_id, dest.station_id, 'EXECUTIVE', 'H', execHPrice, 40);
        insertFare.run(schedId, orig.station_id, dest.station_id, 'ECONOMY', 'C', econCPrice, 64);
        insertFare.run(schedId, orig.station_id, dest.station_id, 'ECONOMY', 'P', econPPrice, 80);
      }
    }
  };

  const r1Stops = db.prepare('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC').all(route1Id);
  const r2Stops = db.prepare('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC').all(route2Id);
  const r3Stops = db.prepare('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC').all(route3Id);
  const r4Stops = db.prepare('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC').all(route4Id);

  let totalSchedulesCreated = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const d = new Date(Date.now() + dayOffset * 86400000);
    const dateStr = d.toISOString().split('T')[0];

    // Outbound Sribilah (MDN -> RAP): Pagi, Sore, Malam
    const s1 = insertSchedule.run(route1Id, dateStr, '07:30', 'OPEN', 'Jalur 2 - Pintu Selatan');
    generateFaresForSchedule(Number(s1.lastInsertRowid), r1Stops, 220000, 120000);
    totalSchedulesCreated++;

    const s1Sore = insertSchedule.run(route1Id, dateStr, '15:30', 'OPEN', 'Jalur 2 - Pintu Selatan');
    generateFaresForSchedule(Number(s1Sore.lastInsertRowid), r1Stops, 230000, 125000);
    totalSchedulesCreated++;

    const s1Malam = insertSchedule.run(route1Id, dateStr, '21:00', 'OPEN', 'Jalur 1 - Pintu Timur');
    generateFaresForSchedule(Number(s1Malam.lastInsertRowid), r1Stops, 240000, 130000);
    totalSchedulesCreated++;

    // Inbound Sribilah (RAP -> MDN): Pagi, Siang, Malam
    const s2Pagi = insertSchedule.run(route2Id, dateStr, '07:45', 'OPEN', 'Jalur 1 - Loket Praktik');
    generateFaresForSchedule(Number(s2Pagi.lastInsertRowid), r2Stops, 220000, 120000);
    totalSchedulesCreated++;

    const s2 = insertSchedule.run(route2Id, dateStr, '14:30', 'OPEN', 'Jalur 1 - Loket Praktik');
    generateFaresForSchedule(Number(s2.lastInsertRowid), r2Stops, 220000, 120000);
    totalSchedulesCreated++;

    const s2Malam = insertSchedule.run(route2Id, dateStr, '22:15', 'OPEN', 'Jalur 2 - Peron Utama');
    generateFaresForSchedule(Number(s2Malam.lastInsertRowid), r2Stops, 240000, 130000);
    totalSchedulesCreated++;

    // Outbound Putri Deli (MDN -> TNB): Pagi & Malam
    const s3Pagi = insertSchedule.run(route3Id, dateStr, '08:30', 'OPEN', 'Jalur 3 - Pintu Utara');
    generateFaresForSchedule(Number(s3Pagi.lastInsertRowid), r3Stops, 160000, 85000);
    totalSchedulesCreated++;

    const s3Malam = insertSchedule.run(route3Id, dateStr, '19:45', 'OPEN', 'Jalur 3 - Pintu Utara');
    generateFaresForSchedule(Number(s3Malam.lastInsertRowid), r3Stops, 170000, 90000);
    totalSchedulesCreated++;

    // Inbound Putri Deli (TNB -> MDN): Pagi & Malam
    const s4Pagi = insertSchedule.run(route4Id, dateStr, '08:00', 'OPEN', 'Jalur 1 - Peron Stasiun');
    generateFaresForSchedule(Number(s4Pagi.lastInsertRowid), r4Stops, 160000, 85000);
    totalSchedulesCreated++;

    const s4Malam = insertSchedule.run(route4Id, dateStr, '19:30', 'OPEN', 'Jalur 1 - Peron Stasiun');
    generateFaresForSchedule(Number(s4Malam.lastInsertRowid), r4Stops, 170000, 90000);
    totalSchedulesCreated++;
  }

  console.log(`   ✓ ${totalSchedulesCreated} Jadwal Operasional Lengkap (Pagi, Sore, & Malam untuk Sribilah & Putri Deli) Berhasil Ditanam!`);


  // 6. SEED TOUR PACKAGE (ULP PRACTICE)
  console.log('6. Menanam Paket Wisata & Kalkulator HPP Tour Costing...');
  const costingData = {
    destination: 'Danau Toba & Pulau Samosir',
    paxCount: 30,
    components: [
      { category: 'Transport', item: 'Sewa Bus Jetbus 5 ULP-01 (3 Hari)', cost: 7500000 },
      { category: 'Transport', item: 'BBM & Tol Tebing Tinggi - Sinaksak', cost: 1650000 },
      { category: 'Transport', item: 'Ferry Penyeberangan Ajibata - Tomok PP', cost: 850000 },
      { category: 'Hotel', item: 'Hotel Bintang 3 Parapat (15 Kamar x 2 Malam)', cost: 12000000 },
      { category: 'Meals', item: 'Makan 8x Prasmanan Tradisional Batak Halal', cost: 7200000 },
      { category: 'Tickets', item: 'Tiket Desa Wisata Tomok & Tuk-Tuk', cost: 900000 },
      { category: 'Guide', item: 'Fee Tour Leader & Pemandu Lokal SMK', cost: 1500000 },
      { category: 'Misc', item: 'Spanduk Kunjungan Industri, P3K, Air Mineral', cost: 800000 },
    ],
    totalHPP: 32400000,
    hppPerPax: 1080000,
    marginPercentage: 15,
    sellingPricePerPax: 1250000,
  };

  const insertTour = db.prepare(`
    INSERT INTO tour_packages (slug, title, destination, duration_days, min_pax, price_per_pax, costing_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title,
      price_per_pax=excluded.price_per_pax,
      costing_json=excluded.costing_json
  `);

  const tourRes = insertTour.run(
    'ki-danau-toba-samosir-3d2n',
    'Kunjungan Industri & Eksplorasi Danau Toba - Pulau Samosir (3H2M)',
    'Parapat & Samosir, Sumatera Utara',
    3,
    25,
    1250000,
    JSON.stringify(costingData),
    'ACTIVE'
  );

  const tourRow = db.prepare("SELECT id FROM tour_packages WHERE slug = 'ki-danau-toba-samosir-3d2n'").get();
  const tourId = Number(tourRow.id);

  // Clear & insert itineraries
  db.exec('DELETE FROM tour_itineraries');
  const insertItinerary = db.prepare(`
    INSERT INTO tour_itineraries (tour_package_id, day_number, start_time, activity_title, description, location)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertItinerary.run(tourId, 1, '06:30', 'Kumpul di Titik Kumpul SMK & Briefing Tour Leader', 'Absensi peserta, pengecekan bagasi, doa bersama, dan pembagian snack pagi.', 'SMK Titik Kumpul Percut');
  insertItinerary.run(tourId, 1, '07:15', 'Keberangkatan Menuju Parapat via Tol Tebing Tinggi', 'Perjalanan darat nyaman menggunakan armada Bus Pariwisata ULP-01.', 'Tol Trans-Sumatera');
  insertItinerary.run(tourId, 1, '12:30', 'Makan Siang & Check-in Hotel View Danau Toba', 'Istirahat dan orientasi lingkungan hotel bersama tour leader.', 'Parapat Hotel Lake View');
  insertItinerary.run(tourId, 2, '08:30', 'Penyeberangan Ferry Menuju Pulau Samosir (Tomok & Tuk-Tuk)', 'Kunjungan industri kriya ulos tradisional dan makam Raja Sidabutar.', 'Desa Wisata Tomok Samosir');
  insertItinerary.run(tourId, 3, '10:00', 'Check-out & Wisata Belanja Oleh-Oleh Khas Patung Sigale-gale', 'Praktik pemanduan wisata lokal oleh siswa ULP.', 'Sentra Oleh-oleh Parapat');
  insertItinerary.run(tourId, 3, '17:30', 'Tiba Kembali di Kampus SMK dengan Selamat', 'Evaluasi perjalanan bersama Guru Pembimbing dan Tour Leader.', 'Gedung Utama SMK');

  console.log('   ✓ Paket Wisata & Rincian Itinerary 3 Hari Berhasil Dibuat');

  // 7. SEED INITIAL AUDIT LOG
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, target_id, ip_address, details)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAudit.run(1, 'DATABASE_SEED_INIT', 'SYSTEM', '127.0.0.1', 'Initial database migration and realistic North Sumatra data seeded successfully');

  console.log('--- SEEDING DATABASE SELESAI DENGAN SUKSES! ---');
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
