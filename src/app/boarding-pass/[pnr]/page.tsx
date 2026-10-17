import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Train,
  Bus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  ChevronLeft,
  QrCode,
  MapPin,
  Calendar,
} from 'lucide-react';
import { getDatabase } from '@/lib/db';
import { signBoardingData, generateQRCodeSVG } from '@/lib/boarding/qr-crypto';
import PrintButton from '@/app/tickets/[pnr]/PrintButton';
import { CopyTokenButton } from './CopyTokenButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ pnr: string }>;
}

interface PassengerPass {
  id: number;
  full_name: string;
  identity_number: string;
  pax_type: string;
  wagon_id?: number | null;
  seat_number: string | null;
  boarding_status: string;
  qr_signature: string | null;
  checked_in_at: string | null;
  boarded_at: string | null;
  wagon_code?: string;
  wagon_class?: string;
  payload: string;
  svgString: string;
}

export default async function BoardingPassPage({ params }: Props) {
  const { pnr } = await params;
  if (!pnr) return notFound();

  const cleanPnr = pnr.trim().toUpperCase();
  const db = getDatabase();

  // 1. Fetch Segment, Schedule & Route Details
  const segment = db.prepare(`
    SELECT 
      bs.id as segment_id,
      bs.pnr_code,
      bs.segment_type,
      bs.schedule_id,
      bs.booking_id,
      b.invoice_number,
      b.payment_status,
      b.trip_type,
      s.departure_date,
      s.base_departure_time,
      s.gate_info,
      f.name as fleet_name,
      f.code as fleet_code,
      f.type as fleet_type,
      r.route_name,
      so.name as origin_station_name,
      so.code as origin_station_code,
      so.city as origin_city,
      sd.name as dest_station_name,
      sd.code as dest_station_code,
      sd.city as dest_city,
      (
        SELECT time(s.base_departure_time, '+' || rso.departure_offset_minutes || ' minutes')
        FROM route_stops rso
        WHERE rso.route_id = s.route_id AND rso.station_id = bs.origin_station_id
      ) as origin_departure_time,
      (
        SELECT time(s.base_departure_time, '+' || rsd.arrival_offset_minutes || ' minutes')
        FROM route_stops rsd
        WHERE rsd.route_id = s.route_id AND rsd.station_id = bs.destination_station_id
      ) as dest_arrival_time
    FROM booking_segments bs
    JOIN bookings b ON bs.booking_id = b.id
    JOIN schedules s ON bs.schedule_id = s.id
    JOIN routes r ON s.route_id = r.id
    JOIN fleets f ON r.fleet_id = f.id
    JOIN stations so ON bs.origin_station_id = so.id
    JOIN stations sd ON bs.destination_station_id = sd.id
    WHERE bs.pnr_code = ?
  `).get(cleanPnr) as Record<string, any> | undefined;

  if (!segment) {
    return notFound();
  }

  // 2. Fetch Passengers
  const rawPassengers = db.prepare(`
    SELECT 
      bp.id,
      bp.full_name,
      bp.identity_number,
      bp.pax_type,
      bp.wagon_id,
      bp.seat_number,
      bp.boarding_status,
      bp.qr_signature,
      bp.checked_in_at,
      bp.boarded_at,
      w.wagon_code,
      w.class as wagon_class
    FROM booking_passengers bp
    LEFT JOIN wagons w ON bp.wagon_id = w.id
    WHERE bp.booking_segment_id = ?
    ORDER BY bp.id ASC
  `).all(segment.segment_id) as Array<Record<string, any>>;

  // 3. For each passenger, ensure signature and generate SVG
  const updateSigStmt = db.prepare(`
    UPDATE booking_passengers
    SET boarding_status = 'CHECKED_IN',
        checked_in_at = COALESCE(checked_in_at, datetime('now')),
        qr_signature = ?
    WHERE id = ?
  `);

  const passengersWithQR: PassengerPass[] = await Promise.all(
    rawPassengers.map(async (pax: any): Promise<PassengerPass> => {
      const { signature, payload } = signBoardingData(
        cleanPnr,
        pax.id,
        segment.schedule_id,
        pax.seat_number
      );

      // If not yet signed or status was BOOKED, set to CHECKED_IN
      if (!pax.qr_signature || pax.boarding_status === 'BOOKED') {
        updateSigStmt.run(signature, pax.id);
        pax.boarding_status = 'CHECKED_IN';
        pax.qr_signature = signature;
      }

      const svgString = await generateQRCodeSVG(payload);

      return {
        ...pax,
        payload,
        svgString,
      };
    })
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans print:bg-white text-slate-900 pb-12">
      {/* Top Action Bar (Hidden when printing) */}
      <header className="bg-slate-950 text-white py-3.5 px-4 sm:px-6 lg:px-8 border-b border-slate-800 print:hidden sticky top-0 z-40 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/tickets/${cleanPnr}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali ke E-Ticket</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-sky-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>HMAC-SHA256 Encrypted Pass</span>
            </span>

            <PrintButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Printable Notice */}
        <div className="text-center print:hidden space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Official E-Boarding Pass
          </h1>
          <p className="text-xs text-slate-500">
            Tunjukkan QR Code berikut di Gate Keberangkatan Stasiun / Terminal kepada Petugas Boarding.
          </p>
        </div>

        {/* Boarding Passes for each passenger */}
        <div className="space-y-6">
          {passengersWithQR.map((pax, idx) => {
            const isBoarded = pax.boarding_status === 'BOARDED';

            return (
              <div
                key={pax.id}
                className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden print:border-slate-400 print:shadow-none break-inside-avoid"
              >
                {/* Header Strip */}
                <div className="bg-slate-900 text-white p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white text-xs">
                      {segment.fleet_type === 'TRAIN' ? (
                        <Train className="w-4 h-4" />
                      ) : (
                        <Bus className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm tracking-tight">
                        {segment.fleet_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {segment.fleet_code} &bull; {pax.wagon_class || 'EKSEKUTIF'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        Kode Booking (PNR)
                      </div>
                      <div className="text-base font-mono font-extrabold text-amber-400">
                        {cleanPnr}
                      </div>
                    </div>

                    <div className="pl-3 border-l border-slate-800">
                      {isBoarded ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> BOARDED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CHECKED IN
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Pass Body (Grid: Left Details, Right QR) */}
                <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* Left Column: Passenger & Journey Manifest */}
                  <div className="md:col-span-8 p-5 sm:p-6 space-y-5">
                    {/* Passenger Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Nama Penumpang
                        </div>
                        <div className="text-base font-extrabold text-slate-900 mt-0.5">
                          {pax.full_name}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          NIK/NISN: {pax.identity_number}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Kategori Penumpang
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-700">
                            {pax.pax_type}
                          </span>
                          <span className="text-xs text-slate-500">
                            {pax.pax_type === 'ADULT' ? 'Dewasa' : 'Bayi (Pangku)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Berangkat</div>
                        <div className="text-base font-mono font-extrabold text-slate-900">
                          {segment.origin_departure_time || segment.base_departure_time} WIB
                        </div>
                        <div className="text-xs font-bold text-sky-700">
                          {segment.origin_station_code} ({segment.origin_station_name})
                        </div>
                        <div className="text-[10px] text-slate-500">{segment.departure_date}</div>
                      </div>

                      <div className="flex flex-col items-center px-2">
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                        <span className="text-[9px] text-emerald-700 font-bold">Langsung</span>
                      </div>

                      <div className="space-y-0.5 text-right">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Tiba</div>
                        <div className="text-base font-mono font-extrabold text-slate-900">
                          {segment.dest_arrival_time} WIB
                        </div>
                        <div className="text-xs font-bold text-sky-700">
                          {segment.dest_station_code} ({segment.dest_station_name})
                        </div>
                        <div className="text-[10px] text-slate-500">{segment.departure_date}</div>
                      </div>
                    </div>

                    {/* Big Key Elements: Gate, Wagon, Seat */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                          Gate / Peron
                        </div>
                        <div className="text-xl sm:text-2xl font-mono font-extrabold text-amber-950 mt-0.5">
                          {segment.gate_info || 'PERON 1'}
                        </div>
                      </div>

                      <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                        <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                          Nomor Gerbong
                        </div>
                        <div className="text-xl sm:text-2xl font-mono font-extrabold text-sky-950 mt-0.5">
                          {pax.wagon_code || 'EKS-1'}
                        </div>
                      </div>

                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">
                          Nomor Kursi
                        </div>
                        <div className="text-xl sm:text-2xl font-mono font-extrabold text-orange-600 mt-0.5">
                          {pax.seat_number || 'PANGKU'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Encrypted QR Code & Verification */}
                  <div className="md:col-span-4 p-5 sm:p-6 bg-slate-50/50 flex flex-col items-center justify-between text-center space-y-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center gap-1 mb-2">
                        <QrCode className="w-3.5 h-3.5 text-sky-600" />
                        <span>Boarding Pass QR</span>
                      </div>

                      {/* Offline Vector SVG QR Code */}
                      <div className="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm inline-block">
                        <div
                          className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: pax.svgString }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 w-full">
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-full px-2">
                        SIG: {pax.qr_signature ? `${pax.qr_signature.substring(0, 16)}...` : '-'}
                      </div>

                      <div className="print:hidden">
                        <CopyTokenButton token={pax.payload} />
                      </div>

                      <div className="text-[10px] text-slate-500 leading-tight">
                        Pindai QR ini di gate masuk stasiun sebelum waktu boarding ditutup (10 menit sebelum berangkat).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Perforated Note */}
                <div className="p-3 bg-slate-50 border-t border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Diverifikasi resmi oleh Sistem CRS SMK TraveLoka (Biro Perjalanan Wisata SMK ULP).</span>
                  </div>
                  <div className="font-mono text-[10px]">
                    Invoice: {segment.invoice_number}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
