import { SignJWT } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'smk-travel-enterprise-secure-jwt-key-minimum-32-characters-2026'
);

// Helper to mint JWT for test roles
async function getAuthCookie(user) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(SECRET_KEY);

  return `travel_auth_token=${token}`;
}

const dbPath = path.join(process.cwd(), 'data', 'travel.db');
const db = new DatabaseSync(dbPath);

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 MEMULAI PENGUJIAN OTOMATIS FASE 2: MASTER & REVENUE');
  console.log('======================================================\n');

  // Load test users from DB
  const superAdmin = db.prepare("SELECT * FROM users WHERE role = 'SUPER_ADMIN'").get();
  const revenueCtrl = db.prepare("SELECT * FROM users WHERE role = 'REVENUE_CONTROLLER'").get();
  const ticketingOff = db.prepare("SELECT * FROM users WHERE role = 'TICKETING_OFFICER'").get();
  const customer = db.prepare("SELECT * FROM users WHERE role = 'CUSTOMER'").get();

  const superAdminCookie = await getAuthCookie(superAdmin);
  const revenueCtrlCookie = await getAuthCookie(revenueCtrl);
  const ticketingCookie = await getAuthCookie(ticketingOff);
  const customerCookie = await getAuthCookie(customer);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: Master Stations CRUD & Code Duplicate Check
  // -------------------------------------------------------------
  console.log('--- TEST 1: Master Stasiun & Validasi Kode Unik ---');
  const uniqueCode = 'TES';
  // Cleanup test station if exists
  db.prepare("DELETE FROM stations WHERE code = ?").run(uniqueCode);

  // 1a. Create Station as SUPER_ADMIN
  const resCreateStation = await fetch(`${BASE_URL}/api/master/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      code: 'tes', // lowercase, should be converted to uppercase TES
      name: 'Stasiun Uji Otomatis',
      city: 'Kota Pengujian',
      type: 'TRAIN_STATION',
    }),
  });
  const dataCreateStation = await resCreateStation.json();
  assert(resCreateStation.status === 201 && dataCreateStation.station.code === 'TES', 'Super Admin berhasil membuat stasiun baru dengan auto-uppercase (TES)');

  // 1b. Duplicate Code check
  const resDupStation = await fetch(`${BASE_URL}/api/master/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      code: 'TES',
      name: 'Stasiun Duplikat',
      city: 'Kota Lain',
      type: 'TRAIN_STATION',
    }),
  });
  const dataDupStation = await resDupStation.json();
  assert(resDupStation.status === 400 && dataDupStation.error?.includes('sudah terdaftar'), 'Sistem menolak penambahan stasiun dengan kode duplikat (HTTP 400)');

  // 1c. Invalid length code (< 3 or > 3)
  const resInvalidCode = await fetch(`${BASE_URL}/api/master/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      code: 'ABCD',
      name: 'Stasiun Salah Kode',
      city: 'Kota',
      type: 'TRAIN_STATION',
    }),
  });
  assert(resInvalidCode.status === 400, 'Sistem menolak kode stasiun yang tidak tepat 3 karakter (HTTP 400)');

  // -------------------------------------------------------------
  // TEST SUITE 2: RBAC Protections on Master & Revenue Endpoints
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Keamanan RBAC (403 Forbidden Guard) ---');

  // 2a. Ticketing Officer accessing /api/master/stations POST
  const resTicketingMaster = await fetch(`${BASE_URL}/api/master/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ticketingCookie },
    body: JSON.stringify({ code: 'XYZ', name: 'Illegal', city: 'Illegal', type: 'TRAIN_STATION' }),
  });
  assert(resTicketingMaster.status === 403, 'TICKETING_OFFICER ditolak 403 Forbidden saat mengakses mutasi /api/master/stations');

  // 2b. Customer accessing /api/revenue/routes POST
  const resCustomerRevenue = await fetch(`${BASE_URL}/api/revenue/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
    body: JSON.stringify({ fleet_id: 1, route_name: 'Illegal Route', direction: 'OUTBOUND', stops: [] }),
  });
  assert(resCustomerRevenue.status === 403, 'CUSTOMER ditolak 403 Forbidden saat mengakses mutasi /api/revenue/routes');

  // 2c. Ticketing Officer accessing /api/revenue/schedules POST
  const resTicketingSchedule = await fetch(`${BASE_URL}/api/revenue/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ticketingCookie },
    body: JSON.stringify({ route_id: 1, departure_date: '2026-10-20', base_departure_time: '08:00' }),
  });
  assert(resTicketingSchedule.status === 403, 'TICKETING_OFFICER ditolak 403 Forbidden saat mengakses mutasi /api/revenue/schedules');

  // 2d. Revenue Controller allowed on revenue endpoints
  const resRevenueCtrlAccess = await fetch(`${BASE_URL}/api/revenue/routes`, {
    method: 'GET',
    headers: { Cookie: revenueCtrlCookie },
  });
  assert(resRevenueCtrlAccess.status === 200, 'REVENUE_CONTROLLER diizinkan mengakses /api/revenue/routes (HTTP 200)');

  // -------------------------------------------------------------
  // TEST SUITE 3: Route Creation, Stop Validation & 1-Click Reverse
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Route Builder Timeline & 1-Click Reverse Route ---');

  const mdn = db.prepare("SELECT id FROM stations WHERE code = 'MDN'").get();
  const lbp = db.prepare("SELECT id FROM stations WHERE code = 'LBP'").get();
  const tbi = db.prepare("SELECT id FROM stations WHERE code = 'TBI'").get();
  const fleet = db.prepare("SELECT id FROM fleets WHERE type = 'TRAIN'").get();

  // 3a. Invalid Stop Timeline (arrival > departure)
  const resInvalidTimeline = await fetch(`${BASE_URL}/api/revenue/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: revenueCtrlCookie },
    body: JSON.stringify({
      fleet_id: fleet.id,
      route_name: 'Rute Timeline Salah',
      direction: 'OUTBOUND',
      stops: [
        { station_id: mdn.id, stop_order: 0, arrival_offset_minutes: 0, departure_offset_minutes: 0 },
        { station_id: lbp.id, stop_order: 1, arrival_offset_minutes: 60, departure_offset_minutes: 40 }, // Dep earlier than Arr!
      ],
    }),
  });
  assert(resInvalidTimeline.status === 400, 'Sistem menolak rute jika departure offset lebih kecil dari arrival offset (HTTP 400)');

  // 3b. Create Valid Outbound Route with 3 stops
  const resValidRoute = await fetch(`${BASE_URL}/api/revenue/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: revenueCtrlCookie },
    body: JSON.stringify({
      fleet_id: fleet.id,
      route_name: 'Test Jalur Cepat (MDN - TBI)',
      direction: 'OUTBOUND',
      stops: [
        { station_id: mdn.id, stop_order: 0, arrival_offset_minutes: 0, departure_offset_minutes: 0 },
        { station_id: lbp.id, stop_order: 1, arrival_offset_minutes: 35, departure_offset_minutes: 40 },
        { station_id: tbi.id, stop_order: 2, arrival_offset_minutes: 95, departure_offset_minutes: 95 },
      ],
    }),
  });
  const dataValidRoute = await resValidRoute.json();
  assert(resValidRoute.status === 201 && dataValidRoute.routeId, 'Berhasil membuat rute berarah OUTBOUND dengan urutan timeline valid');
  const outboundRouteId = dataValidRoute.routeId;

  // 3c. 1-Click Reverse Route
  const resReverse = await fetch(`${BASE_URL}/api/revenue/routes/${outboundRouteId}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: revenueCtrlCookie },
    body: JSON.stringify({ route_name: 'Test Jalur Cepat Pulang (TBI - MDN)' }),
  });
  const dataReverse = await resReverse.json();
  assert(resReverse.status === 201 && dataReverse.direction === 'INBOUND', '1-Click Reverse Route berhasil menghasilkan rute INBOUND otomatis');

  // Verify reverse stops in database
  const revStops = db.prepare(`
    SELECT rs.*, s.code FROM route_stops rs
    JOIN stations s ON rs.station_id = s.id
    WHERE rs.route_id = ?
    ORDER BY rs.stop_order ASC
  `).all(dataReverse.routeId);

  assert(
    revStops.length === 3 &&
    revStops[0].code === 'TBI' && revStops[0].arrival_offset_minutes === 0 &&
    revStops[1].code === 'LBP' &&
    revStops[2].code === 'MDN' && revStops[2].arrival_offset_minutes === 95,
    'Struktur rute kebalikan terbukti membalik urutan stasiun (TBI -> LBP -> MDN) dan mempertahankan total durasi perjalanan 95 menit'
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Schedule Creation & Combinatorial Fare Generator
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Combinatorial Segment Fare Matrix & Bulk Calculator ---');

  // Find Route 1 (which has 5 stops: MDN, LBP, TBI, KIS, RAP)
  const route5Stops = db.prepare(`
    SELECT r.id, COUNT(rs.id) as stop_count
    FROM routes r
    JOIN route_stops rs ON r.id = rs.route_id
    GROUP BY r.id
    HAVING stop_count = 5
    LIMIT 1
  `).get();

  assert(route5Stops && route5Stops.stop_count === 5, 'Rute 5 stasiun ditemukan untuk verifikasi N*(N-1)/2 segmen');

  const testDate = '2026-11-01';
  const resCreateSchedule = await fetch(`${BASE_URL}/api/revenue/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: revenueCtrlCookie },
    body: JSON.stringify({
      route_id: route5Stops.id,
      departure_date: testDate,
      base_departure_time: '09:00',
      gate_info: 'Jalur 1 - Uji Otomatis',
      base_executive_fare: 250000,
      base_economy_fare: 140000,
    }),
  });
  const dataCreateSchedule = await resCreateSchedule.json();
  const N = 5;
  const expectedSegments = (N * (N - 1)) / 2; // 10 segments

  assert(
    resCreateSchedule.status === 201 && dataCreateSchedule.totalSegments === expectedSegments,
    `Generator kombinatorial berhasil menghasilkan tepat ${expectedSegments} segmen perjalanan (5*4/2 = 10 segmen)`
  );

  const newScheduleId = dataCreateSchedule.scheduleId;

  // Check fares rows in database
  const fareRows = db.prepare('SELECT * FROM schedule_fares WHERE schedule_id = ?').all(newScheduleId);
  assert(fareRows.length >= 20, `Tersedia ${fareRows.length} baris matriks tarif subclass untuk jadwal baru`);

  // 4b. Test Bulk Fare / Auto-Calculator
  const resBulkCalc = await fetch(`${BASE_URL}/api/revenue/schedules/${newScheduleId}/fares`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: revenueCtrlCookie },
    body: JSON.stringify({
      bulk_calculator: {
        executive_base_price: 300000,
        economy_base_price: 180000,
        promo_discount_percent: 20,
      },
    }),
  });
  const dataBulkCalc = await resBulkCalc.json();
  assert(resBulkCalc.status === 200 && dataBulkCalc.success, 'Bulk Fare Auto-Calculator berhasil mengkalkulasi ulang seluruh segmen');

  // Verify full-trip executive fare price is updated to ~300000
  const rapStation = db.prepare("SELECT id FROM stations WHERE code = 'RAP'").get();
  const mdnStation = db.prepare("SELECT id FROM stations WHERE code = 'MDN'").get();
  const fullFare = db.prepare(`
    SELECT * FROM schedule_fares
    WHERE schedule_id = ? AND origin_station_id = ? AND destination_station_id = ? AND wagon_class = 'EXECUTIVE' AND subclass = 'A'
  `).get(newScheduleId, mdnStation.id, rapStation.id);

  assert(fullFare && fullFare.price === 300000, 'Tarif segmen penuh MDN -> RAP Eksekutif Subclass A berhasil dikalkulasi menjadi Rp 300.000');

  // -------------------------------------------------------------
  // TEST SUITE 5: Audit Logging Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Verifikasi Audit Logging Mutasi ---');
  const auditActions = db.prepare(`
    SELECT action FROM audit_logs
    ORDER BY id DESC
    LIMIT 15
  `).all().map((r) => r.action);

  assert(auditActions.includes('STATION_CREATE'), 'Audit log mencatat STATION_CREATE');
  assert(auditActions.includes('ROUTE_CREATE'), 'Audit log mencatat ROUTE_CREATE');
  assert(auditActions.includes('ROUTE_REVERSE_GENERATE'), 'Audit log mencatat ROUTE_REVERSE_GENERATE');
  assert(auditActions.includes('SCHEDULE_CREATE'), 'Audit log mencatat SCHEDULE_CREATE');
  assert(auditActions.includes('SCHEDULE_FARES_AUTO_CALCULATE'), 'Audit log mencatat SCHEDULE_FARES_AUTO_CALCULATE');

  console.log('\n======================================================');
  console.log(`📊 RINGKASAN HASIL TEST FASE 2:`);
  console.log(`   TOTAL TESTS : ${passed + failed}`);
  console.log(`   PASSED      : ${passed} ✅`);
  console.log(`   FAILED      : ${failed} ❌`);
  console.log('======================================================\n');

  // Cleanup test station TES after tests complete
  db.prepare("DELETE FROM route_stops WHERE station_id IN (SELECT id FROM stations WHERE code = 'TES')").run();
  db.prepare("DELETE FROM stations WHERE code = 'TES'").run();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
