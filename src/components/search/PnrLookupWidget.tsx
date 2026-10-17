'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, Search, ArrowRight, AlertCircle } from 'lucide-react';

export function PnrLookupWidget() {
  const router = useRouter();
  const [pnr, setPnr] = useState('');
  const [error, setError] = useState('');

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPnr = pnr.trim().toUpperCase();
    if (!cleanPnr || cleanPnr.length !== 6) {
      setError('Kode PNR harus terdiri dari 6 karakter (contoh: B6MUKJ).');
      return;
    }
    setError('');
    router.push(`/tickets/${cleanPnr}`);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
            <Ticket className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-900 leading-tight">
              Cek Status Pemesanan & Unduh E-Ticket
            </div>
            <div className="text-[11px] text-slate-500">
              Lookup instan status reservasi dengan 6 karakter Kode Booking (PNR)
            </div>
          </div>
        </div>
        <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200/60">
          6 Karakter Unik
        </span>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              maxLength={6}
              value={pnr}
              onChange={(e) => {
                setPnr(e.target.value.toUpperCase());
                if (error) setError('');
              }}
              placeholder="Masukkan 6 Huruf Kode Booking (misal: B6MUKJ atau VWMGE6)"
              className="w-full h-11 px-4 border border-slate-300 rounded-xl text-xs font-mono font-bold tracking-wider uppercase bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition-all duration-200 shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-6 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white shadow-sm shadow-sky-600/20 transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Periksa Tiket Saya</span>
          </button>
        </form>
      </div>
    </div>
  );
}
