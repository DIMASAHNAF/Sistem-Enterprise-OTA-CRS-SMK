'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Train,
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    role: 'SUPER_ADMIN',
    title: 'Super Administrator',
    label: 'Guru Kabeng ULP / IT',
    email: 'admin@smk-nusantara.sch.id',
    password: 'Password123!',
    colorBadge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    role: 'REVENUE_CONTROLLER',
    title: 'Revenue Controller',
    label: 'Siswa ULP Div. Jadwal & Tarif',
    email: 'revenue@smk-nusantara.sch.id',
    password: 'Password123!',
    colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    role: 'TICKETING_OFFICER',
    title: 'Ticketing Officer',
    label: 'Siswa ULP Kasir Loket Praktik',
    email: 'loket@smk-nusantara.sch.id',
    password: 'Password123!',
    colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    role: 'TOUR_PLANNER',
    title: 'Tour Planner',
    label: 'Siswa ULP Div. Paket Wisata',
    email: 'tour@smk-nusantara.sch.id',
    password: 'Password123!',
    colorBadge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    role: 'BOARDING_OFFICER',
    title: 'Boarding Officer',
    label: 'Konduktor / Tour Leader',
    email: 'boarding@smk-nusantara.sch.id',
    password: 'Password123!',
    colorBadge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    role: 'CUSTOMER',
    title: 'Customer / Penumpang',
    label: 'Wali Murid / Wisatawan',
    email: 'budi.santoso@gmail.com',
    password: 'Password123!',
    colorBadge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal masuk sistem');
      }

      router.refresh();
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.push(data.redirectTo || '/backoffice');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column: Form Login */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              Masuk Sesi Operasional
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gunakan email resmi SMK atau akun penumpang terdaftar
            </p>
          </div>
          <ShieldCheck className="w-5 h-5 text-sky-600" />
        </div>

        <div className="p-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alamat Email Pengguna
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="nama@smk-nusantara.sch.id"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Masukkan kata sandi akun"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-colors mt-2"
            >
              {loading ? 'Memverifikasi...' : 'Masuk ke Sistem'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            Akses dilindungi RBAC Middleware & pencatatan log audit otomatis.
          </div>
        </div>
      </div>

      {/* Right Column: 6-Role Fast Demo Switcher */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <UserCheck className="w-4 h-4 text-sky-600" /> Pilih Role Pengguna (Demo Evaluasi)
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            6 Role Aktif
          </span>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-[11px] text-slate-500 mb-3">
            Klik salah satu peran di bawah ini untuk mengisi kredensial secara otomatis:
          </p>

          {DEMO_ACCOUNTS.map((acc) => {
            const isSelected = email === acc.email;
            return (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                className={`w-full flex items-center justify-between p-2.5 rounded-md border text-left transition-all ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50/60 shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${acc.colorBadge}`}
                    >
                      {acc.role}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      {acc.title}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {acc.label} &bull; <span className="font-mono">{acc.email}</span>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    isSelected ? 'text-sky-700 font-bold' : 'text-slate-400'
                  }`}
                >
                  {isSelected ? '✓ Terpilih' : 'Gunakan'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-slate-900">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
            <Train className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm tracking-tight">
            SMK TRAVELLOKA & CRS
          </span>
        </Link>

        <Link
          href="/"
          className="text-xs text-sky-600 font-semibold hover:text-sky-700"
        >
          &larr; Kembali ke Etalase Publik
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Suspense fallback={<div className="text-center text-xs text-slate-500">Memuat formulir masuk...</div>}>
          <LoginFormContent />
        </Suspense>
      </main>
    </div>
  );
}
