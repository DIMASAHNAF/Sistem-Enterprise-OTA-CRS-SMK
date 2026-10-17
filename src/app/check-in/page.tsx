import React, { Suspense } from 'react';
import { CheckInClient } from './CheckInClient';

export const dynamic = 'force-dynamic';

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-500 font-sans">
          Memuat halaman check-in online...
        </div>
      }
    >
      <CheckInClient />
    </Suspense>
  );
}
