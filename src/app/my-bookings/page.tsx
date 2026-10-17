import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Ticket,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { releaseExpiredBookings } from '@/lib/booking/generator';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';
import { formatIDR } from '@/lib/utils/travel';

export const dynamic = 'force-dynamic';

export default async function MyBookingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/my-bookings');
  }

  const db = getDatabase();
  releaseExpiredBookings(db);

  const bookings = db.prepare(`
    SELECT b.*,
           (SELECT pnr_code FROM booking_segments WHERE booking_id = b.id ORDER BY id ASC LIMIT 1) as primary_pnr,
           (SELECT COUNT(*) FROM booking_passengers bp JOIN booking_segments bs ON bp.booking_segment_id = bs.id WHERE bs.booking_id = b.id) as passenger_count
    FROM bookings b
    WHERE b.user_id = ?
    ORDER BY b.id DESC
  `).all(user.id) as Array<{
    id: number;
    invoice_number: string;
    user_id: number;
    trip_type: string;
    total_amount: number;
    payment_status: 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';
    locked_until: string;
    created_at: string;
    primary_pnr: string;
    passenger_count: number;
  }>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <StorefrontNavbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Ticket className="w-5 h-5 text-sky-600" />
              Riwayat Pesanan & Tiket Perjalanan Saya
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Daftar seluruh tiket aktif, pesanan menunggu pembayaran, dan histori perjalanan Anda.
            </p>
          </div>

          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
          >
            Pesan Tiket Baru &rarr;
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500 space-y-3">
            <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-800">Belum Ada Riwayat Pemesanan</div>
            <p>Anda belum memiliki riwayat reservasi tiket. Silakan lakukan pencarian tiket perjalanan.</p>
            <Link
              href="/search"
              className="inline-block px-4 py-2 rounded-lg text-xs font-bold bg-sky-600 text-white"
            >
              Cari Tiket Sekarang
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {b.invoice_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        b.payment_status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : b.payment_status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : b.payment_status === 'EXPIRED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {b.payment_status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>
                      Dipesan: <strong className="font-mono text-slate-700">{b.created_at}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Total: <strong className="font-mono text-orange-600 font-bold">{formatIDR(b.total_amount)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div>
                      Jenis Perjalanan:{' '}
                      <strong className="text-slate-800">
                        {b.trip_type === 'ROUND_TRIP' ? 'Pulang-Pergi (Round-Trip)' : 'Sekali Jalan (One-Way)'}
                      </strong>
                    </div>
                    <div>
                      Jumlah Penumpang: <strong className="text-slate-800">{b.passenger_count} Penumpang</strong>
                    </div>
                    {b.primary_pnr && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-slate-400">Kode Booking (PNR):</span>
                        <span className="font-mono font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {b.primary_pnr}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {b.payment_status === 'PENDING' && (
                      <Link
                        href={`/checkout/${b.invoice_number}`}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-colors"
                      >
                        Lanjutkan Pembayaran &rarr;
                      </Link>
                    )}

                    {b.payment_status === 'PAID' && (
                      <>
                        <Link
                          href={`/tickets/${b.primary_pnr}`}
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-colors"
                        >
                          Cetak E-Ticket
                        </Link>
                        <Link
                          href={`/check-in?pnr=${b.primary_pnr}`}
                          className="px-3.5 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
                        >
                          Online Check-In &rarr;
                        </Link>
                      </>
                    )}

                    {b.payment_status === 'EXPIRED' && (
                      <Link
                        href={`/search`}
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        Pesan Ulang
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
