import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { ROLE_CONFIGS } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export default async function UnauthorizedPage() {
  const user = await getCurrentUser();
  const roleConfig = user ? ROLE_CONFIGS[user.role] : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-5">
        <ShieldAlert className="w-9 h-9" />
      </div>

      <h1 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">
        Akses Modul Terbatas (403 Forbidden)
      </h1>

      <p className="text-sm text-slate-600 max-w-lg leading-relaxed mb-6">
        Akun Anda saat ini memiliki peran{' '}
        <strong className="text-sky-700">{roleConfig?.title || user?.role}</strong>{' '}
        ({roleConfig?.badgeLabel}). Sesuai matriks RBAC sistem SMK Enterprise,
        modul ini hanya dapat diakses oleh peran berwenang.
      </p>

      <div className="flex gap-3">
        <Link
          href="/backoffice"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dasbor Peran Saya
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
        >
          <Home className="w-4 h-4" /> Etalase Penumpang
        </Link>
      </div>
    </div>
  );
}
