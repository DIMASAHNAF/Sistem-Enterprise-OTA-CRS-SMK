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

async function runPhase4Tests() {
  console.log('\n======================================================');
  console.log('🧪 MEMULAI PENGUJIAN OTOMATIS FASE 4: SEAT LOCK, CHECKOUT, POS & E-TICKET');
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
  const customerA = db.prepare("SELECT * FROM users WHERE email = 'penumpang@gmail.com'").get() ||
    db.prepare("SELECT * FROM users WHERE role = 'CUSTOMER'").get();
  const ticketingOfficer = db.prepare("SELECT * FROM users WHERE role = 'TICKETING_OFFICER'").get();
  const superAdmin = db.prepare("SELECT * FROM users WHERE role = 'SUPER_ADMIN'").get();

  const customerACookie = await getAuthCookie(customerA);
  const ticketingCookie = await getAuthCookie(ticketingOfficer);
  const superAdminCookie = await getAuthCookie(superAdmin);

  // Load stations
  const mdnStation = db.prepare("SELECT * FROM stations WHERE code = 'MDN'").get();
  const tbiStation = db.prepare("SELECT * FROM stations WHERE code = 'TBI'").get();
  const rapStation = db.prepare("SELECT * FROM stations WHERE code = 'RAP'").get();

  // Find a schedule for today via Search API
  const todayStr = new Date().toISOString().split('T')[0];
  const resOutSearch = await fetch(`${BASE_URL}/api/search/schedules?origin=MDN&destination=RAP&date=${todayStr}`);
  const dataOutSearch = await resOutSearch.json();
  const outboundSched = dataOutSearch.schedules?.[0];
  assert(Boolean(outboundSched), `Jadwal operasional outbound MDN -> RAP (${todayStr}) ditemukan via Search API`);

  // Find an inbound schedule (RAP -> MDN) via Search API
  const resInSearch = await fetch(`${BASE_URL}/api/search/schedules?origin=RAP&destination=MDN&date=${todayStr}`);
  const dataInSearch = await resInSearch.json();
  const inboundSched = dataInSearch.schedules?.[0];
  assert(Boolean(inboundSched), `Jadwal operasional inbound RAP -> MDN (${todayStr}) ditemukan via Search API`);

  // Find fares from schedule search results
  const outFare = outboundSched.fares.find(f => f.wagon_class === 'EXECUTIVE') || outboundSched.fares[0];
  const inFare = inboundSched.fares.find(f => f.wagon_class === 'EXECUTIVE') || inboundSched.fares[0];

  // Retrieve wagons from seat-map API
  const resOutSeatMap = await fetch(
    `${BASE_URL}/api/schedules/${outboundSched.schedule_id}/seat-map?origin_station_id=${mdnStation.id}&destination_station_id=${rapStation.id}&wagon_class=${outFare.wagon_class}`
  );
  const dataOutSeatMap = await resOutSeatMap.json();
  const outWagon = dataOutSeatMap.wagons?.[0];

  const resInSeatMap = await fetch(
    `${BASE_URL}/api/schedules/${inboundSched.schedule_id}/seat-map?origin_station_id=${rapStation.id}&destination_station_id=${mdnStation.id}&wagon_class=${inFare.wagon_class}`
  );
  const dataInSeatMap = await resInSeatMap.json();
  const inWagon = dataInSeatMap.wagons?.[0];

  assert(Boolean(outWagon && inWagon), `Gerbong kelas ${outFare.wagon_class} tersedia di jadwal keberangkatan & kepulangan`);

  // Clean up any bookings from prior test runs for complete test isolation
  const prevBookings = db.prepare("SELECT id FROM bookings WHERE invoice_number LIKE 'INV-%'").all();
  for (const b of prevBookings) {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(b.id);
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: Server-Side Pricing & Round-Trip PNR Generation
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Server-Side Pricing & Round-Trip PNR Generator ---');

  const tamperedPrice = 999; // Client attempts to tamper price to Rp 999
  const expectedTotalAmount = (outFare.adult_price * 2) + (inFare.adult_price * 2); // 2 Adults, 1 Infant (Rp 0)

  const roundTripPayload = {
    trip_type: 'ROUND_TRIP',
    total_amount: tamperedPrice, // Injected fake price
    contact: {
      name: 'Budi Santoso',
      email: 'budi.phase4@example.com',
      phone: '081234567890',
    },
    departure_segment: {
      schedule_id: outboundSched.schedule_id,
      origin_station_id: mdnStation.id,
      destination_station_id: rapStation.id,
      wagon_class: 'EXECUTIVE',
      subclass: outFare.subclass,
      seats: [
        { wagon_id: outWagon.id, seat_number: '1A' },
        { wagon_id: outWagon.id, seat_number: '1B' },
      ],
    },
    return_segment: {
      schedule_id: inboundSched.schedule_id,
      origin_station_id: rapStation.id,
      destination_station_id: mdnStation.id,
      wagon_class: 'EXECUTIVE',
      subclass: inFare.subclass,
      seats: [
        { wagon_id: inWagon.id, seat_number: '1A' },
        { wagon_id: inWagon.id, seat_number: '1B' },
      ],
    },
    passengers: [
      { name: 'Budi Santoso', identity_number: '1271021508890001', type: 'ADULT' },
      { name: 'Anisa Rahmawati', identity_number: '1271025509920002', type: 'ADULT' },
      { name: 'Alif Santoso (Bayi)', identity_number: '1271022201240005', type: 'INFANT' },
    ],
  };

  const resBooking1 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: customerACookie,
    },
    body: JSON.stringify(roundTripPayload),
  });

  const dataBooking1 = await resBooking1.json();
  if (resBooking1.status !== 201) {
    console.error('Booking 1 failed with status', resBooking1.status, dataBooking1);
  }
  assert(resBooking1.status === 201, `Pembuatan booking Round-Trip berhasil (HTTP 201 Created)`);
  assert(
    dataBooking1.invoice_number && dataBooking1.invoice_number.startsWith('INV-'),
    `Nomor invoice unik terbit: ${dataBooking1.invoice_number}`
  );
  assert(
    dataBooking1.total_amount === expectedTotalAmount,
    `Server-Side Pricing Akurat: Total Rp ${dataBooking1.total_amount} (Abaikan tampered price Rp ${tamperedPrice})`
  );
  assert(
    dataBooking1.departure_pnr && dataBooking1.return_pnr && dataBooking1.departure_pnr !== dataBooking1.return_pnr,
    `Terbit 2 PNR berbeda untuk Pergi (${dataBooking1.departure_pnr}) dan Pulang (${dataBooking1.return_pnr})`
  );
  assert(
    dataBooking1.departure_pnr.length === 6 && /^[A-Z0-9]+$/.test(dataBooking1.departure_pnr),
    `Format PNR Pergi 6-karakter alfanumerik valid: ${dataBooking1.departure_pnr}`
  );
  assert(
    dataBooking1.return_pnr.length === 6 && /^[A-Z0-9]+$/.test(dataBooking1.return_pnr),
    `Format PNR Pulang 6-karakter alfanumerik valid: ${dataBooking1.return_pnr}`
  );

  // Check infant seat in database is NULL
  const infantPass = db.prepare(`
    SELECT bp.* FROM booking_passengers bp
    JOIN booking_segments bs ON bp.booking_segment_id = bs.id
    WHERE bs.booking_id = ? AND bp.pax_type = 'INFANT'
    LIMIT 1
  `).get(dataBooking1.booking_id);
  assert(
    infantPass && infantPass.seat_number === null,
    `Penumpang Bayi (INFANT) tidak mengambil alokasi kursi (seat_number = NULL)`
  );

  // -------------------------------------------------------------
  // TEST SUITE 2: Anti-Double-Booking (Segment Overlap Concurrency Lock)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Anti-Double-Booking (Segment Overlap Concurrency Lock) ---');

  // User A locks seat 12A on segment MDN -> TBI (Stop 1 -> Stop 3)
  const userAPayload = {
    trip_type: 'ONE_WAY',
    contact: {
      name: 'User A',
      email: 'usera@example.com',
      phone: '081299990001',
    },
    departure_segment: {
      schedule_id: outboundSched.schedule_id,
      origin_station_id: mdnStation.id,
      destination_station_id: tbiStation.id, // MDN -> TBI
      wagon_class: 'EXECUTIVE',
      subclass: outFare.subclass,
      seats: [{ wagon_id: outWagon.id, seat_number: '2A' }],
    },
    passengers: [
      { name: 'User A Passenger', identity_number: '1271021200010001', type: 'ADULT' },
    ],
  };

  const resUserA = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userAPayload),
  });
  const dataUserA = await resUserA.json();
  assert(resUserA.status === 201, `User A berhasil mengunci kursi 2A pada segmen MDN -> TBI (Status PENDING 15 Menit)`);

  // User B attempts to lock seat 2A on overlapping segment MDN -> RAP (Stop 1 -> Stop 5)
  const userBPayload = {
    trip_type: 'ONE_WAY',
    contact: {
      name: 'User B',
      email: 'userb@example.com',
      phone: '081299990002',
    },
    departure_segment: {
      schedule_id: outboundSched.schedule_id,
      origin_station_id: mdnStation.id,
      destination_station_id: rapStation.id, // MDN -> RAP (overlaps with MDN -> TBI!)
      wagon_class: 'EXECUTIVE',
      subclass: outFare.subclass,
      seats: [{ wagon_id: outWagon.id, seat_number: '2A' }],
    },
    passengers: [
      { name: 'User B Passenger', identity_number: '1271021200020002', type: 'ADULT' },
    ],
  };

  const resUserBConflict = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userBPayload),
  });
  const dataUserBConflict = await resUserBConflict.json();
  assert(
    resUserBConflict.status === 409,
    `Anti Double-Booking Aktif: Permintaan User B ditolak dengan HTTP 409 Conflict (${dataUserBConflict.error})`
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: Auto-Release Expired Locks
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Auto-Release Expired Locks (Kursi Kembali Tersedia) ---');

  // Simulate User A's lock expiration by updating locked_until to past
  db.prepare(`
    UPDATE bookings SET locked_until = datetime('now', '-5 minutes')
    WHERE id = ?
  `).run(dataUserA.booking_id);

  // User B retries booking seat 2A on MDN -> RAP
  const resUserBSuccess = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userBPayload),
  });
  const dataUserBSuccess = await resUserBSuccess.json();
  assert(
    resUserBSuccess.status === 201,
    `Auto-Release Berhasil: Kursi 2A yang expired berhasil dikunci oleh User B (Invoice: ${dataUserBSuccess.invoice_number})`
  );

  // Check User A booking status in DB is now EXPIRED
  const checkUserABooking = db.prepare(`SELECT payment_status FROM bookings WHERE id = ?`).get(dataUserA.booking_id);
  assert(
    checkUserABooking.payment_status === 'EXPIRED',
    `Status booking User A otomatis berubah menjadi EXPIRED`
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Payment Settlement & Ticket Refund by Ticketing Officer
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Pelunasan Pembayaran & Refund Tiket oleh Kasir Loket ---');

  const invoiceB = dataUserBSuccess.invoice_number;

  // 4a. Settle Payment
  const resPay = await fetch(`${BASE_URL}/api/bookings/${invoiceB}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_method: 'CASH_COUNTER' }),
  });
  const dataPay = await resPay.json();
  assert(resPay.status === 200 && dataPay.payment_status === 'PAID', `Pelunasan pembayaran tunai loket berhasil (Status PAID)`);

  // Verify seat status in Seat Map is BOOKED
  const resSeatMapBooked = await fetch(
    `${BASE_URL}/api/schedules/${outboundSched.schedule_id}/seat-map?origin_station_id=${mdnStation.id}&destination_station_id=${rapStation.id}&wagon_class=EXECUTIVE`
  );
  const dataSeatMapBooked = await resSeatMapBooked.json();
  const wagonObj = dataSeatMapBooked.wagons?.find(w => w.id === outWagon.id);
  const seat2A = wagonObj?.seat_rows.flatMap(r => r.all_seats).find(s => s.seat_number === '2A');
  assert(seat2A?.status === 'BOOKED', `Kursi 2A di Seat Map kini berstatus BOOKED`);

  // 4b. Customer tries to refund -> Forbidden (403)
  const resCustRefund = await fetch(`${BASE_URL}/api/bookings/${invoiceB}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: customerACookie,
    },
    body: JSON.stringify({ reason: 'Dibatalkan pelanggan' }),
  });
  assert(resCustRefund.status === 403, `Pelanggan biasa dilarang memproses refund langsung (HTTP 403 Forbidden)`);

  // 4c. Ticketing Officer processes Refund
  const resRefund = await fetch(`${BASE_URL}/api/bookings/${invoiceB}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ticketingCookie,
    },
    body: JSON.stringify({ reason: 'Pembatalan tiket oleh penumpang di loket stasiun' }),
  });
  const dataRefund = await resRefund.json();
  assert(
    resRefund.status === 200 && dataRefund.payment_status === 'REFUNDED',
    `Kasir Loket (TICKETING_OFFICER) berhasil memproses refund tiket (Status REFUNDED)`
  );

  // 4d. Verify seat 2A is RELEASED back to AVAILABLE in Seat Map
  const resSeatMapReleased = await fetch(
    `${BASE_URL}/api/schedules/${outboundSched.schedule_id}/seat-map?origin_station_id=${mdnStation.id}&destination_station_id=${rapStation.id}&wagon_class=EXECUTIVE`
  );
  const dataSeatMapReleased = await resSeatMapReleased.json();
  const wagonObjRel = dataSeatMapReleased.wagons?.find(w => w.id === outWagon.id);
  const seat2ARel = wagonObjRel?.seat_rows.flatMap(r => r.all_seats).find(s => s.seat_number === '2A');
  assert(
    seat2ARel?.status === 'AVAILABLE',
    `Setelah REFUND, kursi 2A otomatis kembali AVAILABLE di Seat Map untuk dipesan penumpang lain!`
  );

  // -------------------------------------------------------------
  // TEST SUITE 5: Audit Logging Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Verifikasi Audit Logging Transaksi ---');

  const auditCreated = db.prepare(`SELECT * FROM audit_logs WHERE action = 'BOOKING_CREATE' ORDER BY created_at DESC LIMIT 1`).get();
  const auditPaid = db.prepare(`SELECT * FROM audit_logs WHERE action = 'BOOKING_PAY' ORDER BY created_at DESC LIMIT 1`).get();
  const auditRefunded = db.prepare(`SELECT * FROM audit_logs WHERE action = 'BOOKING_REFUND' ORDER BY created_at DESC LIMIT 1`).get();

  assert(Boolean(auditCreated), `Audit log BOOKING_CREATE tercatat`);
  assert(Boolean(auditPaid), `Audit log BOOKING_PAY tercatat`);
  assert(Boolean(auditRefunded), `Audit log BOOKING_REFUND tercatat lengkap`);

  // -------------------------------------------------------------
  // TEST SUITE 6: Ticketing POS Bookings API
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Ticketing POS Bookings API & Filter ---');

  const resPos = await fetch(`${BASE_URL}/api/ticketing/bookings?search=${invoiceB}`, {
    headers: { Cookie: ticketingCookie },
  });
  const dataPos = await resPos.json();
  assert(
    resPos.status === 200 && dataPos.bookings?.length === 1,
    `Kasir loket dapat menemukan tiket berdasarkan nomor invoice (${invoiceB})`
  );

  const resPosFilter = await fetch(`${BASE_URL}/api/ticketing/bookings?status=REFUNDED`, {
    headers: { Cookie: ticketingCookie },
  });
  const dataPosFilter = await resPosFilter.json();
  assert(
    resPosFilter.status === 200 && dataPosFilter.bookings?.some(b => b.invoice_number === invoiceB),
    `Filter status REFUNDED di modul kasir menampilkan pesanan yang di-refund`
  );

  console.log('\n======================================================');
  console.log(`🏁 HASIL PENGUJIAN FASE 4: ${passed} PASS, ${failed} FAIL`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
