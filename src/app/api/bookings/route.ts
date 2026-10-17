import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { generatePNR, generateInvoiceNumber, releaseExpiredBookings } from '@/lib/booking/generator';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

const BookingSeatSchema = z.object({
  wagon_id: z.number().int().positive(),
  seat_number: z.string().trim().min(2),
});

const SegmentBookingSchema = z.object({
  schedule_id: z.number().int().positive(),
  origin_station_id: z.number().int().positive(),
  destination_station_id: z.number().int().positive(),
  wagon_class: z.enum(['EXECUTIVE', 'BUSINESS', 'ECONOMY']),
  subclass: z.string().trim().min(1),
  seats: z.array(BookingSeatSchema),
});

const PassengerInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama penumpang minimal 2 karakter'),
  identity_number: z.string().trim().min(6, 'Nomor identitas minimal 6 karakter'),
  type: z.enum(['ADULT', 'INFANT']),
});

const CreateBookingSchema = z.object({
  trip_type: z.enum(['ONE_WAY', 'ROUND_TRIP']),
  contact: z.object({
    name: z.string().trim().min(2),
    email: z.string().email(),
    phone: z.string().trim().min(8),
  }),
  departure_segment: SegmentBookingSchema,
  return_segment: SegmentBookingSchema.optional(),
  passengers: z.array(PassengerInputSchema).min(1, 'Minimal 1 penumpang'),
});

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();

    // 1. Auto-release expired locks first
    releaseExpiredBookings(db);

    const body = await request.json();
    const parse = CreateBookingSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { trip_type, contact, departure_segment, return_segment, passengers } = parse.data;

    // Validate Passenger Counts
    const adultPassengers = passengers.filter((p) => p.type === 'ADULT');
    const infantPassengers = passengers.filter((p) => p.type === 'INFANT');

    if (adultPassengers.length < 1) {
      return NextResponse.json({ error: 'Minimal harus ada 1 penumpang dewasa.' }, { status: 400 });
    }

    if (infantPassengers.length > adultPassengers.length) {
      return NextResponse.json(
        { error: 'Jumlah penumpang bayi tidak boleh melebihi penumpang dewasa.' },
        { status: 400 }
      );
    }

    if (departure_segment.seats.length !== adultPassengers.length) {
      return NextResponse.json(
        { error: `Jumlah kursi pergi yang dipilih (${departure_segment.seats.length}) harus sama dengan jumlah penumpang dewasa (${adultPassengers.length}).` },
        { status: 400 }
      );
    }

    if (trip_type === 'ROUND_TRIP') {
      if (!return_segment) {
        return NextResponse.json({ error: 'Segmen kepulangan wajib disertakan untuk tiket Pulang-Pergi.' }, { status: 400 });
      }
      if (return_segment.seats.length !== adultPassengers.length) {
        return NextResponse.json(
          { error: `Jumlah kursi pulang yang dipilih (${return_segment.seats.length}) harus sama dengan jumlah penumpang dewasa (${adultPassengers.length}).` },
          { status: 400 }
        );
      }
    }

    // 2. Resolve User ID
    const loggedInUser = await getCurrentUser();
    let bookingUserId = loggedInUser?.id;

    if (!bookingUserId) {
      // Find or create customer account
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(contact.email) as { id: number } | undefined;
      if (existingUser) {
        bookingUserId = existingUser.id;
      } else {
        const dummyHash = '$2a$10$wT3wYwVvF4W4fFmG8z9qU.G2p9fL0vB7XhC9n5N8kR4eQ1sY8uI6a'; // default hash
        const insertUser = db.prepare(`
          INSERT INTO users (name, email, password_hash, identity_number, role, phone)
          VALUES (?, ?, ?, ?, 'CUSTOMER', ?)
        `);
        const uRes = insertUser.run(contact.name, contact.email, dummyHash, adultPassengers[0].identity_number, contact.phone);
        bookingUserId = Number(uRes.lastInsertRowid);
      }
    }

    // 3. Strict Server-Side Pricing Calculation
    // Departure Fare
    const depFare = db.prepare(`
      SELECT price FROM schedule_fares
      WHERE schedule_id = ?
        AND origin_station_id = ?
        AND destination_station_id = ?
        AND wagon_class = ?
        AND subclass = ?
    `).get(
      departure_segment.schedule_id,
      departure_segment.origin_station_id,
      departure_segment.destination_station_id,
      departure_segment.wagon_class,
      departure_segment.subclass
    ) as { price: number } | undefined;

    if (!depFare) {
      return NextResponse.json({ error: 'Tarif segmen keberangkatan tidak ditemukan dalam sistem.' }, { status: 400 });
    }

    let calculatedTotal = depFare.price * adultPassengers.length;
    let retFarePrice = 0;

    if (trip_type === 'ROUND_TRIP' && return_segment) {
      const retFare = db.prepare(`
        SELECT price FROM schedule_fares
        WHERE schedule_id = ?
          AND origin_station_id = ?
          AND destination_station_id = ?
          AND wagon_class = ?
          AND subclass = ?
      `).get(
        return_segment.schedule_id,
        return_segment.origin_station_id,
        return_segment.destination_station_id,
        return_segment.wagon_class,
        return_segment.subclass
      ) as { price: number } | undefined;

      if (!retFare) {
        return NextResponse.json({ error: 'Tarif segmen kepulangan tidak ditemukan dalam sistem.' }, { status: 400 });
      }
      retFarePrice = retFare.price;
      calculatedTotal += retFarePrice * adultPassengers.length;
    }

    // 4. ATOMIC DATABASE TRANSACTION (Anti-Race Condition & Concurrency Locking)
    db.exec('BEGIN IMMEDIATE');

    try {
      // A. Check Departure Segment Stop Orders
      const depSched = db.prepare('SELECT route_id FROM schedules WHERE id = ?').get(departure_segment.schedule_id) as { route_id: number };
      const depOrigStop = db.prepare('SELECT stop_order FROM route_stops WHERE route_id = ? AND station_id = ?').get(depSched.route_id, departure_segment.origin_station_id) as { stop_order: number };
      const depDestStop = db.prepare('SELECT stop_order FROM route_stops WHERE route_id = ? AND station_id = ?').get(depSched.route_id, departure_segment.destination_station_id) as { stop_order: number };

      if (!depOrigStop || !depDestStop || depOrigStop.stop_order >= depDestStop.stop_order) {
        db.exec('ROLLBACK');
        return NextResponse.json({ error: 'Urutan rute segmen keberangkatan tidak valid.' }, { status: 400 });
      }

      // Check Departure Seats Overlap Concurrency
      const checkSeatConflictStmt = db.prepare(`
        SELECT bp.seat_number, w.wagon_code
        FROM booking_passengers bp
        JOIN booking_segments bs ON bp.booking_segment_id = bs.id
        JOIN bookings b ON bs.booking_id = b.id
        JOIN wagons w ON bp.wagon_id = w.id
        JOIN schedules s ON bs.schedule_id = s.id
        JOIN route_stops rso ON s.route_id = rso.route_id AND bs.origin_station_id = rso.station_id
        JOIN route_stops rsd ON s.route_id = rsd.route_id AND bs.destination_station_id = rsd.station_id
        WHERE bs.schedule_id = ?
          AND bp.wagon_id = ?
          AND bp.seat_number = ?
          AND (b.payment_status = 'PAID' OR (b.payment_status = 'PENDING' AND b.locked_until > datetime('now')))
          AND rso.stop_order < ?
          AND ? < rsd.stop_order
      `);

      for (const st of departure_segment.seats) {
        const conflict = checkSeatConflictStmt.get(
          departure_segment.schedule_id,
          st.wagon_id,
          st.seat_number,
          depDestStop.stop_order,
          depOrigStop.stop_order
        ) as { seat_number: string; wagon_code: string } | undefined;

        if (conflict) {
          db.exec('ROLLBACK');
          return NextResponse.json(
            { error: `Kursi ${conflict.seat_number} pada gerbong ${conflict.wagon_code} baru saja dikunci/dipesan oleh penumpang lain. Silakan pilih kursi lain.` },
            { status: 409 }
          );
        }
      }

      // B. Check Return Segment Seats Overlap Concurrency (if ROUND_TRIP)
      let retOrigStop: { stop_order: number } | undefined;
      let retDestStop: { stop_order: number } | undefined;

      if (trip_type === 'ROUND_TRIP' && return_segment) {
        const retSched = db.prepare('SELECT route_id FROM schedules WHERE id = ?').get(return_segment.schedule_id) as { route_id: number };
        retOrigStop = db.prepare('SELECT stop_order FROM route_stops WHERE route_id = ? AND station_id = ?').get(retSched.route_id, return_segment.origin_station_id) as { stop_order: number };
        retDestStop = db.prepare('SELECT stop_order FROM route_stops WHERE route_id = ? AND station_id = ?').get(retSched.route_id, return_segment.destination_station_id) as { stop_order: number };

        if (!retOrigStop || !retDestStop || retOrigStop.stop_order >= retDestStop.stop_order) {
          db.exec('ROLLBACK');
          return NextResponse.json({ error: 'Urutan rute segmen kepulangan tidak valid.' }, { status: 400 });
        }

        for (const st of return_segment.seats) {
          const conflict = checkSeatConflictStmt.get(
            return_segment.schedule_id,
            st.wagon_id,
            st.seat_number,
            retDestStop.stop_order,
            retOrigStop.stop_order
          ) as { seat_number: string; wagon_code: string } | undefined;

          if (conflict) {
            db.exec('ROLLBACK');
            return NextResponse.json(
              { error: `Kursi kepulangan ${conflict.seat_number} pada gerbong ${conflict.wagon_code} baru saja dikunci/dipesan oleh penumpang lain. Silakan pilih kursi lain.` },
              { status: 409 }
            );
          }
        }
      }

      // C. Generate Invoice & PNRs
      const invoiceNumber = generateInvoiceNumber(db);
      const depPnr = generatePNR(db);
      const retPnr = trip_type === 'ROUND_TRIP' ? generatePNR(db) : null;

      // D. Insert Booking (with 15-minute lock expiration)
      const insertBooking = db.prepare(`
        INSERT INTO bookings (invoice_number, user_id, trip_type, total_amount, payment_status, locked_until)
        VALUES (?, ?, ?, ?, 'PENDING', datetime('now', '+15 minutes'))
      `);
      const bRes = insertBooking.run(invoiceNumber, bookingUserId, trip_type, calculatedTotal);
      const newBookingId = Number(bRes.lastInsertRowid);

      // Query locked_until
      const bookingRow = db.prepare('SELECT locked_until FROM bookings WHERE id = ?').get(newBookingId) as { locked_until: string };

      // E. Insert Departure Segment
      const insertSeg = db.prepare(`
        INSERT INTO booking_segments (booking_id, pnr_code, segment_type, schedule_id, origin_station_id, destination_station_id)
        VALUES (?, ?, 'DEPARTURE', ?, ?, ?)
      `);
      const depSegRes = insertSeg.run(
        newBookingId,
        depPnr,
        departure_segment.schedule_id,
        departure_segment.origin_station_id,
        departure_segment.destination_station_id
      );
      const depSegId = Number(depSegRes.lastInsertRowid);

      // Insert Departure Passengers
      const insertPax = db.prepare(`
        INSERT INTO booking_passengers (booking_segment_id, full_name, identity_number, pax_type, wagon_id, seat_number, boarding_status)
        VALUES (?, ?, ?, ?, ?, ?, 'BOOKED')
      `);

      let adultSeatIdx = 0;
      for (const pax of passengers) {
        if (pax.type === 'ADULT') {
          const seat = departure_segment.seats[adultSeatIdx];
          insertPax.run(depSegId, pax.name, pax.identity_number, 'ADULT', seat.wagon_id, seat.seat_number);
          adultSeatIdx++;
        } else {
          // Infant: no wagon, no seat
          insertPax.run(depSegId, pax.name, pax.identity_number, 'INFANT', null, null);
        }
      }

      // F. Insert Return Segment (if ROUND_TRIP)
      if (trip_type === 'ROUND_TRIP' && return_segment && retPnr) {
        const retSegRes = insertSeg.run(
          newBookingId,
          retPnr,
          return_segment.schedule_id,
          return_segment.origin_station_id,
          return_segment.destination_station_id
        );
        const retSegId = Number(retSegRes.lastInsertRowid);

        let retSeatIdx = 0;
        for (const pax of passengers) {
          if (pax.type === 'ADULT') {
            const seat = return_segment.seats[retSeatIdx];
            insertPax.run(retSegId, pax.name, pax.identity_number, 'ADULT', seat.wagon_id, seat.seat_number);
            retSeatIdx++;
          } else {
            insertPax.run(retSegId, pax.name, pax.identity_number, 'INFANT', null, null);
          }
        }
      }

      // COMMIT TRANSACTION
      db.exec('COMMIT');

      // G. Log Audit
      logAudit({
        userId: bookingUserId,
        action: 'BOOKING_CREATE',
        targetId: invoiceNumber,
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        details: {
          invoice: invoiceNumber,
          tripType: trip_type,
          departurePNR: depPnr,
          returnPNR: retPnr,
          totalAmount: calculatedTotal,
          passengersCount: passengers.length,
          lockedUntil: bookingRow.locked_until,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Kursi berhasil dikunci selama 15 menit. Silakan selesaikan pembayaran.',
          booking_id: newBookingId,
          invoice_number: invoiceNumber,
          departure_pnr: depPnr,
          return_pnr: retPnr,
          total_amount: calculatedTotal,
          locked_until: bookingRow.locked_until,
          redirect_url: `/checkout/${invoiceNumber}`,
        },
        { status: 201 }
      );
    } catch (txError) {
      db.exec('ROLLBACK');
      console.error('Transaction error in booking:', txError);
      return NextResponse.json({ error: 'Gagal mengunci kursi dan membuat pesanan.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem saat pemesanan.' }, { status: 500 });
  }
}
