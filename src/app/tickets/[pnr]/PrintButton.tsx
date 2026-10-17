'use client';

import React from 'react';
import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-colors"
    >
      <Printer className="w-3.5 h-3.5 text-slate-500" />
      <span>🖨️ Cetak / Simpan PDF E-Ticket</span>
    </button>
  );
}
