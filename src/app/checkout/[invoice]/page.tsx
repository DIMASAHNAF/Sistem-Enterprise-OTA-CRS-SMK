import React from 'react';
import { notFound } from 'next/navigation';
import { getDatabase } from '@/lib/db';
import { releaseExpiredBookings } from '@/lib/booking/generator';
import CheckoutClient from './CheckoutClient';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage(props: { params: Promise<{ invoice: string }> }) {
  const { invoice } = await props.params;
  const db = getDatabase();

  releaseExpiredBookings(db);

  const booking = db.prepare(`
    SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.invoice_number = ?
  `).get(invoice) as any;

  if (!booking) {
    notFound();
  }

  const segments = db.prepare(`
    SELECT bs.*, s.departure_date, s.base_departure_time, s.gate_info,
           r.route_name, r.direction,
           f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
           s1.code as origin_code, s1.name as origin_name,
           s2.code as dest_code, s2.name as dest_name,
           rso.departure_offset_minutes as origin_dep_offset,
           rsd.arrival_offset_minutes as dest_arr_offset
    FROM booking_segments bs
    JOIN schedules s ON bs.schedule_id = s.id
    JOIN routes r ON s.route_id = r.id
    JOIN fleets f ON r.fleet_id = f.id
    JOIN stations s1 ON bs.origin_station_id = s1.id
    JOIN stations s2 ON bs.destination_station_id = s2.id
    JOIN route_stops rso ON s.route_id = rso.route_id AND bs.origin_station_id = rso.station_id
    JOIN route_stops rsd ON s.route_id = rsd.route_id AND bs.destination_station_id = rsd.station_id
    WHERE bs.booking_id = ?
    ORDER BY bs.id ASC
  `).all(booking.id) as any[];

  const passengersStmt = db.prepare(`
    SELECT bp.*, w.wagon_code, w.class as wagon_class
    FROM booking_passengers bp
    LEFT JOIN wagons w ON bp.wagon_id = w.id
    WHERE bp.booking_segment_id = ?
    ORDER BY bp.id ASC
  `);

  const enrichedSegments = segments.map((seg) => ({
    ...seg,
    passengers: passengersStmt.all(seg.id),
  }));

  const fullBooking = {
    ...booking,
    segments: enrichedSegments,
  };

  return <CheckoutClient initialBooking={fullBooking} />;
}
