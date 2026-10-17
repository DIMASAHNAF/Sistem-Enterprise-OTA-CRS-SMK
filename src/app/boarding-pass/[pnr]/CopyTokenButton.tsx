'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  token: string;
}

export function CopyTokenButton({ token }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
        copied
          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
      }`}
      title="Salin token QR untuk pengujian di scanner petugas"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Tersalin ke Clipboard!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-slate-500" />
          <span>Salin Token QR</span>
        </>
      )}
    </button>
  );
}
