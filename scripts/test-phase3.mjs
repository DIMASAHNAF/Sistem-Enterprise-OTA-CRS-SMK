import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const dbPath = path.join(process.cwd(), 'data', 'travel.db');
const db = new DatabaseSync(dbPath);

async function runPhase3Tests() {
  console.log('\n======================================================');
  console.log('🧪 MEMULAI PENGUJIAN OTOMATIS FASE 3: SEARCH & SEAT MAP');
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

  // -------------------------------------------------------------
  // TEST SUITE 1: Strict Validation on Schedule Search
  // -------------------------------------------------------------
  console.log('--- TEST 1: Validasi Parameter Pencarian Jadwal ---');

  // 1a. origin === destination
  const resSameStation = await fetch(`${BASE_URL}/api/search/schedules?origin=MDN&destination=MDN&date=2026-10-20`);
  assert(resSameStation.status === 400, 'Sistem menolak pencarian jika stasiun asal sama dengan tujuan (HTTP 400)');

  // 1b. infants > adults
  const resInfantsOver = await fetch(`${BASE_URL}/api/search/schedules?origin=MDN&destination=RAP&date=2026-10-20&adults=1&infants=2`);
  assert(resInfantsOver.status === 400, 'Sistem menolak jika jumlah bayi > dewasa (1 bayi wajib dipangku 1 dewasa) (HTTP 400)');

  // 1c. adults < 1
  const resZeroAdults = await fetch(`${BASE_URL}/api/search/schedules?origin=MDN&destination=RAP&date=2026-10-20&adults=0`);
  assert(resZeroAdults.status === 400, 'Sistem menolak jika jumlah penumpang dewasa < 1 (HTTP 400)');

  // -------------------------------------------------------------
  // TEST SUITE 2: Multi-Segment Time & Duration Calculation
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Perhitungan Waktu Transit & Durasi Multi-Segmen ---');

  const todayStr = new Date().toISOString().split('T')[0];

  // 2a. Full Journey MDN -> RAP
  const resFull = await fetch(`${BASE_URL}/api/search/schedules?origin=MDN&destination=RAP&date=${todayStr}`);
  const dataFull = await resFull.json();
  assert(resFull.status === 200 && dataFull.schedules?.length > 0, 'Berhasil menemukan jadwal perjalanan penuh MDN -> RAP');

  const firstSched = dataFull.schedules[0];
  assert(
    firstSched.origin_departure_time === '07:30' &&
    firstSched.destination_arrival_time === '12:50' &&
    firstSched.duration_minutes === 320 &&
    firstSched.duration_formatted === '5j 20m',
    `Perhitungan waktu rute penuh akurat: 07:30 -> 12:50 (Durasi: 320m / 5j 20m)`
  );

  // 2b. Intermediate Segment LBP -> KIS
  // LBP dep offset = 40m, KIS arr offset = 175m -> Duration = 135m (2j 15m)
  // Base 07:30 + 40m = 08:10 WIB; Base 07:30 + 175m = 10:25 WIB
  const resInter = await fetch(`${BASE_URL}/api/search/schedules?origin=LBP&destination=KIS&date=${todayStr}`);
  const dataInter = await resInter.json();
  assert(resInter.status === 200 && dataInter.schedules?.length > 0, 'Berhasil menemukan jadwal segmen transit LBP -> KIS');

  const interSched = dataInter.schedules[0];
  assert(
    interSched.origin_departure_time === '08:10' &&
    interSched.destination_arrival_time === '10:25' &&
    interSched.duration_minutes === 135 &&
    interSched.duration_formatted === '2j 15m',
    `Perhitungan segmen antara LBP -> KIS tepat: 08:10 -> 10:25 (Durasi: 135m / 2j 15m)`
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: Interactive Wagon Seat Map Structure
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Struktur Denah Kursi Gerbong (Seat Map) ---');

  const mdnStation = db.prepare("SELECT id FROM stations WHERE code = 'MDN'").get();
  const rapStation = db.prepare("SELECT id FROM stations WHERE code = 'RAP'").get();
  const tbiStation = db.prepare("SELECT id FROM stations WHERE code = 'TBI'").get();

  const resSeatMap = await fetch(
    `${BASE_URL}/api/schedules/${firstSched.schedule_id}/seat-map?origin_station_id=${mdnStation.id}&destination_station_id=${rapStation.id}`
  );
  const dataSeatMap = await resSeatMap.json();
  assert(resSeatMap.status === 200 && dataSeatMap.wagons?.length > 0, 'Endpoint seat-map mengembalikan daftar gerbong');

  const wagon1 = dataSeatMap.wagons[0];
  assert(
    wagon1.wagon_code &&
    wagon1.seat_rows?.length === wagon1.rows &&
    wagon1.seat_rows[0].left_seats.length > 0 &&
    wagon1.seat_rows[0].right_seats.length > 0,
    `Gerbong ${wagon1.wagon_code} memiliki denah baris (${wagon1.rows} baris) dan pemisah lorong kiri-kanan`
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Segment Overlap Rule (Aturan Irisan Segmen Kursi)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Simulasi Logika Irisan Segmen Rute (Segment Overlap Rule) ---');

  // Insert a test booking occupying Seat '1A' on MDN -> TBI (Stop 0 to Stop 2)
  const testPnr = 'TEST99';
  const testInvoice = 'INV-TEST-SEGMENT-01';

  // Clean up any previous test
  db.prepare('DELETE FROM booking_passengers WHERE seat_number = ?').run('1A_TEST');
  db.prepare('DELETE FROM booking_segments WHERE pnr_code = ?').run(testPnr);
  db.prepare('DELETE FROM bookings WHERE invoice_number = ?').run(testInvoice);

  const insertBooking = db.prepare(`
    INSERT INTO bookings (invoice_number, user_id, trip_type, total_amount, payment_status)
    VALUES (?, 1, 'ONE_WAY', 85000, 'PAID')
  `);
  const bRes = insertBooking.run(testInvoice);
  const testBookingId = Number(bRes.lastInsertRowid);

  const insertSeg = db.prepare(`
    INSERT INTO booking_segments (booking_id, pnr_code, segment_type, schedule_id, origin_station_id, destination_station_id)
    VALUES (?, ?, 'DEPARTURE', ?, ?, ?)
  `);
  const segRes = insertSeg.run(testBookingId, testPnr, firstSched.schedule_id, mdnStation.id, tbiStation.id);
  const testSegId = Number(segRes.lastInsertRowid);

  const insertPassenger = db.prepare(`
    INSERT INTO booking_passengers (booking_segment_id, full_name, identity_number, pax_type, wagon_id, seat_number, boarding_status)
    VALUES (?, 'Tester Penumpang', '1271012345678901', 'ADULT', ?, '1A', 'BOOKED')
  `);
  insertPassenger.run(testSegId, wagon1.id);

  // 4a. Query MDN -> RAP (which overlaps MDN -> TBI):
  // exist_orig(0) < req_dest(4) AND req_orig(0) < exist_dest(2) -> TRUE!
  const resOverlap = await fetch(
    `${BASE_URL}/api/schedules/${firstSched.schedule_id}/seat-map?origin_station_id=${mdnStation.id}&destination_station_id=${rapStation.id}`
  );
  const dataOverlap = await resOverlap.json();
  const testWagonOverlap = dataOverlap.wagons.find((w) => w.id === wagon1.id);
  const seat1AOverlap = testWagonOverlap.seat_rows[0].all_seats.find((s) => s.seat_number === '1A');

  assert(
    seat1AOverlap && seat1AOverlap.status === 'BOOKED',
    'Segmen Beririsan (MDN -> RAP): Kursi 1A berstatus BOOKED (Tidak Tersedia) karena sudah terisi pada MDN -> TBI'
  );

  // 4b. Query TBI -> RAP (which does NOT overlap MDN -> TBI, passenger gets off at TBI):
  // exist_orig(0) < req_dest(4) is TRUE, BUT req_orig(2) < exist_dest(2) is FALSE!
  const resNonOverlap = await fetch(
    `${BASE_URL}/api/schedules/${firstSched.schedule_id}/seat-map?origin_station_id=${tbiStation.id}&destination_station_id=${rapStation.id}`
  );
  const dataNonOverlap = await resNonOverlap.json();
  const testWagonNonOverlap = dataNonOverlap.wagons.find((w) => w.id === wagon1.id);
  const seat1ANonOverlap = testWagonNonOverlap.seat_rows[0].all_seats.find((s) => s.seat_number === '1A');

  assert(
    seat1ANonOverlap && seat1ANonOverlap.status === 'AVAILABLE',
    'Segmen Bebas Irisan (TBI -> RAP): Kursi 1A berstatus AVAILABLE (Tersedia Kembali) setelah penumpang pertama turun di TBI'
  );

  // Clean up test booking
  db.prepare('DELETE FROM booking_passengers WHERE booking_segment_id = ?').run(testSegId);
  db.prepare('DELETE FROM booking_segments WHERE id = ?').run(testSegId);
  db.prepare('DELETE FROM bookings WHERE id = ?').run(testBookingId);

  console.log('\n======================================================');
  console.log(`📊 RINGKASAN HASIL TEST FASE 3:`);
  console.log(`   TOTAL TESTS : ${passed + failed}`);
  console.log(`   PASSED      : ${passed} ✅`);
  console.log(`   FAILED      : ${failed} ❌`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
