import { SignJWT } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'smk-travel-enterprise-secure-jwt-key-minimum-32-characters-2026'
);

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

async function runPhase6Tests() {
  console.log('\n======================================================');
  console.log('🧪 MEMULAI PENGUJIAN OTOMATIS FASE 6: TOUR PLANNER, HPP COSTING & MANIFEST KI');
  console.log('======================================================\n');

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

  // 1. Prepare Users
  const tourPlanner = db.prepare("SELECT * FROM users WHERE role = 'TOUR_PLANNER'").get();
  const boardingOfficer = db.prepare("SELECT * FROM users WHERE role = 'BOARDING_OFFICER'").get();
  const customer = db.prepare("SELECT * FROM users WHERE role = 'CUSTOMER'").get();

  assert(tourPlanner, 'Akun Tour Planner ditemukan di database');
  assert(boardingOfficer, 'Akun Boarding Officer ditemukan di database');
  assert(customer, 'Akun Customer ditemukan di database');

  const plannerCookie = await getAuthCookie(tourPlanner);
  const officerCookie = await getAuthCookie(boardingOfficer);
  const customerCookie = await getAuthCookie(customer);

  let createdPkgId = null;
  let createdPkgSlug = null;

  // =========================================================================
  // TEST 1: Akurasi Kalkulator HPP Tour Costing
  // =========================================================================
  console.log('\n--- TEST 1: Akurasi Kalkulator HPP Tour Costing ---');

  const tourData = {
    title: `Kunjungan Industri PT Inalum & Danau Toba ULP-${Date.now().toString().slice(-4)}`,
    destination: 'Kuala Tanjung & Parapat',
    duration_days: 3,
    min_pax: 30,
    free_pax: 2,
    margin_percentage: 15,
    fixed_costs: [
      { item: 'Sewa Bus Pariwisata Jetbus 5 ULP-01 (3 Hari)', cost: 7500000, category: 'Transport' },
      { item: 'BBM, Tol Trans-Sumatera & Parkir', cost: 1500000, category: 'Transport' },
      { item: 'Fee Tour Leader & Pemandu Lokal', cost: 1200000, category: 'Guide' },
    ],
    variable_costs: [
      { item: 'Hotel Bintang 3 (Twin Share, 2 Malam)', cost: 300000, category: 'Hotel' },
      { item: 'Konsumsi Makan 6x Prasmanan Halal', cost: 180000, category: 'Meals' },
      { item: 'Tiket Masuk & Asuransi Perjalanan', cost: 70000, category: 'Tickets' },
    ],
    status: 'ACTIVE',
  };

  // Expected calculations:
  // Fixed Total = 7,500,000 + 1,500,000 + 1,200,000 = 10,200,000
  // Variable per Pax = 300,000 + 180,000 + 70,000 = 550,000
  // Total participants = 30 + 2 = 32
  // Total Group Cost = 10,200,000 + (550,000 * 32) = 10,200,000 + 17,600,000 = 27,800,000
  // HPP per Paying Pax = 27,800,000 / 30 = 926,666.67 => 926,667
  // Selling Price per Pax = Math.ceil((926,667 * 1.15) / 1000) * 1000 = 1,066,000

  const createPkgRes = await fetch(`${BASE_URL}/api/tour/packages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: plannerCookie,
    },
    body: JSON.stringify(tourData),
  });

  const createPkgJson = await createPkgRes.json();
  assert(createPkgRes.status === 201, `Pembuatan paket tour berhasil (HTTP 201 Created)`);
  assert(createPkgJson.package && createPkgJson.package.id, `Paket ID terbit: ${createPkgJson.package?.id}`);

  createdPkgId = createPkgJson.package.id;
  createdPkgSlug = createPkgJson.package.slug;

  const costing = createPkgJson.package.costing;
  assert(costing.total_fixed_cost === 10200000, `Total Fixed Cost akurat: Rp ${costing.total_fixed_cost}`);
  assert(costing.total_variable_cost_per_pax === 550000, `Total Variable Cost/Pax akurat: Rp ${costing.total_variable_cost_per_pax}`);
  assert(costing.total_group_cost === 27800000, `Total Pengeluaran Rombongan (32 orang) akurat: Rp ${costing.total_group_cost}`);
  assert(costing.hpp_per_pax === 926667, `HPP per Paying Pax akurat: Rp ${costing.hpp_per_pax}`);
  assert(createPkgJson.package.price_per_pax === 1066000, `Harga Jual Resmi per Pax (Margin 15% + Pembulatan ribuan) akurat: Rp ${createPkgJson.package.price_per_pax}`);

  // Check audit log in DB
  const createLog = db.prepare("SELECT * FROM audit_logs WHERE action = 'TOUR_PACKAGE_CREATE' AND target_id = ?").get(String(createdPkgId));
  assert(createLog, `Audit log TOUR_PACKAGE_CREATE tercatat di database`);

  // =========================================================================
  // TEST 2: Manajemen Itinerary Builder
  // =========================================================================
  console.log('\n--- TEST 2: Manajemen Itinerary Builder ---');

  const itinerariesToAdd = [
    { day_number: 1, start_time: '07:00', activity_title: 'Kumpul di Titik Kumpul SMK & Doa Bersama', location: 'Gedung Utama SMK' },
    { day_number: 1, start_time: '12:00', activity_title: 'Kunjungan Industri Pabrik Peleburan Inalum', location: 'Kuala Tanjung' },
    { day_number: 2, start_time: '08:30', activity_title: 'Eksplorasi Budaya & Kain Ulos Tradisional', location: 'Desa Tomok Samosir' },
  ];

  for (const itin of itinerariesToAdd) {
    const addItinRes = await fetch(`${BASE_URL}/api/tour/packages/${createdPkgId}/itineraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: plannerCookie,
      },
      body: JSON.stringify(itin),
    });
    const addItinJson = await addItinRes.json();
    assert(addItinRes.status === 201, `Itinerary '${itin.activity_title}' berhasil ditambahkan (Hari ${itin.day_number} - ${itin.start_time} WIB)`);
  }

  // Verify list
  const getItinRes = await fetch(`${BASE_URL}/api/tour/packages/${createdPkgId}/itineraries`);
  const getItinJson = await getItinRes.json();
  assert(getItinRes.status === 200, `API get itineraries mengembalikan HTTP 200 OK`);
  assert(getItinJson.itineraries.length === 3, `Jumlah agenda itinerary sesuai: 3 aktivitas`);
  assert(getItinJson.itineraries[0].start_time === '07:00' && getItinJson.itineraries[1].start_time === '12:00', `Urutan jadwal kronologis terurut dengan benar`);

  // =========================================================================
  // TEST 3: Manajemen Manifest Bus, Anti-Double-Seat Bus, & Rooming List
  // =========================================================================
  console.log('\n--- TEST 3: Manajemen Manifest Bus, Anti-Double-Seat Bus & Rooming List ---');

  // Let's grab 2 distinct users
  const userList = db.prepare("SELECT id, name FROM users WHERE role = 'CUSTOMER' LIMIT 2").all();
  const user1 = userList[0] || customer;
  const user2 = userList[1] || tourPlanner;

  // Assign user 1 to Bus 1, Seat 1A, Kamar 201
  const assign1Res = await fetch(`${BASE_URL}/api/tour/manifests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: plannerCookie,
    },
    body: JSON.stringify({
      tour_package_id: createdPkgId,
      user_id: user1.id,
      bus_name: 'Bus 1 - Jetbus 5 ULP-01',
      seat_number: '1A',
      room_number: 'Kamar 201',
    }),
  });
  const assign1Json = await assign1Res.json();
  assert(assign1Res.status === 201, `Peserta 1 (${user1.name}) berhasil dialokasikan ke Bus 1 - Kursi 1A - Kamar 201`);
  const manifestId1 = assign1Json.manifest.id;

  // Anti-Double-Seat validation: Try assigning user 2 to same seat 1A on Bus 1
  const duplicateSeatRes = await fetch(`${BASE_URL}/api/tour/manifests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: plannerCookie,
    },
    body: JSON.stringify({
      tour_package_id: createdPkgId,
      user_id: user2.id,
      bus_name: 'Bus 1 - Jetbus 5 ULP-01',
      seat_number: '1A',
      room_number: 'Kamar 202',
    }),
  });
  const duplicateSeatJson = await duplicateSeatRes.json();
  assert(duplicateSeatRes.status === 409, `Anti-Double-Seat Aktif: Kursi 1A yang sudah terisi ditolak (HTTP 409 Conflict: ${duplicateSeatJson.error})`);

  // Assign user 2 to different seat 1B on Bus 1, same Kamar 201
  const assign2Res = await fetch(`${BASE_URL}/api/tour/manifests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: plannerCookie,
    },
    body: JSON.stringify({
      tour_package_id: createdPkgId,
      user_id: user2.id,
      bus_name: 'Bus 1 - Jetbus 5 ULP-01',
      seat_number: '1B',
      room_number: 'Kamar 201',
    }),
  });
  assert(assign2Res.status === 201, `Peserta 2 (${user2.name}) berhasil dialokasikan ke Bus 1 - Kursi 1B - Kamar 201`);

  // Check Manifest & Rooming list API
  const getManifestRes = await fetch(`${BASE_URL}/api/tour/manifests?tour_package_id=${createdPkgId}`);
  const getManifestJson = await getManifestRes.json();
  assert(getManifestRes.status === 200, `API manifest mengembalikan data (HTTP 200 OK)`);
  assert(getManifestJson.manifests.length === 2, `Total manifest paket wisata akurat: 2 siswa`);

  const room201 = getManifestJson.room_summary.find((r) => r.room_number === 'Kamar 201');
  assert(room201 && room201.occupants.length === 2, `Rooming List teragregasi akurat: Kamar 201 diisi oleh 2 siswa (${room201?.occupants.map((o) => o.user_name).join(', ')})`);

  const assignLog = db.prepare("SELECT * FROM audit_logs WHERE action = 'TOUR_MANIFEST_ASSIGN' AND target_id = ?").get(String(manifestId1));
  assert(assignLog, `Audit log TOUR_MANIFEST_ASSIGN tercatat di database`);

  // =========================================================================
  // TEST 4: Tour Leader Checkpoint Attendance
  // =========================================================================
  console.log('\n--- TEST 4: Tour Leader Checkpoint Attendance ---');

  // Single participant checkpoint 1 update by BOARDING_OFFICER
  const updateCp1Res = await fetch(`${BASE_URL}/api/tour/manifests/${manifestId1}/checkpoint`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: officerCookie,
    },
    body: JSON.stringify({
      checkpoint_num: 1,
      status: 'PRESENT',
    }),
  });
  const updateCp1Json = await updateCp1Res.json();
  assert(updateCp1Res.status === 200, `Petugas Boarding / Tour Leader berhasil mengabsen Checkpoint 1 (HTTP 200: ${updateCp1Json.message})`);

  // Verify DB state
  const manifestInDb = db.prepare('SELECT checkpoint_1_status FROM tour_manifests WHERE id = ?').get(manifestId1);
  assert(manifestInDb.checkpoint_1_status === 1, `Database terverifikasi: checkpoint_1_status = 1 (PRESENT)`);

  // Bulk Checkpoint update ("Tandai Semua Hadir di Bus Ini" for Checkpoint 2)
  const bulkCpRes = await fetch(`${BASE_URL}/api/tour/manifests/bulk-checkpoint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: officerCookie,
    },
    body: JSON.stringify({
      tour_package_id: createdPkgId,
      bus_name: 'Bus 1 - Jetbus 5 ULP-01',
      checkpoint_num: 2,
      status: 'PRESENT',
    }),
  });
  const bulkCpJson = await bulkCpRes.json();
  assert(bulkCpRes.status === 200, `Bulk Checkpoint berhasil: ${bulkCpJson.message}`);
  assert(bulkCpJson.affected_count === 2, `Jumlah siswa yang diabsen serentak akurat: 2 siswa`);

  // Check bus summary statistics
  const checkSummaryRes = await fetch(`${BASE_URL}/api/tour/manifests?tour_package_id=${createdPkgId}`);
  const checkSummaryJson = await checkSummaryRes.json();
  const bus1Stat = checkSummaryJson.bus_summary.find((b) => b.bus_name === 'Bus 1 - Jetbus 5 ULP-01');
  assert(bus1Stat && bus1Stat.cp2_present === 2 && bus1Stat.absent_cp2.length === 0, `Statistik Kehadiran Bus 1 Checkpoint 2: 2/2 Siswa Hadir (100%), 0 Absen`);

  const cpLog = db.prepare("SELECT * FROM audit_logs WHERE action = 'TOUR_CHECKPOINT_UPDATE' ORDER BY id DESC LIMIT 1").get();
  assert(cpLog, `Audit log TOUR_CHECKPOINT_UPDATE tercatat di database`);

  // =========================================================================
  // TEST 5: Proteksi RBAC & Endpoint Publik
  // =========================================================================
  console.log('\n--- TEST 5: Proteksi RBAC & Endpoint Publik ---');

  // Customer cannot create tour package
  const custCreateRes = await fetch(`${BASE_URL}/api/tour/packages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: customerCookie,
    },
    body: JSON.stringify(tourData),
  });
  assert(custCreateRes.status === 403, `Customer ditolak saat mencoba membuat paket wisata (HTTP 403 Forbidden)`);

  // Customer cannot assign manifest
  const custAssignRes = await fetch(`${BASE_URL}/api/tour/manifests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: customerCookie,
    },
    body: JSON.stringify({
      tour_package_id: createdPkgId,
      user_id: user1.id,
      bus_name: 'Bus 1',
      seat_number: '5A',
    }),
  });
  assert(custAssignRes.status === 403, `Customer ditolak saat mencoba mengalokasi manifest (HTTP 403 Forbidden)`);

  // Public Catalog & Detail endpoint test
  const publicPkgRes = await fetch(`${BASE_URL}/api/tour/packages?status=ACTIVE`);
  const publicPkgJson = await publicPkgRes.json();
  assert(publicPkgRes.status === 200, `Katalog paket publik dapat diakses publik (HTTP 200 OK)`);
  assert(publicPkgJson.packages.some((p) => p.id === createdPkgId), `Paket yang baru dibuat muncul di katalog publik`);

  console.log('\n======================================================');
  console.log(`🏁 HASIL PENGUJIAN FASE 6: ${passed} PASS, ${failed} FAIL`);
  console.log('======================================================\n');

  // Clean up created test tour package and related data
  if (createdPkgId) {
    db.prepare('DELETE FROM tour_manifests WHERE tour_package_id = ?').run(createdPkgId);
    db.prepare('DELETE FROM tour_itineraries WHERE tour_package_id = ?').run(createdPkgId);
    db.prepare('DELETE FROM tour_packages WHERE id = ?').run(createdPkgId);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
