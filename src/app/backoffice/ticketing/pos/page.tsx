import React from 'react';
import { getDatabase } from '@/lib/db';
import { releaseExpiredBookings } from '@/lib/booking/generator';
import TicketingPosClient, { BookingRow } from './TicketingPosClient';

export const dynamic = 'force-dynamic';

export default function TicketingPosPage() {
  const db = getDatabase();
  releaseExpiredBookings(db);

  const rawBookings = db
    .prepare(
      `
      SELECT 
        b.id,
        b.invoice_number,
        b.user_id,
        b.trip_type,
        b.total_amount,
        b.payment_status,
        b.locked_until,
        b.created_at,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        (SELECT pnr_code FROM booking_segments WHERE booking_id = b.id ORDER BY segment_type ASC LIMIT 1) as primary_pnr,
        (SELECT COUNT(*) FROM booking_passengers bp JOIN booking_segments bs ON bp.booking_segment_id = bs.id WHERE bs.booking_id = b.id) as passenger_count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 100
    `
    )
    .all() as unknown as BookingRow[];

  return <TicketingPosClient initialBookings={rawBookings} />;
}
