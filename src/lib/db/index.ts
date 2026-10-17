import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { SCHEMA_SQL } from './schema';

let dbInstance: DatabaseSync | null = null;

function autoSeedIfEmpty(db: DatabaseSync) {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    if (userCount && userCount.c > 0) {
      return; // already seeded
    }

    // Precomputed bcrypt hash for 'Password123!' (cost 10)
    const commonPassword = '$2b$10$oGZpD1ZW0rnIoQjTS1Kl4u5btV6IWdqNv9LkPeIHWQ8FiPR/J6f2u';

    const users = [
      { name: 'Bpk. Drs. H. Suryadi, M.Kom', email: 'admin@smk-nusantara.sch.id', id_num: '197805122005011003', role: 'SUPER_ADMIN', phone: '081260112233' },
      { name: 'Rina Anggraini', email: 'revenue@smk-nusantara.sch.id', id_num: '0067891234', role: 'REVENUE_CONTROLLER', phone: '081370223344' },
      { name: 'Dimas Prasetyo', email: 'loket@smk-nusantara.sch.id', id_num: '0067891235', role: 'TICKETING_OFFICER', phone: '081370334455' },
      { name: 'Anisa Rahmawati', email: 'tour@smk-nusantara.sch.id', id_num: '0067891236', role: 'TOUR_PLANNER', phone: '081370445566' },
      { name: 'Fajar Siregar', email: 'boarding@smk-nusantara.sch.id', id_num: '0067891237', role: 'BOARDING_OFFICER', phone: '081370556677' },
      { name: 'Budi Santoso', email: 'budi.santoso@gmail.com', id_num: '1271021508890001', role: 'CUSTOMER', phone: '085270667788' },
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, identity_number, role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const u of users) {
      insertUser.run(u.name, u.email, commonPassword, u.id_num, u.role, u.phone);
    }

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

    const insertStation = db.prepare('INSERT OR IGNORE INTO stations (code, name, city, type) VALUES (?, ?, ?, ?)');
    for (const s of stations) {
      insertStation.run(s.code, s.name, s.city, s.type);
    }

    const fleets = [
      { code: 'SRB-UTM', name: 'KA Sribilah Utama (U50 - U51)', type: 'TRAIN', status: 'ACTIVE' },
      { code: 'PTR-DEL', name: 'KA Putri Deli (U72 - U75)', type: 'TRAIN', status: 'ACTIVE' },
      { code: 'BUS-JB5-01', name: 'Mercedes-Benz Jetbus 5 Pariwisata ULP-01', type: 'BUS', status: 'ACTIVE' },
      { code: 'BUS-SCN-02', name: 'Scania K410IB Kunjungan Industri ULP-02', type: 'BUS', status: 'ACTIVE' },
    ];

    const insertFleet = db.prepare('INSERT OR IGNORE INTO fleets (code, name, type, status) VALUES (?, ?, ?, ?)');
    for (const f of fleets) {
      insertFleet.run(f.code, f.name, f.type, f.status);
    }

    const srbRow = db.prepare("SELECT id FROM fleets WHERE code = 'SRB-UTM'").get() as { id: number };
    const ptrRow = db.prepare("SELECT id FROM fleets WHERE code = 'PTR-DEL'").get() as { id: number };
    const bus1Row = db.prepare("SELECT id FROM fleets WHERE code = 'BUS-JB5-01'").get() as { id: number };
    const bus2Row = db.prepare("SELECT id FROM fleets WHERE code = 'BUS-SCN-02'").get() as { id: number };

    const insertWagon = db.prepare('INSERT OR IGNORE INTO wagons (fleet_id, wagon_code, class, rows, cols_layout, direction_indicator) VALUES (?, ?, ?, ?, ?, ?)');
    if (srbRow) {
      insertWagon.run(srbRow.id, 'EKS-1', 'EXECUTIVE', 10, '2-2', 'FORWARD');
      insertWagon.run(srbRow.id, 'EKS-2', 'EXECUTIVE', 10, '2-2', 'FORWARD');
      insertWagon.run(srbRow.id, 'EKO-1', 'ECONOMY', 16, '2-2', 'FACING');
      insertWagon.run(srbRow.id, 'EKO-2', 'ECONOMY', 16, '3-2', 'FACING');
    }
    if (ptrRow) {
      insertWagon.run(ptrRow.id, 'EKS-1', 'EXECUTIVE', 10, '2-2', 'FORWARD');
      insertWagon.run(ptrRow.id, 'EKO-1', 'ECONOMY', 16, '3-2', 'FORWARD');
      insertWagon.run(ptrRow.id, 'EKO-2', 'ECONOMY', 16, '3-2', 'BACKWARD');
    }
    if (bus1Row) insertWagon.run(bus1Row.id, 'BUS-A', 'EXECUTIVE', 8, '2-2', 'FORWARD');
    if (bus2Row) insertWagon.run(bus2Row.id, 'BUS-B', 'EXECUTIVE', 6, '2-1', 'FORWARD');

    // Route & Schedules
    if (srbRow) {
      const mdn = db.prepare("SELECT id FROM stations WHERE code = 'MDN'").get() as { id: number };
      const lbp = db.prepare("SELECT id FROM stations WHERE code = 'LBP'").get() as { id: number };
      const tbi = db.prepare("SELECT id FROM stations WHERE code = 'TBI'").get() as { id: number };
      const kis = db.prepare("SELECT id FROM stations WHERE code = 'KIS'").get() as { id: number };
      const rap = db.prepare("SELECT id FROM stations WHERE code = 'RAP'").get() as { id: number };

      if (mdn && lbp && tbi && kis && rap) {
        // Outbound
        const r1 = db.prepare('INSERT INTO routes (fleet_id, route_name, direction) VALUES (?, ?, ?)').run(srbRow.id, 'Lintas Utama Medan - Rantau Prapat', 'OUTBOUND');
        const r1Id = Number(r1.lastInsertRowid);
        const insertStop = db.prepare('INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes) VALUES (?, ?, ?, ?, ?)');
        insertStop.run(r1Id, mdn.id, 0, 0, 0);
        insertStop.run(r1Id, lbp.id, 1, 35, 40);
        insertStop.run(r1Id, tbi.id, 2, 95, 105);
        insertStop.run(r1Id, kis.id, 3, 175, 185);
        insertStop.run(r1Id, rap.id, 4, 320, 320);

        // Inbound
        const r2 = db.prepare('INSERT INTO routes (fleet_id, route_name, direction) VALUES (?, ?, ?)').run(srbRow.id, 'Lintas Utama Rantau Prapat - Medan', 'INBOUND');
        const r2Id = Number(r2.lastInsertRowid);
        insertStop.run(r2Id, rap.id, 0, 0, 0);
        insertStop.run(r2Id, kis.id, 1, 135, 145);
        insertStop.run(r2Id, tbi.id, 2, 215, 225);
        insertStop.run(r2Id, lbp.id, 3, 280, 285);
        insertStop.run(r2Id, mdn.id, 4, 320, 320);

        const insertSchedule = db.prepare('INSERT INTO schedules (route_id, departure_date, base_departure_time, status, gate_info) VALUES (?, ?, ?, ?, ?)');
        const insertFare = db.prepare('INSERT OR IGNORE INTO schedule_fares (schedule_id, origin_station_id, destination_station_id, wagon_class, subclass, price, quota) VALUES (?, ?, ?, ?, ?, ?, ?)');

        const r1Stops = [
          { station_id: mdn.id, arr: 0, dep: 0 },
          { station_id: lbp.id, arr: 35, dep: 40 },
          { station_id: tbi.id, arr: 95, dep: 105 },
          { station_id: kis.id, arr: 175, dep: 185 },
          { station_id: rap.id, arr: 320, dep: 320 },
        ];
        const r2Stops = [
          { station_id: rap.id, arr: 0, dep: 0 },
          { station_id: kis.id, arr: 135, dep: 145 },
          { station_id: tbi.id, arr: 215, dep: 225 },
          { station_id: lbp.id, arr: 280, dep: 285 },
          { station_id: mdn.id, arr: 320, dep: 320 },
        ];

        const generateFares = (schedId: number, stopsList: typeof r1Stops) => {
          const totalMin = 320;
          for (let i = 0; i < stopsList.length - 1; i++) {
            for (let j = i + 1; j < stopsList.length; j++) {
              const segMin = Math.max(1, stopsList[j].arr - stopsList[i].dep);
              const p = Math.max(0.25, Math.min(1.0, segMin / totalMin));
              insertFare.run(schedId, stopsList[i].station_id, stopsList[j].station_id, 'EXECUTIVE', 'A', Math.round((220000 * p) / 5000) * 5000, 40);
              insertFare.run(schedId, stopsList[i].station_id, stopsList[j].station_id, 'EXECUTIVE', 'H', Math.round((220000 * p * 0.85) / 5000) * 5000, 40);
              insertFare.run(schedId, stopsList[i].station_id, stopsList[j].station_id, 'ECONOMY', 'C', Math.round((120000 * p) / 5000) * 5000, 64);
              insertFare.run(schedId, stopsList[i].station_id, stopsList[j].station_id, 'ECONOMY', 'P', Math.round((120000 * p * 0.85) / 5000) * 5000, 80);
            }
          }
        };

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const d = new Date(Date.now() + dayOffset * 86400000);
          const dateStr = d.toISOString().split('T')[0];

          // Outbound MDN -> RAP
          const s1 = insertSchedule.run(r1Id, dateStr, '07:30', 'OPEN', 'Jalur 2 - Pintu Selatan');
          generateFares(Number(s1.lastInsertRowid), r1Stops);

          const s1Sore = insertSchedule.run(r1Id, dateStr, '15:30', 'OPEN', 'Jalur 2 - Pintu Selatan');
          generateFares(Number(s1Sore.lastInsertRowid), r1Stops);

          const s1Malam = insertSchedule.run(r1Id, dateStr, '21:00', 'OPEN', 'Jalur 1 - Pintu Timur');
          generateFares(Number(s1Malam.lastInsertRowid), r1Stops);

          // Inbound RAP -> MDN
          const s2Pagi = insertSchedule.run(r2Id, dateStr, '07:45', 'OPEN', 'Jalur 1 - Loket Praktik');
          generateFares(Number(s2Pagi.lastInsertRowid), r2Stops);

          const s2 = insertSchedule.run(r2Id, dateStr, '14:30', 'OPEN', 'Jalur 1 - Loket Praktik');
          generateFares(Number(s2.lastInsertRowid), r2Stops);

          const s2Malam = insertSchedule.run(r2Id, dateStr, '22:15', 'OPEN', 'Jalur 2 - Peron Utama');
          generateFares(Number(s2Malam.lastInsertRowid), r2Stops);
        }
      }
    }


    // Tour Package
    const costing = JSON.stringify({
      destination: 'Danau Toba & Pulau Samosir',
      paxCount: 30,
      totalHPP: 32400000,
      hppPerPax: 1080000,
      marginPercentage: 15,
      sellingPricePerPax: 1250000,
      components: [
        { category: 'Transport', item: 'Sewa Bus Jetbus 5 ULP-01 (3 Hari)', cost: 7500000 },
        { category: 'Hotel', item: 'Hotel Bintang 3 Parapat (15 Kamar x 2 Malam)', cost: 12000000 },
        { category: 'Meals', item: 'Makan 8x Prasmanan Tradisional Batak Halal', cost: 7200000 },
      ],
    });

    const tourRes = db.prepare('INSERT OR IGNORE INTO tour_packages (slug, title, destination, duration_days, min_pax, price_per_pax, costing_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('ki-danau-toba-samosir-3d2n', 'Kunjungan Industri & Eksplorasi Danau Toba - Pulau Samosir (3H2M)', 'Parapat & Samosir, Sumatera Utara', 3, 25, 1250000, costing, 'ACTIVE');

    if (tourRes.lastInsertRowid) {
      db.prepare('INSERT INTO tour_itineraries (tour_package_id, day_number, start_time, activity_title, description, location) VALUES (?, ?, ?, ?, ?, ?)')
        .run(Number(tourRes.lastInsertRowid), 1, '07:15', 'Keberangkatan Menuju Parapat via Tol Tebing Tinggi', 'Perjalanan nyaman dengan armada Bus Pariwisata ULP-01.', 'Tol Trans-Sumatera');
    }

    // Initial audit log
    db.prepare('INSERT INTO audit_logs (user_id, action, target_id, ip_address, details) VALUES (?, ?, ?, ?, ?)')
      .run(1, 'DATABASE_AUTO_SEED', 'SYSTEM', '127.0.0.1', 'Automatic database bootstrap and schema migration');
  } catch (err) {
    console.error('Auto seed error:', err);
  }
}

export function toPlain<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(toPlain) as unknown as T;
  }
  const plain: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    plain[key] = toPlain((obj as any)[key]);
  }
  return plain as T;
}

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'travel.db');
  const db = new DatabaseSync(dbPath);

  // Performance and integrity PRAGMAs
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 30000;');
  db.exec('PRAGMA synchronous = NORMAL;');

  // Patch db.prepare to convert sqlite's [Object: null prototype] to React-safe plain objects
  const origPrepare = db.prepare.bind(db);
  (db as any).prepare = (sql: string) => {
    const stmt = origPrepare(sql);
    const origAll = stmt.all.bind(stmt);
    const origGet = stmt.get.bind(stmt);
    stmt.all = (...args: any[]) => toPlain(origAll(...args));
    stmt.get = (...args: any[]) => toPlain(origGet(...args));
    return stmt;
  };

  // Only initialize schema and seed if fresh database
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableCheck) {
      db.exec(SCHEMA_SQL);
      autoSeedIfEmpty(db);
    }
  } catch {
    // If concurrent worker is initializing, wait
    try {
      db.exec(SCHEMA_SQL);
      autoSeedIfEmpty(db);
    } catch {
      // Ignored if already created
    }
  }

  dbInstance = db;
  return dbInstance;
}
