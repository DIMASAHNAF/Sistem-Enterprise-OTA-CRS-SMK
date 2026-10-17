'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Train,
  Bus,
  ArrowRight,
  QrCode,
  CreditCard,
  Building,
  Printer,
  Copy,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';
import { formatIDR } from '@/lib/utils/travel';

interface PassengerItem {
  id: number;
  full_name: string;
  identity_number: string;
  pax_type: string;
  wagon_code: string | null;
  seat_number: string | null;
}

interface SegmentItem {
  id: number;
  pnr_code: string;
  segment_type: string;
  departure_date: string;
  base_departure_time: string;
  gate_info: string | null;
  route_name: string;
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  origin_code: string;
  origin_name: string;
  dest_code: string;
  dest_name: string;
  origin_dep_offset: number;
  dest_arr_offset: number;
  passengers: PassengerItem[];
}

interface BookingData {
  id: number;
  invoice_number: string;
  trip_type: string;
  total_amount: number;
  payment_status: 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';
  locked_until: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  segments: SegmentItem[];
}

interface Props {
  initialBooking: BookingData;
}

export default function CheckoutClient({ initialBooking }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingData>(initialBooking);
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'VA_SUMUT' | 'VA_BRI' | 'CASH'>('QRIS');
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time Countdown Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (booking.payment_status !== 'PENDING') return 0;
    const diff = Math.floor((new Date(booking.locked_until).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    if (booking.payment_status !== 'PENDING') return;

    const timer = setInterval(() => {
      const diff = Math.floor((new Date(booking.locked_until).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSeconds(0);
        setBooking((prev) => ({ ...prev, payment_status: 'EXPIRED' }));
        clearInterval(timer);
      } else {
        setRemainingSeconds(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [booking.locked_until, booking.payment_status]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Handle Pay Action
  const handlePay = async () => {
    setIsPaying(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/bookings/${booking.invoice_number}/pay`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran');
      }

      setBooking((prev) => ({ ...prev, payment_status: 'PAID' }));
      // Redirect to official e-ticket
      const primaryPnr = data.pnr_code || booking.segments[0]?.pnr_code;
      router.push(`/tickets/${primaryPnr}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setIsPaying(false);
    }
  };

  const isPending = booking.payment_status === 'PENDING';
  const isPaid = booking.payment_status === 'PAID';
  const isExpired = booking.payment_status === 'EXPIRED';
  const isRefunded = booking.payment_status === 'REFUNDED';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <StorefrontNavbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Real-Time Countdown Timer Banner */}
        {isPending && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Selesaikan Pembayaran Sebelum Waktu Habis:
                </div>
                <div className="text-xs text-amber-700">
                  Kursi Anda dikunci atomik selama 15 menit agar tidak diambil oleh pemesan lain.
                </div>
              </div>
            </div>

            <div className="font-mono font-extrabold text-2xl text-amber-800 bg-white px-4 py-1.5 rounded-lg border border-amber-300 shadow-sm">
              {timeFormatted}
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-rose-900 text-xs font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">Waktu Pembayaran Habis (EXPIRED)</div>
              <div>Batas waktu 15 menit telah terlewati. Kursi telah dilepas kembali ke ketersediaan umum. Silakan lakukan pemesanan ulang.</div>
            </div>
          </div>
        )}

        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-sm">Pesanan Lunas (PAID)</div>
                <div>Tiket Anda telah terbit resmi. Silakan cetak atau simpan E-Ticket Anda.</div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/tickets/${booking.segments[0]?.pnr_code}`)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              Lihat E-Ticket &rarr;
            </button>
          </div>
        )}

        {isRefunded && (
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 text-slate-800 text-xs font-semibold flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-slate-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">Pesanan Telah Dibatalkan / Di-Refund</div>
              <div>Dana tiket telah dikembalikan dan kursi telah dilepas kembali ke publik.</div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Order Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Nomor Invoice Tagihan
              </div>
              <div className="font-mono font-extrabold text-base text-slate-900">
                {booking.invoice_number}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold tracking-wider ${
                  isPaid
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : isExpired
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : isRefunded
                    ? 'bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {booking.payment_status}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="p-6 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Nama Pemesan:</span>
              <strong className="text-slate-800">{booking.customer_name}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Email:</span>
              <strong className="text-slate-800">{booking.customer_email}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Nomor Kontak:</span>
              <strong className="font-mono text-slate-800">{booking.customer_phone}</strong>
            </div>
          </div>

          {/* Travel Segments & Passengers */}
          <div className="p-6 space-y-6">
            {booking.segments.map((seg, idx) => (
              <div key={seg.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800">
                      {seg.segment_type === 'DEPARTURE' ? 'PERJALANAN PERGI' : 'PERJALANAN PULANG'}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {seg.fleet_name} ({seg.fleet_code})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Kode Booking (PNR):</span>
                    <strong className="font-mono font-extrabold text-sm text-sky-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {seg.pnr_code}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{seg.origin_name} ({seg.origin_code})</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono font-bold text-slate-900">{seg.dest_name} ({seg.dest_code})</span>
                  </div>
                  <div>
                    Tanggal: <strong className="font-mono text-slate-800">{seg.departure_date}</strong> &bull; Gate:{' '}
                    <strong>{seg.gate_info || '-'}</strong>
                  </div>
                </div>

                {/* Passenger Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Nama Penumpang</th>
                        <th className="px-3 py-2">No. Identitas</th>
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2 text-right">Gerbong / Kursi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {seg.passengers.map((p, pIdx) => (
                        <tr key={pIdx}>
                          <td className="px-3 py-2 font-medium text-slate-900">{p.full_name}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{p.identity_number}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.pax_type === 'ADULT'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {p.pax_type === 'ADULT' ? 'DEWASA' : 'BAYI (PANGKU)'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                            {p.seat_number ? (
                              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-sky-800">
                                {p.wagon_code} - Kursi {p.seat_number}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans font-normal text-[11px]">
                                Tanpa Kursi
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Payment Method Selector (if PENDING) */}
          {isPending && (
            <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-sky-600" />
                Pilih Kanal Pembayaran Simulasi
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    paymentMethod === 'QRIS'
                      ? 'bg-white border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">QRIS Edukasi SMK</span>
                    <QrCode className="w-4 h-4 text-sky-600" />
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Scan instan via GoPay, OVO, Dana, BCA Mobile
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('VA_SUMUT')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    paymentMethod === 'VA_SUMUT'
                      ? 'bg-white border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">VA Bank Sumut</span>
                    <Building className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Nomor VA: <span className="font-mono font-bold">8820 1271 0092</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    paymentMethod === 'CASH'
                      ? 'bg-white border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">Kasir Loket ULP</span>
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Bayar langsung tunai di meja loket praktik siswa
                  </span>
                </button>
              </div>

              {/* Total & Action Bar */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-slate-500">Total Nominal Pembayaran:</div>
                  <div className="text-2xl font-mono font-extrabold text-orange-600">
                    {formatIDR(booking.total_amount)}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPaying || remainingSeconds <= 0}
                  onClick={handlePay}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
                >
                  {isPaying ? 'Memproses Pelunasan...' : '⚡ Simulasi Bayar Lunas Sekarang'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
