import { SignJWT } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { verifyQRPayload, signBoardingData } from '../src/lib/boarding/qr-crypto.ts';

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

async function runPhase5Tests() {
  console.log('\n======================================================');
  console.log('🧪 MEMULAI PENGUJIAN OTOMATIS FASE 5: CHECK-IN, HMAC QR, SCANNER & FIDS');
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

  // Load test users
  const customer = db.prepare("SELECT * FROM users WHERE email = 'penumpang@gmail.com'").get() ||
    db.prepare("SELECT * FROM users WHERE role = 'CUSTOMER'").get();
  const boardingOfficer = db.prepare("SELECT * FROM users WHERE role = 'BOARDING_OFFICER'").get();
  const superAdmin = db.prepare("SELECT * FROM users WHERE role = 'SUPER_ADMIN'").get();

  const customerCookie = await getAuthCookie(customer);
  const boardingOfficerCookie = await getAuthCookie(boardingOfficer);
  const superAdminCookie = await getAuthCookie(superAdmin);

  // Clean up any old test bookings to isolate tests
  const prevBookings = db.prepare("SELECT id FROM bookings WHERE invoice_number LIKE 'INV-%'").all();
  for (const b of prevBookings) {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(b.id);
  }

  // Find stations
  const mdnStation = db.prepare("SELECT * FROM stations WHERE code = 'MDN'").get();
  const rapStation = db.prepare("SELECT * FROM stations WHERE code = 'RAP'").get();

  const todayStr = new Date().toISOString().split('T')[0];

  // Search schedule
  const resSearch = await fetch(`${BASE_URL}/api/search/schedules?origin=MDN&destination=RAP&date=${todayStr}`);
  const dataSearch = await resSearch.json();
  const sched = dataSearch.schedules?.[0];
  assert(Boolean(sched), `Jadwal operasional ditemukan via Search API (Schedule ID: ${sched?.schedule_id})`);

  const fare = sched.fares.find(f => f.wagon_class === 'EXECUTIVE') || sched.fares[0];

  const resSeatMap = await fetch(
    `${BASE_URL}/api/schedules/${sched.schedule_id}/seat-map?origin_station_id=${mdnStation.id}&destination_station_id=${rapStation.id}&wagon_class=${fare.wagon_class}`
  );
  const dataSeatMap = await resSeatMap.json();
  const wagon = dataSeatMap.wagons?.[0];

  // -------------------------------------------------------------
  // TEST SUITE 1: Online Check-In Workflow & State Machine
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Alur Online Check-In & Validasi Pembayaran ---');

  // 1a. Create Booking
  const bookingPayload = {
    trip_type: 'ONE_WAY',
    contact: {
      name: 'Rudi Hartono',
      email: 'rudi.phase5@example.com',
      phone: '081234556677',
    },
    departure_segment: {
      schedule_id: sched.schedule_id,
      origin_station_id: mdnStation.id,
      destination_station_id: rapStation.id,
      wagon_class: fare.wagon_class,
      subclass: fare.subclass,
      seats: [{ wagon_id: wagon.id, seat_number: '3A' }],
    },
    passengers: [
      { name: 'Rudi Hartono', identity_number: '1271021200030003', type: 'ADULT' },
    ],
  };

  const resBooking = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingPayload),
  });
  const dataBooking = await resBooking.json();
  assert(resBooking.status === 201, `Booking baru berhasil dibuat (Invoice: ${dataBooking.invoice_number})`);

  const pnrCode = dataBooking.departure_pnr;

  // 1b. Attempt Check-In while status is still PENDING -> Must be rejected with 400
  const resCheckInPending = await fetch(`${BASE_URL}/api/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pnr_code: pnrCode }),
  });
  const dataCheckInPending = await resCheckInPending.json();
  assert(
    resCheckInPending.status === 400,
    `Check-In ditolak jika tiket belum lunas (HTTP 400: ${dataCheckInPending.error})`
  );

  // 1c. Settle Payment
  const resPay = await fetch(`${BASE_URL}/api/bookings/${dataBooking.invoice_number}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_method: 'QRIS' }),
  });
  const dataPay = await resPay.json();
  assert(resPay.status === 200 && dataPay.payment_status === 'PAID', `Tiket berhasil dilunasi (Status PAID)`);

  // 1d. Perform Online Check-In now -> Must succeed with 200
  const resCheckIn = await fetch(`${BASE_URL}/api/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pnr_code: pnrCode }),
  });
  const dataCheckIn = await resCheckIn.json();
  assert(resCheckIn.status === 200, `Online Check-In berhasil (HTTP 200 OK)`);
  assert(
    dataCheckIn.passengers?.length === 1 && dataCheckIn.passengers[0].status === 'CHECKED_IN',
    `Status penumpang berubah menjadi CHECKED_IN`
  );

  const checkedInPax = dataCheckIn.passengers[0];
  assert(
    checkedInPax.signature && checkedInPax.signature.length === 64,
    `Tanda tangan digital HMAC-SHA256 64-hex terbit: ${checkedInPax.signature.substring(0, 16)}...`
  );

  const authenticQRPayload = checkedInPax.payload;
  assert(
    authenticQRPayload && authenticQRPayload.startsWith('ULP-BP|'),
    `Format payload QR Code valid: ${authenticQRPayload.substring(0, 25)}...`
  );

  // Check audit log for PASSENGER_CHECKIN
  const auditCheckIn = db.prepare(`
    SELECT * FROM audit_logs WHERE action = 'PASSENGER_CHECKIN' ORDER BY created_at DESC LIMIT 1
  `).get();
  assert(Boolean(auditCheckIn), `Audit log PASSENGER_CHECKIN tercatat di database`);

  // -------------------------------------------------------------
  // TEST SUITE 2: Anti-Tampering & Cryptographic Signature Rejection
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Anti-Tampering & Proteksi Kriptografi QR Palsu ---');

  // Create a tampered QR payload by swapping seat number to '1A' while keeping old signature
  const parts = authenticQRPayload.split('|');
  const tamperedSeatPayload = `${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}|1A|${parts[5]}`;

  const resTamperedSeat = await fetch(`${BASE_URL}/api/boarding/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: boardingOfficerCookie,
    },
    body: JSON.stringify({ payload: tamperedSeatPayload }),
  });
  const dataTamperedSeat = await resTamperedSeat.json();
  assert(
    resTamperedSeat.status === 403,
    `Percobaan modifikasi nomor kursi ditolak (HTTP 403 Forbidden: ${dataTamperedSeat.error})`
  );

  // Create a fake QR with bogus signature
  const fakeSignaturePayload = `ULP-BP|${pnrCode}|${checkedInPax.id}|${sched.schedule_id}|3A|00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff`;
  const resFakeSig = await fetch(`${BASE_URL}/api/boarding/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: boardingOfficerCookie,
    },
    body: JSON.stringify({ payload: fakeSignaturePayload }),
  });
  assert(
    resFakeSig.status === 403,
    `Percobaan signature palsu ditolak keras oleh timingSafeEqual (HTTP 403 Forbidden)`
  );

  // Check audit log for PASSENGER_BOARDING_FORBIDDEN
  const auditForbidden = db.prepare(`
    SELECT * FROM audit_logs WHERE action = 'PASSENGER_BOARDING_FORBIDDEN' ORDER BY created_at DESC LIMIT 1
  `).get();
  assert(Boolean(auditForbidden), `Percobaan scan QR palsu tercatat di audit_logs (PASSENGER_BOARDING_FORBIDDEN)`);

  // -------------------------------------------------------------
  // TEST SUITE 3: Valid Gate Boarding & Anti-Passback Protection
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Verifikasi Gate Boarding Resmi & Anti-Passback ---');

  // 3a. Boarding Officer scans authentic QR
  const resBoardingSuccess = await fetch(`${BASE_URL}/api/boarding/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: boardingOfficerCookie,
    },
    body: JSON.stringify({ payload: authenticQRPayload }),
  });
  const dataBoardingSuccess = await resBoardingSuccess.json();
  assert(
    resBoardingSuccess.status === 200,
    `Verifikasi boarding oleh Petugas berhasil (HTTP 200: ${dataBoardingSuccess.message})`
  );
  assert(
    dataBoardingSuccess.passenger?.status === 'BOARDED',
    `Status penumpang resmi berubah menjadi BOARDED`
  );

  // Check in database
  const paxInDb = db.prepare(`SELECT * FROM booking_passengers WHERE id = ?`).get(checkedInPax.id);
  assert(
    paxInDb && paxInDb.boarding_status === 'BOARDED' && paxInDb.boarded_at !== null,
    `Database terverifikasi: boarding_status = 'BOARDED' & waktu boarded_at tercatat`
  );

  // Check audit log for PASSENGER_BOARDED
  const auditBoarded = db.prepare(`
    SELECT * FROM audit_logs WHERE action = 'PASSENGER_BOARDED' ORDER BY created_at DESC LIMIT 1
  `).get();
  assert(Boolean(auditBoarded), `Audit log PASSENGER_BOARDED tercatat di database`);

  // 3b. Anti-Passback Test: Scan again with same QR
  const resDoubleScan = await fetch(`${BASE_URL}/api/boarding/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: boardingOfficerCookie,
    },
    body: JSON.stringify({ payload: authenticQRPayload }),
  });
  const dataDoubleScan = await resDoubleScan.json();
  assert(
    resDoubleScan.status === 409,
    `Anti-Passback Aktif: Pemindaian kedua ditolak (HTTP 409 Conflict: ${dataDoubleScan.error})`
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: RBAC Guard on Boarding Scanner
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Proteksi RBAC pada Endpoint Scanner ---');

  // Customer tries to call verify endpoint
  const resCustVerify = await fetch(`${BASE_URL}/api/boarding/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: customerCookie,
    },
    body: JSON.stringify({ payload: authenticQRPayload }),
  });
  assert(
    resCustVerify.status === 403,
    `Penumpang/Customer ditolak saat mencoba mengakses endpoint scanner (HTTP 403 Forbidden)`
  );

  // -------------------------------------------------------------
  // TEST SUITE 5: FIDS Display API
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Layar TV FIDS Stasiun API ---');

  const resFids = await fetch(`${BASE_URL}/api/fids?date=${todayStr}`);
  const dataFids = await resFids.json();
  assert(resFids.status === 200, `Endpoint FIDS mengembalikan data (HTTP 200 OK)`);
  assert(
    dataFids.items && dataFids.items.length > 0,
    `FIDS menampilkan daftar jadwal keberangkatan aktif (${dataFids.items.length} Jadwal)`
  );

  const fidsFirst = dataFids.items.find(i => i.schedule_id === sched.schedule_id);
  assert(
    fidsFirst && fidsFirst.gate_info && fidsFirst.stops_sequence,
    `Struktur FIDS lengkap: Jam ${fidsFirst?.departure_time}, Gate ${fidsFirst?.gate_info}, Rute: ${fidsFirst?.stops_sequence}`
  );
  assert(
    fidsFirst?.boarded_count >= 1,
    `FIDS secara real-time mencatat penumpang yang sudah boarding (${fidsFirst?.boarded_count} Penumpang)`
  );

  console.log('\n======================================================');
  console.log(`🏁 HASIL PENGUJIAN FASE 5: ${passed} PASS, ${failed} FAIL`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test error in Phase 5:', err);
  process.exit(1);
});
