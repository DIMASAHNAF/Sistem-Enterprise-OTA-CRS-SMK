'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Ticket,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Clock,
  Train,
  Bus,
  ShieldCheck,
  RefreshCw,
  QrCode,
  FileText,
} from 'lucide-react';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';

interface PassengerManifest {
  id: number;
  full_name: string;
  identity_number: string;
  pax_type: 'ADULT' | 'INFANT';
  wagon_id: number | null;
  seat_number: string | null;
  boarding_status: 'BOOKED' | 'CHECKED_IN' | 'BOARDED';
  qr_signature: string | null;
  checked_in_at: string | null;
  boarded_at: string | null;
  wagon_code?: string;
  wagon_class?: string;
}

interface SegmentData {
  segment_id: number;
  pnr_code: string;
  segment_type: string;
  schedule_id: number;
  booking_id: number;
  invoice_number: string;
  payment_status: 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';
  trip_type: string;
  booker_name: string;
  booker_email: string;
  departure_date: string;
  base_departure_time: string;
  origin_departure_time: string;
  dest_arrival_time: string;
  gate_info: string | null;
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  route_name: string;
  origin_station_name: string;
  origin_station_code: string;
  dest_station_name: string;
  dest_station_code: string;
}

export function CheckInClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pnrInput, setPnrInput] = useState(searchParams.get('pnr') || '');
  const [identityInput, setIdentityInput] = useState(searchParams.get('identity') || '');

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [segment, setSegment] = useState<SegmentData | null>(null);
  const [passengers, setPassengers] = useState<PassengerManifest[]>([]);

  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Auto search if query param pnr is present on initial load
  useEffect(() => {
    const initialPnr = searchParams.get('pnr');
    if (initialPnr) {
      handleSearch(initialPnr, searchParams.get('identity') || '');
    }
  }, [searchParams]);

  const handleSearch = async (targetPnr?: string, targetId?: string) => {
    const queryPnr = (targetPnr !== undefined ? targetPnr : pnrInput).trim().toUpperCase();
    const queryId = (targetId !== undefined ? targetId : identityInput).trim();

    if (!queryPnr || queryPnr.length < 5) {
      setSearchError('Masukkan 6-karakter Kode Booking (PNR) tiket Anda.');
      return;
    }

    setLoadingSearch(true);
    setSearchError(null);
    setCheckInError(null);
    setSegment(null);
    setPassengers([]);

    try {
      const url = new URL('/api/check-in', window.location.origin);
      url.searchParams.set('pnr', queryPnr);
      if (queryId) {
        url.searchParams.set('identity', queryId);
      }

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Tiket tidak ditemukan');
      }

      setSegment(data.segment);
      setPassengers(data.passengers || []);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Gagal mencari tiket.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleProcessCheckIn = async () => {
    if (!segment) return;
    setIsSubmittingCheckIn(true);
    setCheckInError(null);

    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pnr_code: segment.pnr_code,
          identity_number: identityInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses check-in');
      }

      // Success! Navigate to E-Boarding Pass
      router.push(data.redirect_url || `/boarding-pass/${segment.pnr_code}`);
    } catch (err: unknown) {
      setCheckInError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const isAllCheckedIn =
    passengers.length > 0 &&
    passengers.every((p) => p.boarding_status === 'CHECKED_IN' || p.boarding_status === 'BOARDED');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <StorefrontNavbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold mb-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>Sistem Check-In Mandiri Online & Terbit E-Boarding Pass</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Online Check-In & Boarding Pass
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Masukkan Kode Booking (PNR 6 karakter) tiket Anda untuk menerbitkan Boarding Pass resmi ber-tanda tangan digital HMAC-SHA256.
          </p>
        </div>

        {/* Lookup Card Form */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-xs space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-sky-600" />
                <span>Kode Booking (PNR 6 Karakter) *</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: B6MUKJ"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono font-black tracking-wider uppercase bg-slate-50/70 hover:bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition-all duration-200 shadow-2xs"
                />
                <Ticket className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>No. Identitas (NIK / NISN)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identityInput}
                  onChange={(e) => setIdentityInput(e.target.value)}
                  placeholder="10 atau 16 digit identitas"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold bg-slate-50/70 hover:bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition-all duration-200 shadow-2xs"
                />
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={loadingSearch}
                className="w-full h-11 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shadow-sky-600/20 cursor-pointer"
              >
                {loadingSearch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mencari...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Cari Tiket</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {searchError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {/* Found Booking Segment Card */}
        {segment && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in space-y-6">
            {/* Top Bar Status */}
            <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Kode Booking (PNR)
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800">
                    {segment.segment_type === 'DEPARTURE' ? 'SEGMEN PERGI' : 'SEGMEN PULANG'}
                  </span>
                </div>
                <div className="text-2xl font-mono font-extrabold text-amber-400 mt-0.5">
                  {segment.pnr_code}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs text-slate-400">Status Pembayaran Tiket</div>
                <div className="mt-0.5">
                  {segment.payment_status === 'PAID' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" /> LUNAS / TERKONFIRMASI
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Clock className="w-3.5 h-3.5" /> {segment.payment_status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Segment Journey Details */}
            <div className="p-6 pt-0 space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    {segment.fleet_type === 'TRAIN' ? (
                      <Train className="w-5 h-5" />
                    ) : (
                      <Bus className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {segment.fleet_name} ({segment.fleet_code})
                    </div>
                    <div className="text-xs text-slate-500">{segment.route_name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs text-slate-400">Keberangkatan</div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {segment.origin_departure_time || segment.base_departure_time} WIB
                    </div>
                    <div className="text-xs text-sky-700 font-bold">
                      {segment.origin_station_code} - {segment.origin_station_name}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

                  <div>
                    <div className="text-xs text-slate-400">Tujuan</div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {segment.dest_arrival_time} WIB
                    </div>
                    <div className="text-xs text-sky-700 font-bold">
                      {segment.dest_station_code} - {segment.dest_station_name}
                    </div>
                  </div>

                  <div className="pl-4 border-l border-slate-200 hidden sm:block">
                    <div className="text-xs text-slate-400">Gate / Peron</div>
                    <div className="text-sm font-mono font-extrabold text-orange-600">
                      {segment.gate_info || 'PERON 1'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Warning if NOT PAID */}
              {segment.payment_status !== 'PAID' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-2 text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Check-In Belum Dapat Diproses (Status: {segment.payment_status})
                  </div>
                  <p>
                    Online Check-In dan Boarding Pass hanya dapat diterbitkan untuk tiket yang sudah berstatus <strong>PAID (Lunas)</strong>.
                  </p>
                  {segment.payment_status === 'PENDING' && (
                    <div className="pt-2">
                      <Link
                        href={`/checkout/${segment.invoice_number}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                      >
                        <span>Selesaikan Pembayaran Sekarang ({segment.invoice_number})</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Passenger Manifest Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    Manifest Penumpang ({passengers.length} Orang)
                  </h3>
                  <span className="text-xs text-slate-500">
                    Invoice: <strong className="font-mono text-slate-700">{segment.invoice_number}</strong>
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {passengers.map((pax, idx) => (
                    <div
                      key={pax.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{pax.full_name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">
                              {pax.pax_type}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            NIK/NISN: {pax.identity_number}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-left sm:text-right">
                          <div className="text-[10px] text-slate-400">Tempat Duduk</div>
                          <div className="font-mono font-bold text-slate-900">
                            {pax.seat_number ? (
                              <span>
                                {pax.wagon_code || 'EKS'} / <strong>{pax.seat_number}</strong>
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Pangku / Tanpa Kursi</span>
                            )}
                          </div>
                        </div>

                        <div>
                          {pax.boarding_status === 'BOARDED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> BOARDED
                            </span>
                          ) : pax.boarding_status === 'CHECKED_IN' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-100 text-sky-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> CHECKED IN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600">
                              <Clock className="w-3.5 h-3.5" /> BELUM CHECK-IN
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Alert during Check-In */}
              {checkInError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{checkInError}</span>
                </div>
              )}

              {/* Check-In Action Footer */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 text-center sm:text-left">
                  Dengan memproses check-in, Anda menyetujui ketentuan bagasi dan keselamatan perjalanan PT KAI / Biro Perjalanan SMK ULP.
                </div>

                {segment.payment_status === 'PAID' && (
                  <div>
                    {!isAllCheckedIn ? (
                      <button
                        type="button"
                        disabled={isSubmittingCheckIn}
                        onClick={handleProcessCheckIn}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white disabled:opacity-50 shadow-md shadow-orange-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmittingCheckIn ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Menerbitkan Boarding Pass...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Proses Check-In & Terbitkan Boarding Pass &rarr;</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <Link
                        href={`/boarding-pass/${segment.pnr_code}`}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white shadow-md shadow-sky-600/20 transition-all duration-200 cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Lihat & Cetak E-Boarding Pass &rarr;</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
