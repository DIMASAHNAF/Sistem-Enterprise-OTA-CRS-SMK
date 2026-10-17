'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Train,
  ArrowLeftRight,
  Calendar,
  Users,
  Search,
  AlertCircle,
  MapPin,
  Check,
  ChevronDown,
} from 'lucide-react';
import { CustomStationSelect } from './CustomStationSelect';
import { PassengerPopover } from './PassengerPopover';

export interface StationOption {
  id: number;
  code: string;
  name: string;
  city: string;
  type: string;
}

interface Props {
  stations: StationOption[];
  initialOrigin?: string;
  initialDestination?: string;
  initialDate?: string;
  initialReturnDate?: string;
  initialTripType?: 'ONE_WAY' | 'ROUND_TRIP';
  initialAdults?: number;
  initialInfants?: number;
  compact?: boolean;
}

export function SearchWidget({
  stations,
  initialOrigin = 'MDN',
  initialDestination = 'RAP',
  initialDate,
  initialReturnDate,
  initialTripType = 'ONE_WAY',
  initialAdults = 1,
  initialInfants = 0,
  compact = false,
}: Props) {
  const router = useRouter();

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [origin, setOrigin] = useState<string>(initialOrigin);
  const [destination, setDestination] = useState<string>(initialDestination);
  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>(initialTripType);
  const [date, setDate] = useState<string>(initialDate || todayStr);
  const [returnDate, setReturnDate] = useState<string>(initialReturnDate || tomorrowStr);
  const [adults, setAdults] = useState<number>(initialAdults);
  const [infants, setInfants] = useState<number>(initialInfants);
  const [error, setError] = useState<string | null>(null);

  // Swap origin and destination
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Submit search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (origin === destination) {
      setError('Stasiun asal dan tujuan tidak boleh sama.');
      return;
    }

    if (tripType === 'ROUND_TRIP' && returnDate < date) {
      setError('Tanggal pulang tidak boleh lebih awal dari tanggal pergi.');
      return;
    }

    if (infants > adults) {
      setError('Jumlah bayi tidak boleh melebihi jumlah penumpang dewasa (maksimal 1 bayi per 1 dewasa).');
      return;
    }

    const params = new URLSearchParams({
      origin,
      destination,
      date,
      trip_type: tripType,
      adults: String(adults),
      infants: String(infants),
    });

    if (tripType === 'ROUND_TRIP') {
      params.set('return_date', returnDate);
    }

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div
      className={`bg-white text-slate-900 rounded-2xl shadow-xl shadow-blue-950/15 border border-slate-100 ${
        compact ? 'p-4 sm:p-5' : 'p-6 md:p-8'
      }`}
    >
      {/* Trip Type Selector: Smooth Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-3">
        <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-2xs">
          <button
            type="button"
            onClick={() => setTripType('ONE_WAY')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
              tripType === 'ONE_WAY'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            Sekali Jalan (One-Way)
          </button>
          <button
            type="button"
            onClick={() => setTripType('ROUND_TRIP')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
              tripType === 'ROUND_TRIP'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            Pulang-Pergi (Round-Trip)
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Konfirmasi Kursi Atomik 15 Menit &bull; Kuota Real-Time</span>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Fields */}
      <form onSubmit={handleSearch} className="space-y-4">
        {tripType === 'ONE_WAY' ? (
          /* ONE WAY: All in 1 aligned row on desktop (lg:grid-cols-12) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            {/* Origin & Destination with Swap in between (5 Cols) */}
            <div className="sm:col-span-2 lg:col-span-5 flex items-end gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <CustomStationSelect
                  label="Stasiun Asal"
                  icon={<MapPin className="w-3.5 h-3.5 text-sky-600" />}
                  value={origin}
                  onChange={setOrigin}
                  stations={stations}
                  placeholder="Pilih asal..."
                />
              </div>
              <div className="shrink-0 pb-1">
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Tukar Stasiun Asal & Tujuan"
                  className="p-2.5 rounded-full border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:rotate-180 active:scale-90 transition-all duration-300 shadow-2xs flex items-center justify-center group cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <CustomStationSelect
                  label="Stasiun Tujuan"
                  icon={<MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                  value={destination}
                  onChange={setDestination}
                  stations={stations}
                  placeholder="Pilih tujuan..."
                />
              </div>
            </div>

            {/* Departure Date (2 Cols) */}
            <div className="sm:col-span-1 lg:col-span-2 min-w-0">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 truncate">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Tanggal Pergi</span>
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-slate-50/70 hover:bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition-all duration-200 shadow-2xs cursor-pointer"
              />
            </div>

            {/* Passenger Popover (2 Cols) */}
            <div className="sm:col-span-1 lg:col-span-2 min-w-0">
              <PassengerPopover
                adults={adults}
                infants={infants}
                onAdultsChange={setAdults}
                onInfantsChange={setInfants}
              />
            </div>

            {/* CTA Button (3 Cols) */}
            <div className="sm:col-span-2 lg:col-span-3 min-w-0">
              <button
                type="submit"
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-md shadow-orange-500/25 transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Cari Tiket</span>
              </button>
            </div>
          </div>
        ) : (
          /* ROUND TRIP: 2 balanced rows */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* Origin & Destination with Swap (6 Cols) */}
              <div className="sm:col-span-2 lg:col-span-6 flex items-end gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <CustomStationSelect
                    label="Stasiun Asal"
                    icon={<MapPin className="w-3.5 h-3.5 text-sky-600" />}
                    value={origin}
                    onChange={setOrigin}
                    stations={stations}
                    placeholder="Pilih asal..."
                  />
                </div>
                <div className="shrink-0 pb-1">
                  <button
                    type="button"
                    onClick={handleSwap}
                    title="Tukar Stasiun Asal & Tujuan"
                    className="p-2.5 rounded-full border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:rotate-180 active:scale-90 transition-all duration-300 shadow-2xs flex items-center justify-center group cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4 transition-transform group-hover:scale-110" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <CustomStationSelect
                    label="Stasiun Tujuan"
                    icon={<MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                    value={destination}
                    onChange={setDestination}
                    stations={stations}
                    placeholder="Pilih tujuan..."
                  />
                </div>
              </div>

              {/* Departure Date (3 Cols) */}
              <div className="sm:col-span-1 lg:col-span-3 min-w-0">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-sky-600" />
                  <span>Tanggal Pergi</span>
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-slate-50/70 hover:bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition-all duration-200 shadow-2xs cursor-pointer"
                />
              </div>

              {/* Return Date (3 Cols) */}
              <div className="sm:col-span-1 lg:col-span-3 min-w-0">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tanggal Pulang</span>
                </label>
                <input
                  type="date"
                  required
                  min={date}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-slate-50/70 hover:bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition-all duration-200 shadow-2xs cursor-pointer"
                />
              </div>
            </div>

            {/* Row 2 for Round Trip: Passengers & CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end pt-1">
              <div className="sm:col-span-1 lg:col-span-7 min-w-0">
                <PassengerPopover
                  adults={adults}
                  infants={infants}
                  onAdultsChange={setAdults}
                  onInfantsChange={setInfants}
                />
              </div>

              <div className="sm:col-span-1 lg:col-span-5 min-w-0">
                <button
                  type="submit"
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-md shadow-orange-500/25 transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>Cari Tiket Pulang-Pergi</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

