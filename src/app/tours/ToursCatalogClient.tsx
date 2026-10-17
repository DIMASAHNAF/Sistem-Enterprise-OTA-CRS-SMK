'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Calendar,
  Users,
  Bus,
  CheckCircle2,
  ArrowRight,
  Search,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { TourLandscapeIllustration } from '@/components/tours/TourLandscapeIllustration';

interface TourPackageItem {
  id: number;
  slug: string;
  title: string;
  destination: string;
  duration_days: number;
  min_pax: number;
  price_per_pax: number;
  costing_json: string;
  costing?: any;
  itineraries_count?: number;
  manifests_count?: number;
}

export function ToursCatalogClient({ initialPackages }: { initialPackages: TourPackageItem[] }) {
  const [search, setSearch] = useState('');
  const [filterDuration, setFilterDuration] = useState<string>('ALL');

  const filtered = initialPackages.filter((pkg) => {
    const matchSearch =
      search === '' ||
      pkg.title.toLowerCase().includes(search.toLowerCase()) ||
      pkg.destination.toLowerCase().includes(search.toLowerCase());

    const matchDuration =
      filterDuration === 'ALL' ||
      (filterDuration === '1' && pkg.duration_days === 1) ||
      (filterDuration === '2-3' && pkg.duration_days >= 2 && pkg.duration_days <= 3) ||
      (filterDuration === '4+' && pkg.duration_days >= 4);

    return matchSearch && matchDuration;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-16">
      {/* Hero Banner with Cerulean & Ocean Blue Theme */}
      <div className="relative bg-gradient-to-br from-sky-600 via-blue-600 to-blue-800 text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-blue-900/30 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-200" />
            <span>Katalog Resmi Paket Wisata & Kunjungan Industri (KI) SMK</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Eksplorasi Destinasi Unggulan & Paket Kunjungan Industri Siswa
          </h1>

          <p className="text-sm sm:text-base text-sky-100 max-w-3xl leading-relaxed">
            Paket perjalanan resmi yang dirancang langsung oleh siswa/siswi Konsentrasi Keahlian Unit Layanan Pariwisata (ULP/ULW) & Perhotelan SMK, didukung armada bus pariwisata berstandar industri dan hotel terkurasi.
          </p>

          {/* Quick Search & Filter Bar */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari destinasi atau nama paket wisata..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs text-slate-900 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Durasi:</span>
              <select
                value={filterDuration}
                onChange={(e) => setFilterDuration(e.target.value)}
                className="px-3 py-2.5 text-xs font-semibold text-slate-900 bg-white rounded-lg border border-slate-300 focus:outline-none"
              >
                <option value="ALL">Semua Durasi</option>
                <option value="1">1 Hari (One Day Trip)</option>
                <option value="2-3">2 - 3 Hari (Short Tour)</option>
                <option value="4+">4 Hari Ke Atas (Long Tour)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Package Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            Daftar Paket Terverifikasi ({filtered.length} Paket)
          </h2>
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Standar Asosiasi ULP/ULW SMK Indonesia</span>
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
            <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm">Tidak ada paket wisata yang cocok</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Coba sesuaikan kata kunci pencarian atau ganti filter durasi perjalanan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((pkg) => {
              const freePax = pkg.costing?.free_pax || 0;

              return (
                <div
                  key={pkg.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-sky-300 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group"
                >
                  {/* Thematic Landscape Illustration Header */}
                  <TourLandscapeIllustration
                    slug={pkg.slug}
                    destination={pkg.destination}
                    costing={pkg.costing}
                    heightClass="h-36 sm:h-40"
                  />

                  {/* Card Header Strip */}
                  <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 p-5 text-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-bold bg-white/15 text-sky-200 border border-white/20">
                        <Calendar className="w-3 h-3" /> {pkg.duration_days} Hari
                      </span>
                      <span className="text-[11px] text-slate-300 font-mono">
                        Min. {pkg.min_pax} Siswa
                      </span>
                    </div>

                    <h3 className="font-black text-base tracking-tight text-white group-hover:text-sky-300 transition-colors line-clamp-2 leading-snug">
                      {pkg.title}
                    </h3>

                    <div className="text-xs text-sky-100/90 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{pkg.destination}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
                    {/* Key Highlights */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Fasilitas Termasuk:
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Bus Pariwisata AC Executive Class</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Hotel Bintang / Akomodasi Terkurasi</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Konsumsi Lengkap & Tiket Masuk Objek</span>
                        </div>
                        {freePax > 0 && (
                          <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Gratis Biaya untuk {freePax} Guru Pendamping</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing & CTA */}
                    <div className="pt-4 border-t border-slate-100 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Mulai Dari
                        </div>
                        <div className="text-lg font-mono font-black text-orange-600 leading-tight">
                          Rp {pkg.price_per_pax?.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-400">per siswa / pax</div>
                      </div>

                      <Link
                        href={`/tours/${pkg.slug}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-sm shadow-orange-500/20 transition-all duration-200 whitespace-nowrap"
                      >
                        <span>Detail & Itinerary</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
