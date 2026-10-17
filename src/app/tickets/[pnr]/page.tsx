import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Train,
  Bus,
  ArrowRight,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  Ticket,
} from 'lucide-react';
import { getDatabase } from '@/lib/db';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';
import { formatIDR, addMinutesToTime, formatDurationMinutes } from '@/lib/utils/travel';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export default async function TicketPage(props: { params: Promise<{ pnr: string }> }) {
  const { pnr } = await props.params;
  const db = getDatabase();

  const segment = db.prepare(`
    SELECT bs.*, b.invoice_number, b.payment_status, b.total_amount, b.created_at as booking_created_at,
           u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
           s.departure_date, s.base_departure_time, s.gate_info,
           r.route_name, r.direction,
           f.name as fleet_name, f.code as fleet_code, f.type as fleet_type,
           s1.code as origin_code, s1.name as origin_name, s1.city as origin_city,
           s2.code as dest_code, s2.name as dest_name, s2.city as dest_city,
           rso.departure_offset_minutes as origin_dep_offset,
           rsd.arrival_offset_minutes as dest_arr_offset
    FROM booking_segments bs
    JOIN bookings b ON bs.booking_id = b.id
    JOIN users u ON b.user_id = u.id
    JOIN schedules s ON bs.schedule_id = s.id
    JOIN routes r ON s.route_id = r.id
    JOIN fleets f ON r.fleet_id = f.id
    JOIN stations s1 ON bs.origin_station_id = s1.id
    JOIN stations s2 ON bs.destination_station_id = s2.id
    JOIN route_stops rso ON s.route_id = rso.route_id AND bs.origin_station_id = rso.station_id
    JOIN route_stops rsd ON s.route_id = rsd.route_id AND bs.destination_station_id = rsd.station_id
    WHERE UPPER(bs.pnr_code) = ?
  `).get(pnr.toUpperCase()) as any;

  if (!segment) {
    notFound();
  }

  const passengers = db.prepare(`
    SELECT bp.*, w.wagon_code, w.class as wagon_class
    FROM booking_passengers bp
    LEFT JOIN wagons w ON bp.wagon_id = w.id
    WHERE bp.booking_segment_id = ?
    ORDER BY bp.id ASC
  `).all(segment.id) as any[];

  const origDep = addMinutesToTime(segment.base_departure_time, segment.origin_dep_offset);
  const destArr = addMinutesToTime(segment.base_departure_time, segment.dest_arr_offset);
  const durationMinutes = Math.max(1, segment.dest_arr_offset - segment.origin_dep_offset);
  const durationFormatted = formatDurationMinutes(durationMinutes);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      <div className="print:hidden">
        <StorefrontNavbar />
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Action Controls (Hidden when printing) */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/my-bookings"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            &larr; Riwayat Pesanan Saya
          </Link>

          <div className="flex items-center gap-2">
            <PrintButton />
            <Link
              href={`/check-in?pnr=${segment.pnr_code}`}
              className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all"
            >
              Lanjut ke Online Check-In &rarr;
            </Link>
          </div>
        </div>

        {/* Official E-Ticket Card */}
        <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-xl overflow-hidden print:shadow-none print:border print:rounded-none">
          {/* Header Strip */}
          <div className="bg-slate-900 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-sky-600">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  SMK ULP Travel & CRS Enterprise
                </span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-1">E-TICKET RESMI PERJALANAN</h1>
              <div className="text-xs text-slate-400 mt-0.5">
                Dokumen Reservasi Sah &bull; Simpan / Cetak untuk Ditunjukkan Saat Boarding
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-black tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400 inline-block">
                STATUS: {segment.payment_status}
              </span>
              <div className="text-[11px] font-mono text-slate-300 mt-1">
                No. Invoice: <strong>{segment.invoice_number}</strong>
              </div>
            </div>
          </div>

          {/* Large PNR Banner */}
          <div className="bg-sky-50 border-b border-sky-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                Kode Booking Resmi (PNR)
              </span>
              <div className="font-mono font-black text-3xl tracking-widest text-sky-900">
                {segment.pnr_code}
              </div>
              <span className="text-[11px] text-sky-700">
                Gunakan kode ini untuk Check-In mandiri atau verifikasi di loket stasiun
              </span>
            </div>

            <div className="text-left sm:text-right text-xs">
              <div className="text-slate-500">Pemesan:</div>
              <div className="font-bold text-slate-900 text-sm">{segment.customer_name}</div>
              <div className="font-mono text-slate-600">{segment.customer_phone}</div>
            </div>
          </div>

          {/* Trip Details */}
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  {segment.fleet_type === 'TRAIN' ? <Train className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">
                    {segment.fleet_name} ({segment.fleet_code})
                  </div>
                  <div className="text-xs text-slate-500">{segment.route_name}</div>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs">
                <div>
                  Tanggal:{' '}
                  <strong className="font-mono text-slate-900">{segment.departure_date}</strong>
                </div>
                <div>
                  Gate / Peron:{' '}
                  <strong className="text-sky-700 font-bold">{segment.gate_info || 'Peron Utama'}</strong>
                </div>
              </div>
            </div>

            {/* Time and Stations Route */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-center p-4 border border-slate-200 rounded-xl">
              <div>
                <div className="font-mono text-2xl font-black text-slate-900">
                  {origDep.time} <span className="text-xs font-normal text-slate-500">WIB</span>
                </div>
                <div className="font-mono font-bold text-sky-700 mt-1">{segment.origin_code}</div>
                <div className="text-xs text-slate-600 font-medium">{segment.origin_name}</div>
                <div className="text-[11px] text-slate-400">{segment.origin_city}</div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[11px] font-mono font-bold text-slate-500">{durationFormatted}</span>
                <div className="w-24 border-t-2 border-slate-300 my-1 relative">
                  <div className="w-2 h-2 rounded-full bg-sky-600 absolute right-0 -top-1" />
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                  Langsung / Tanpa Transit
                </span>
              </div>

              <div>
                <div className="font-mono text-2xl font-black text-slate-900">
                  {destArr.time}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    WIB {destArr.daysAdded > 0 ? '(+1h)' : ''}
                  </span>
                </div>
                <div className="font-mono font-bold text-sky-700 mt-1">{segment.dest_code}</div>
                <div className="text-xs text-slate-600 font-medium">{segment.dest_name}</div>
                <div className="text-[11px] text-slate-400">{segment.dest_city}</div>
              </div>
            </div>

            {/* Passenger Manifest Table */}
            <div>
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                Daftar Penumpang & Alokasi Kursi ({passengers.length} Penumpang)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">No.</th>
                      <th className="px-4 py-2.5">Nama Penumpang</th>
                      <th className="px-4 py-2.5">No. Identitas (NIK/NISN)</th>
                      <th className="px-4 py-2.5">Kategori</th>
                      <th className="px-4 py-2.5 text-right">Gerbong / Kursi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {passengers.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{p.full_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{p.identity_number}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.pax_type === 'ADULT'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {p.pax_type === 'ADULT' ? 'DEWASA' : 'BAYI (PANGKU)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.seat_number ? (
                            <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-1 rounded border border-sky-200 text-xs">
                              {p.wagon_code} - Kursi {p.seat_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Tanpa Kursi (Rp 0)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Action to Online Check-In */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-950">Siap untuk Berangkat?</div>
                  <div className="text-[11px] text-sky-700">Lakukan Check-In Mandiri untuk mendapatkan QR Boarding Pass resmi.</div>
                </div>
              </div>

              <Link
                href={`/check-in?pnr=${segment.pnr_code}`}
                className="px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all whitespace-nowrap"
              >
                Lanjut ke Online Check-In &rarr;
              </Link>
            </div>

            {/* Security Barcode & Notes */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div className="space-y-1">
                <div>&bull; Penumpang wajib tiba di stasiun/terminal paling lambat 30 menit sebelum keberangkatan.</div>
                <div>&bull; Tunjukkan dokumen identitas asli yang sesuai saat boarding gate.</div>
                <div>&bull; E-Ticket ini sah dan diterbitkan secara digital oleh Sistem Enterprise CRS SMK.</div>
              </div>

              <div className="font-mono text-center sm:text-right shrink-0">
                <div className="text-[10px] uppercase text-slate-400">Security Signature Hash</div>
                <div className="font-bold text-slate-700">SHA256-{segment.pnr_code}-AUTH-OK</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
