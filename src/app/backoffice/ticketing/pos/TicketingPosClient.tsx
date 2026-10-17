'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ReceiptText,
  CreditCard,
  RotateCcw,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  RefreshCw,
  Printer,
  X,
  Ticket,
} from 'lucide-react';
import { formatIDR } from '@/lib/utils/travel';

export interface BookingRow {
  id: number;
  invoice_number: string;
  user_id: number;
  trip_type: string;
  total_amount: number;
  payment_status: 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';
  locked_until: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  primary_pnr: string;
  passenger_count: number;
}

interface Props {
  initialBookings: BookingRow[];
}

export default function TicketingPosClient({ initialBookings }: Props) {
  const [bookings, setBookings] = useState<BookingRow[]>(initialBookings);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Refund Confirmation Modal State
  const [refundTarget, setRefundTarget] = useState<BookingRow | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch / Refresh bookings
  const fetchBookings = async (query = search, status = filterStatus) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (status && status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/ticketing/bookings?${params.toString()}`);
      const data = await res.json();
      if (data.bookings) setBookings(data.bookings);
    } catch (err: unknown) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Search Input
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBookings(search, filterStatus);
  };

  // Handle Filter Status Change
  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    fetchBookings(search, status);
  };

  // Handle Accept Cash Payment
  const handleAcceptCashPayment = async (invoice: string) => {
    if (!confirm(`Konfirmasi penerimaan pembayaran TUNAI di meja loket untuk invoice ${invoice}?`)) return;

    try {
      const res = await fetch(`/api/bookings/${invoice}/pay`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses pembayaran');

      showNotification(`Pembayaran tunai untuk ${invoice} berhasil disahkan!`);
      fetchBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal konfirmasi pembayaran');
    }
  };

  // Submit Refund
  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setIsRefunding(true);
    setRefundError(null);

    try {
      const res = await fetch(`/api/bookings/${refundTarget.invoice_number}/refund`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses refund');

      showNotification(data.message || 'Tiket berhasil di-refund dan kursi telah dilepas!');
      setRefundTarget(null);
      fetchBookings();
    } catch (err: unknown) {
      setRefundError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-sky-600" />
            Dashboard Kasir Loket Praktik ULP (POS Counter)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Layanan penerimaan pembayaran tunai loket, pencarian invoice/PNR, serta proses pembatalan &amp; refund tiket otomatis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Buka Loket Go-Show Baru
          </Link>

          <button
            onClick={() => fetchBookings()}
            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Invoice, PNR, Nama Penumpang, atau NIK..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 placeholder:text-slate-400"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 text-xs">
            {['ALL', 'PENDING', 'PAID', 'EXPIRED', 'REFUNDED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleFilterChange(st)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filterStatus === st
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings List Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">No. Invoice & Tanggal</th>
                <th className="px-4 py-3 font-mono">Kode PNR</th>
                <th className="px-4 py-3">Nama Pemesan / Kontak</th>
                <th className="px-4 py-3">Jenis Trip</th>
                <th className="px-4 py-3 text-right">Total Tagihan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi Kasir Loket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada transaksi pemesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Invoice */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900">{b.invoice_number}</div>
                      <div className="text-[10px] font-mono text-slate-400">{b.created_at}</div>
                    </td>

                    {/* PNR */}
                    <td className="px-4 py-3">
                      <span className="font-mono font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-xs">
                        {b.primary_pnr || '-'}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{b.customer_name}</div>
                      <div className="text-[10px] text-slate-500">{b.customer_phone}</div>
                    </td>

                    {/* Trip Type */}
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                        {b.trip_type} ({b.passenger_count} Pax)
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatIDR(b.total_amount)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          b.payment_status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : b.payment_status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : b.payment_status === 'EXPIRED'
                            ? 'bg-rose-50 text-rose-800 border border-rose-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {b.payment_status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {b.payment_status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptCashPayment(b.invoice_number)}
                            className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                          >
                            Terima Tunai (Set PAID)
                          </button>
                        )}

                        {b.payment_status === 'PAID' && (
                          <>
                            <Link
                              href={`/tickets/${b.primary_pnr}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors"
                            >
                              <Printer className="w-3 h-3 text-slate-500" /> E-Ticket
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setRefundTarget(b);
                                setRefundError(null);
                              }}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                            >
                              Refund
                            </button>
                          </>
                        )}

                        <Link
                          href={`/checkout/${b.invoice_number}`}
                          target="_blank"
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Lihat Halaman Checkout"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REFUND MODAL */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-rose-900">
              <div className="flex items-center gap-2 font-bold text-sm">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Konfirmasi Refund &amp; Pembatalan Tiket
              </div>
              <button
                onClick={() => setRefundTarget(null)}
                className="p-1 rounded text-rose-400 hover:text-rose-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              {refundError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{refundError}</span>
                </div>
              )}

              <p>
                Anda akan membatalkan pesanan <strong className="font-mono text-slate-900">{refundTarget.invoice_number}</strong> milik <strong className="text-slate-900">{refundTarget.customer_name}</strong>.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nominal Pengembalian:</span>
                  <span className="font-mono font-bold text-orange-600">{formatIDR(refundTarget.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kode Booking (PNR):</span>
                  <span className="font-mono font-bold text-sky-700">{refundTarget.primary_pnr}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-[11px] leading-relaxed">
                💡 Begitu refund disahkan, seluruh kursi pada pesanan ini akan <strong>otomatis terbuka kembali (AVAILABLE)</strong> di denah kursi untuk dapat dipesan penumpang lain.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRefundTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isRefunding}
                  onClick={handleConfirmRefund}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isRefunding ? 'Memproses Refund...' : 'Konfirmasi Batalkan & Refund Tiket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
