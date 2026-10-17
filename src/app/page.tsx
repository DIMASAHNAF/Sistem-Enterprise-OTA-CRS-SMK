import React from 'react';
import Link from 'next/link';
import {
  Train,
  Bus,
  MapPin,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Ticket,
  Clock,
  Sparkles,
  Calendar,
  Users,
  Compass,
} from 'lucide-react';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';
import { SearchWidget } from '@/components/search/SearchWidget';
import { PnrLookupWidget } from '@/components/search/PnrLookupWidget';
import { LiveRailwayMap } from '@/components/map/LiveRailwayMap';
import { TourLandscapeIllustration } from '@/components/tours/TourLandscapeIllustration';
import { getDatabase } from '@/lib/db';
import { Station } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function calculateArrivalTime(departureTime: string, durationMinutes: number): string {
  const [h, m] = (departureTime || '07:00').split(':').map(Number);
  const totalMinutes = h * 60 + m + durationMinutes;
  const arrH = Math.floor(totalMinutes / 60) % 24;
  const arrM = totalMinutes % 60;
  return `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;
}

export default function StorefrontPage() {
  const db = getDatabase();

  // Load real stations for search drop-downs
  const rawStations = db
    .prepare('SELECT * FROM stations ORDER BY id ASC')
    .all() as any[];
  const stations: Station[] = rawStations.map((s) => ({ ...s }));

  // Load diverse, distinct schedules across different routes & fleets
  const schedules = db
    .prepare(`
      SELECT 
        s.id,
        s.route_id,
        s.departure_date,
        s.base_departure_time,
        s.status,
        s.gate_info,
        r.route_name,
        r.direction,
        f.name as fleet_name,
        f.code as fleet_code,
        f.type as fleet_type,
        MIN(sf.price) as min_price,
        SUM(sf.quota) as total_quota,
        (SELECT s_orig.code FROM route_stops rs_orig JOIN stations s_orig ON rs_orig.station_id = s_orig.id WHERE rs_orig.route_id = r.id ORDER BY rs_orig.stop_order ASC LIMIT 1) as origin_code,
        (SELECT s_orig.name FROM route_stops rs_orig JOIN stations s_orig ON rs_orig.station_id = s_orig.id WHERE rs_orig.route_id = r.id ORDER BY rs_orig.stop_order ASC LIMIT 1) as origin_name,
        (SELECT s_dest.code FROM route_stops rs_dest JOIN stations s_dest ON rs_dest.station_id = s_dest.id WHERE rs_dest.route_id = r.id ORDER BY rs_dest.stop_order DESC LIMIT 1) as dest_code,
        (SELECT s_dest.name FROM route_stops rs_dest JOIN stations s_dest ON rs_dest.station_id = s_dest.id WHERE rs_dest.route_id = r.id ORDER BY rs_dest.stop_order DESC LIMIT 1) as dest_name,
        (SELECT MAX(arrival_offset_minutes) FROM route_stops WHERE route_id = r.id) as trip_duration_minutes
      FROM schedules s
      JOIN routes r ON s.route_id = r.id
      JOIN fleets f ON r.fleet_id = f.id
      JOIN schedule_fares sf ON s.id = sf.schedule_id
      GROUP BY s.route_id
      ORDER BY s.base_departure_time ASC
      LIMIT 4
    `)
    .all() as unknown as Array<{
    id: number;
    route_id: number;
    departure_date: string;
    base_departure_time: string;
    status: string;
    gate_info: string;
    route_name: string;
    direction: string;
    fleet_name: string;
    fleet_code: string;
    fleet_type: string;
    min_price: number;
    total_quota: number;
    origin_code: string;
    origin_name: string;
    dest_code: string;
    dest_name: string;
    trip_duration_minutes: number;
  }>;

  // Load active tour packages
  const tourPackages = db
    .prepare("SELECT * FROM tour_packages WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 3")
    .all() as any[];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <StorefrontNavbar />

      {/* Hero Section: Vercel Dark Architectural Grid + Flighty Live Railway Radar */}
      <section className="relative bg-slate-950 text-white pt-16 md:pt-20 pb-20 overflow-hidden border-b border-slate-800/80">
        {/* Architectural SVG Grid Pattern with Radial Vignette */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40"
          aria-hidden="true"
        />

        {/* Subtle Ambient Glows */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute top-24 right-1/4 w-[400px] h-[250px] bg-orange-500/8 blur-[100px] rounded-full pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Header Description */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 backdrop-blur-md text-sky-300 border border-sky-400/30 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  Sistem Enterprise Reservasi CRS & Biro Perjalanan ULP
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  Divre 1 Sumatera Utara
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
                Jelajahi Sumatera Utara dengan Tiket Kereta & Bus Pariwisata
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-2xl">
                Pemesanan tiket terpadu dengan sistem penguncian kursi atomik 15 menit, verifikasi QR Boarding Pass kriptografi HMAC-SHA256, dan manajemen armada pariwisata sekolah.
              </p>
            </div>

            {/* Right Live Railway Radar Map (Flighty App Style) */}
            <div className="lg:col-span-5">
              <LiveRailwayMap />
            </div>
          </div>

          {/* Floating Search Widget (Geist Clean Floating Card) */}
          <SearchWidget stations={stations} />
        </div>
      </section>

      {/* Main Content Area */}
      <main className="py-12 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Active Train & Bus Schedules: Roomy Horizontal Ticket Cards */}
          <div>
            <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Compass className="w-6 h-6 text-sky-600" />
                  Jadwal Keberangkatan Kereta & Bus Lintas Sumatera Utara
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tarif resmi segmen perjalanan dengan konfirmasi kuota dan jadwal real-time
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{schedules.length} Rute Unggulan Beroperasi</span>
              </span>
            </div>

            {/* Horizontal Ticket Cards Grid (1 Column or 2 Columns wide) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {schedules.map((s) => {
                const duration = s.trip_duration_minutes || 180;
                const arrTime = calculateArrivalTime(s.base_departure_time, duration);
                const isTrain = s.fleet_type === 'TRAIN';
                const searchUrl = `/search?origin=${s.origin_code}&destination=${s.dest_code}&date=${s.departure_date}&tripType=ONE_WAY&adults=1`;

                return (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                  >
                    {/* Card Header: Fleet Name + Direction Badge */}
                    <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isTrain
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isTrain ? (
                            <Train className="w-4 h-4" />
                          ) : (
                            <Bus className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 truncate">
                            {s.fleet_name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {s.route_name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200/70 tracking-wide uppercase whitespace-nowrap">
                          {s.direction}
                        </span>
                      </div>
                    </div>

                    {/* Card Body: Horizontal Journey Timeline */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
                        {/* Origin */}
                        <div className="text-left">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Berangkat
                          </div>
                          <div className="font-mono font-black text-xl text-slate-900 leading-tight">
                            {s.base_departure_time}
                          </div>
                          <div className="text-xs font-bold text-sky-700 mt-0.5">
                            {s.origin_code}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[100px]">
                            {s.origin_name?.split(' ')[0] || s.origin_code}
                          </div>
                        </div>

                        {/* Timeline Graphic */}
                        <div className="flex-1 px-4 flex flex-col items-center">
                          <div className="text-[11px] font-mono font-semibold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDuration(duration)}</span>
                          </div>
                          <div className="w-full flex items-center my-1.5">
                            <div className="w-2 h-2 rounded-full border-2 border-sky-500 bg-white"></div>
                            <div className="flex-1 border-t-2 border-dashed border-slate-300 relative">
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 px-1 text-slate-400">
                                {isTrain ? (
                                  <Train className="w-3.5 h-3.5" />
                                ) : (
                                  <Bus className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-sky-600"></div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                            Langsung
                          </span>
                        </div>

                        {/* Destination */}
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Tiba
                          </div>
                          <div className="font-mono font-black text-xl text-slate-900 leading-tight">
                            {arrTime}
                          </div>
                          <div className="text-xs font-bold text-sky-700 mt-0.5">
                            {s.dest_code}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[100px]">
                            {s.dest_name?.split(' ')[0] || s.dest_code}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Gate, Price & CTA Button */}
                      <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">Peron: </span>
                            <span className="font-bold text-slate-900 font-mono">
                              {s.gate_info || 'Jalur 1'}
                            </span>
                          </div>
                          <span className="text-slate-300">&bull;</span>
                          <div className="text-[11px] text-emerald-600 font-semibold">
                            Tersedia Kursi
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 font-medium">Mulai Dari</div>
                            <div className="font-mono font-black text-lg text-orange-600 leading-tight">
                              Rp {(s.min_price || 25000).toLocaleString('id-ID')}
                              <span className="text-[11px] text-slate-400 font-normal"> /pax</span>
                            </div>
                          </div>

                          <Link
                            href={searchUrl}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-sm shadow-orange-500/20 transition-all duration-200 whitespace-nowrap"
                          >
                            <span>Pilih Kursi</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Featured Industrial Tour Packages Catalog */}
          <div id="tour-packages" className="space-y-6">
            <div className="flex justify-between items-end flex-wrap gap-2">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-orange-500" />
                  Katalog Paket Kunjungan Industri (KI) & Praktik ULP
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Paket wisata edukasi resmi dirancang oleh siswa & guru kejuruan Usaha Layanan Pariwisata (ULP/ULW)
                </p>
              </div>
              <Link
                href="/tours"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
              >
                <span>Lihat Semua Paket Wisata</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tourPackages.map((tour) => {
                let costing: any = null;
                try {
                  costing = JSON.parse(tour.costing_json);
                } catch {
                  costing = null;
                }

                return (
                  <div
                    key={tour.id}
                    className="bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Rich Thematic Landscape SVG Header */}
                      <TourLandscapeIllustration
                        slug={tour.slug}
                        destination={tour.destination}
                        costing={costing}
                        heightClass="h-36 sm:h-40"
                      />

                      {/* Tour Card Content */}
                      <div className="p-5 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-50 text-orange-700 border border-orange-200/70 uppercase">
                            {tour.duration_days} Hari
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            Min. {tour.min_pax} Siswa
                          </span>
                        </div>
                        <h3 className="font-black text-sm text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2 leading-snug">
                          {tour.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{tour.destination}</span>
                        </p>
                      </div>

                      {/* Included Highlights */}
                      <div className="px-5 py-3 bg-slate-50/70 border-y border-slate-100 text-[11px] text-slate-600 space-y-1 font-medium">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Bus Pariwisata AC & Reclining Seat</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Pemandu Wisata & Tour Leader Siswa ULP</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Tiket Destinasi & Asuransi Perjalanan</span>
                        </div>
                      </div>
                    </div>

                    {/* Price and Action */}
                    <div className="p-5 pt-4 flex items-center justify-between border-t border-slate-100">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Tarif Edukasi</div>
                        <div className="font-mono font-black text-base text-slate-900 leading-tight">
                          Rp {tour.price_per_pax.toLocaleString('id-ID')}
                          <span className="text-[11px] text-slate-400 font-normal"> /pax</span>
                        </div>
                      </div>

                      <Link
                        href={`/tours/${tour.slug}`}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-sm shadow-orange-500/20 transition-all duration-200"
                      >
                        <span>Rincian</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick PNR Lookup Interactive Widget */}
          <PnrLookupWidget />
        </div>
      </main>

      {/* OTA Clean Transactional Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 pt-12 pb-8 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-white font-black text-sm mb-3 flex items-center gap-2">
                <Train className="w-4 h-4 text-sky-400" />
                <span>SMK TRAVEL CRS & OTA</span>
              </div>
              <p className="leading-relaxed text-slate-400">
                Platform Computer Reservation System (CRS) dan Biro Perjalanan Terintegrasi untuk SMK Program Keahlian Usaha Layanan Pariwisata (ULP/ULW) & Perhotelan.
              </p>
            </div>

            <div>
              <div className="text-white font-bold mb-3">Simpul Stasiun Operasional</div>
              <div className="space-y-1.5 text-slate-300">
                <div>Stasiun Besar Medan (MDN)</div>
                <div>Stasiun Lubuk Pakam (LBP)</div>
                <div>Stasiun Tebing Tinggi (TBI)</div>
                <div>Stasiun Kisaran (KIS)</div>
                <div>Stasiun Rantau Prapat (RAP)</div>
                <div>Stasiun Tanjung Balai (TNB)</div>
              </div>
            </div>

            <div>
              <div className="text-white font-bold mb-3">Standar Praktik & Keamanan</div>
              <div className="space-y-1.5 text-slate-300">
                <div>Anti-Race Condition Concurrency Seat Lock</div>
                <div>Cryptographic HMAC-SHA256 Signed QR</div>
                <div>6-Role RBAC Middleware & IDOR Protection</div>
                <div>Audit Trail Keamanan & Mutasi Transaksi</div>
              </div>
            </div>

            <div>
              <div className="text-white font-bold mb-3">Akses Peran Backoffice</div>
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sky-400 font-bold hover:text-sky-300 transition-colors"
                >
                  <span>Buka Konsol Backoffice</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <div className="text-slate-400 leading-relaxed text-[11px]">
                  SUPER_ADMIN &bull; REVENUE_CONTROLLER &bull; TICKETING_OFFICER &bull; TOUR_PLANNER &bull; BOARDING_OFFICER &bull; CUSTOMER
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex justify-between items-center flex-wrap gap-4 text-slate-400 text-[11px]">
            <div>&copy; 2026 SMK Enterprise OTA & CRS. Hak Cipta Dilindungi Undang-Undang.</div>
            <div className="font-mono text-slate-400">
              Clean Transactional OTA &bull; 100% Tailwind CSS Architecture
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
