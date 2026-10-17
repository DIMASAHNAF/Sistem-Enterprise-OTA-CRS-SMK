import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin,
  Calendar,
  Users,
  Bus,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ShieldCheck,
  Building2,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import { getDatabase } from '@/lib/db';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';
import { TourLandscapeIllustration } from '@/components/tours/TourLandscapeIllustration';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TourDetailPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) return notFound();

  const db = getDatabase();

  const pkg = db.prepare('SELECT * FROM tour_packages WHERE slug = ?').get(slug) as Record<string, any> | undefined;

  if (!pkg) {
    return notFound();
  }

  let costing: any = null;
  try {
    costing = JSON.parse(pkg.costing_json);
  } catch {
    costing = null;
  }

  const itineraries = db.prepare(`
    SELECT * FROM tour_itineraries
    WHERE tour_package_id = ?
    ORDER BY day_number ASC, start_time ASC
  `).all(pkg.id) as Array<Record<string, any>>;

  const manifests = db.prepare(`
    SELECT 
      tm.id,
      tm.bus_name,
      tm.seat_number,
      tm.room_number,
      u.name as user_name
    FROM tour_manifests tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tour_package_id = ?
    ORDER BY tm.bus_name ASC, tm.seat_number ASC
  `).all(pkg.id) as Array<Record<string, any>>;

  const uniqueBuses = Array.from(new Set(manifests.map((m) => m.bus_name)));
  const freePax = costing?.free_pax || costing?.freePax || (pkg.duration_days > 1 ? 2 : 1);

  // Extract included facilities from costing or construct complete verified ULP facilities
  const includedFacilities: string[] = [];
  if (costing?.components && Array.isArray(costing.components) && costing.components.length > 0) {
    costing.components.forEach((c: any) => {
      if (c.item) includedFacilities.push(c.item);
    });
  } else if (costing) {
    if (costing.bus_cost) includedFacilities.push('Transportasi Bus Pariwisata AC Eksekutif (Armada Resmi ULP SMK)');
    if (costing.hotel_cost && costing.hotel_cost > 0) includedFacilities.push('Akomodasi Hotel Bintang (Twin / Triple Sharing Terkurasi)');
    if (costing.meal_cost) includedFacilities.push(`Konsumsi Makanan Higienis & Halal Pagi/Siang/Malam (${pkg.duration_days} Hari)`);
    if (costing.ticket_cost) includedFacilities.push('Tiket Masuk & Perizinan Kunjungan Industri / Objek Wisata Resmi');
    if (costing.insurance_cost) includedFacilities.push('Asuransi Keselamatan Perjalanan Siswa & Fasilitas P3K Lengkap');
    if (costing.misc_cost) includedFacilities.push('Spanduk Kunjungan Industri, Air Mineral Harian, & Perlengkapan Tour');
  }

  if (includedFacilities.length === 0) {
    includedFacilities.push('Transportasi Bus Pariwisata AC Eksekutif (Reclining Seat, USB Port, Audio System)');
    if (pkg.duration_days > 1) {
      includedFacilities.push('Akomodasi Hotel Bintang (Kamar Berbagi 2-3 Siswa, AC, Air Panas)');
    }
    includedFacilities.push(`Makan Prasmanan Higienis & Halal Sesuai Rangkaian Program (${pkg.duration_days} Hari)`);
    includedFacilities.push('Tiket Masuk Resmi Seluruh Objek Wisata & Lokasi Kunjungan Industri');
    includedFacilities.push('Pemandu Wisata Bersertifikasi (Tour Leader & Local Guide SMK ULP)');
    includedFacilities.push('Asuransi Keselamatan Jiwa Siswa & Fasilitas Kotak P3K Medis Darurat');
    includedFacilities.push('Air Mineral Harian, Souvenir Identitas Tour, & Banner Dokumentasi Resmi');
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-16">
      <StorefrontNavbar />

      {/* Breadcrumb & Navigation */}
      <div className="bg-slate-900 text-slate-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/tours"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Paket Wisata</span>
          </Link>
          <span className="text-xs text-sky-400 font-medium">Biro Perjalanan Siswa ULP</span>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Card with Thematic Visual Landscape */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <TourLandscapeIllustration
            slug={pkg.slug}
            destination={pkg.destination}
            costing={costing}
            heightClass="h-48 sm:h-56"
          />

          <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 p-6 sm:p-8 text-white space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {pkg.duration_days} Hari Perjalanan
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Min. {pkg.min_pax} Siswa
              </span>
              {freePax > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  + {freePax} Guru Pendamping Bebas Biaya
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {pkg.title}
            </h1>

            <div className="text-sm text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{pkg.destination}</span>
            </div>
          </div>

          {/* Pricing Highlight Strip */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Penawaran Biaya Resmi per Peserta:
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-amber-600 mt-0.5">
                Rp {pkg.price_per_pax?.toLocaleString('id-ID')}
                <span className="text-xs font-normal text-slate-500 ml-1.5">/ siswa</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                *Sudah termasuk seluruh transportasi bus, hotel, konsumsi, tiket objek, dan subsidi guru.
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/6281260112233?text=Halo%20Admin%20ULP%20SMK,%20saya%20tertarik%20dengan%20paket%20wisata:%20"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Konsultasi Pemesanan Rombongan</span>
              </a>
            </div>
          </div>
        </div>

        {/* 2-Column: Inclusions & Exclusions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Fasilitas Termasuk (Included):</span>
            </h2>
            <ul className="space-y-2 text-xs text-slate-700">
              {includedFacilities.map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">&check;</span>
                  <span>{item}</span>
                </li>
              ))}
              {freePax > 0 && (
                <li className="flex items-start gap-2.5 font-bold text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                  <span className="text-emerald-600 font-extrabold">&check;</span>
                  <span>Gratis Biaya Penuh untuk {freePax} Guru Pendamping (Subsidi Sekolah)</span>
                </li>
              )}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-800 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Fasilitas Tidak Termasuk (Excluded):</span>
            </h2>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">&times;</span>
                <span>Pengeluaran pribadi peserta di luar fasilitas paket</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">&times;</span>
                <span>Wahana permainan berbayar mandiri di objek wisata</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">&times;</span>
                <span>Obat-obatan pribadi khusus dan kebutuhan darurat pribadi</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">&times;</span>
                <span>Tipping sukarela crew bus dan pemandu wisata</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Daily Itinerary Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Rangkaian Jadwal Kegiatan (Itinerary)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Jadwal harian disusun dengan mempertimbangkan ritme istirahat dan efisiensi waktu perjalanan.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
              {itineraries.length} Agenda
            </span>
          </div>

          {itineraries.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Jadwal kegiatan sedang disempurnakan oleh tim Tour Planner.
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(new Set(itineraries.map((i) => i.day_number))).sort((a, b) => a - b).map((dayNum) => {
                const dayItems = itineraries.filter((i) => i.day_number === dayNum);

                return (
                  <div key={dayNum} className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-sky-900 text-white">
                      <span>Hari ke-{dayNum}</span>
                    </div>

                    <div className="border-l-2 border-sky-300 ml-4 pl-4 space-y-4">
                      {dayItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-600 text-white">
                              {item.start_time} WIB
                            </span>
                            <h3 className="font-bold text-xs text-slate-900">
                              {item.activity_title}
                            </h3>
                          </div>

                          {item.location && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{item.location}</span>
                            </div>
                          )}

                          {item.description && (
                            <p className="text-[11px] text-slate-600">
                              {item.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Industrial Visit & Manifest Info */}
        {manifests.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Bus className="w-4 h-4 text-sky-600" />
                <span>Informasi Alokasi Rombongan Kunjungan Industri ({manifests.length} Peserta)</span>
              </h2>
              <span className="text-xs text-slate-500">{uniqueBuses.length} Armada Bus</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {uniqueBuses.map((bus) => {
                const busPax = manifests.filter((m) => m.bus_name === bus);
                return (
                  <div key={bus} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>{bus}</span>
                      <span className="font-mono text-sky-700 font-bold">{busPax.length} Siswa</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-1">
                      {busPax.slice(0, 8).map((p) => (
                        <span key={p.id} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono">
                          {p.seat_number}: {p.user_name}
                        </span>
                      ))}
                      {busPax.length > 8 && (
                        <span className="text-slate-400 font-medium">+{busPax.length - 8} lainnya</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
