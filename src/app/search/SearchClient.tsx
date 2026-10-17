'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Train,
  Bus,
  ArrowRight,
  ArrowLeftRight,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
  RefreshCw,
  Edit2,
  X,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';
import { SearchWidget, StationOption } from '@/components/search/SearchWidget';
import { formatIDR } from '@/lib/utils/travel';

interface FareOption {
  fare_id: number;
  wagon_class: string;
  subclass: string;
  adult_price: number;
  infant_price: number;
  quota: number;
  occupied_seats: number;
  available_seats: number;
}

interface ScheduleResult {
  schedule_id: number;
  fleet_id: number;
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  route_name: string;
  direction: string;
  status: string;
  gate_info: string | null;
  departure_date: string;
  base_departure_time: string;
  origin_departure_time: string;
  destination_arrival_time: string;
  days_added: number;
  duration_minutes: number;
  duration_formatted: string;
  origin_stop_order: number;
  destination_stop_order: number;
  fares: FareOption[];
  lowest_price: number;
}

interface SeatItem {
  seat_number: string;
  row: number;
  col: string;
  status: 'AVAILABLE' | 'BOOKED' | 'LOCKED';
  locked_until: string | null;
}

interface WagonSeatMap {
  id: number;
  wagon_code: string;
  class: string;
  rows: number;
  cols_layout: string;
  direction_indicator: string;
  total_seats: number;
  available_seats: number;
  booked_seats: number;
  locked_seats: number;
  seat_rows: Array<{
    row_number: number;
    left_seats: SeatItem[];
    right_seats: SeatItem[];
    all_seats: SeatItem[];
  }>;
}

interface PassengerInput {
  name: string;
  identity_number: string;
  type: 'ADULT' | 'INFANT';
}

interface SelectedTrip {
  schedule: ScheduleResult;
  fare: FareOption;
}

interface Props {
  stations: StationOption[];
}

export default function SearchClient({ stations }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Search Query Params
  const originCode = searchParams.get('origin') || 'MDN';
  const destCode = searchParams.get('destination') || 'RAP';
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const returnDateParam = searchParams.get('return_date') || '';
  const tripType = (searchParams.get('trip_type') as 'ONE_WAY' | 'ROUND_TRIP') || 'ONE_WAY';
  const adultsCount = Number(searchParams.get('adults')) || 1;
  const infantsCount = Number(searchParams.get('infants')) || 0;

  // Stepper State: 1 = Choose Schedule, 2 = Passenger Data, 3 = Interactive Seat Map, 4 = Review & Lock
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // In Step 1 for ROUND_TRIP: active sub-tab ('OUTBOUND' or 'INBOUND')
  const [activeTripTab, setActiveTripTab] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');

  // Schedules Search State
  const [outboundResults, setOutboundResults] = useState<ScheduleResult[]>([]);
  const [inboundResults, setInboundResults] = useState<ScheduleResult[]>([]);
  const [loadingOutbound, setLoadingOutbound] = useState(false);
  const [loadingInbound, setLoadingInbound] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected Tickets
  const [selectedOutbound, setSelectedOutbound] = useState<SelectedTrip | null>(null);
  const [selectedInbound, setSelectedInbound] = useState<SelectedTrip | null>(null);

  // Toggle Modify Search Drawer
  const [isModifySearchOpen, setIsModifySearchOpen] = useState(false);

  // Step 2: Passenger Data & Contact Info
  const [contact, setContact] = useState({
    name: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    phone: '081234567890',
  });
  const [passengers, setPassengers] = useState<PassengerInput[]>([]);
  const [passengerErrors, setPassengerErrors] = useState<string | null>(null);

  // Booking Execution State
  const [isLockingSeats, setIsLockingSeats] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Step 3: Interactive Seat Map
  const [activeLegForSeats, setActiveLegForSeats] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [outboundWagons, setOutboundWagons] = useState<WagonSeatMap[]>([]);
  const [inboundWagons, setInboundWagons] = useState<WagonSeatMap[]>([]);
  const [selectedOutboundWagonId, setSelectedOutboundWagonId] = useState<number>(0);
  const [selectedInboundWagonId, setSelectedInboundWagonId] = useState<number>(0);
  const [loadingSeatMap, setLoadingSeatMap] = useState(false);

  // Map of passenger index -> { wagon_id, seat_number }
  const [outboundSeatAssignments, setOutboundSeatAssignments] = useState<Record<number, { wagon_id: number; seat_number: string }>>({});
  const [inboundSeatAssignments, setInboundSeatAssignments] = useState<Record<number, { wagon_id: number; seat_number: string }>>({});
  const [activePassengerIdx, setActivePassengerIdx] = useState<number>(0);

  // Initialize passenger list whenever adultsCount or infantsCount changes
  useEffect(() => {
    const list: PassengerInput[] = [];
    for (let i = 0; i < adultsCount; i++) {
      list.push({ name: '', identity_number: '', type: 'ADULT' });
    }
    for (let j = 0; j < infantsCount; j++) {
      list.push({ name: '', identity_number: '', type: 'INFANT' });
    }
    setPassengers(list);
  }, [adultsCount, infantsCount]);

  // Fetch Outbound Schedules
  useEffect(() => {
    const fetchOutbound = async () => {
      setLoadingOutbound(true);
      setSearchError(null);
      try {
        const query = new URLSearchParams({
          origin: originCode,
          destination: destCode,
          date: dateParam,
          adults: String(adultsCount),
          infants: String(infantsCount),
        });
        const res = await fetch(`/api/search/schedules?${query.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal pergi');
        setOutboundResults(data.schedules || []);
      } catch (err: unknown) {
        setSearchError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setLoadingOutbound(false);
      }
    };

    fetchOutbound();
  }, [originCode, destCode, dateParam, adultsCount, infantsCount]);

  // Fetch Inbound Schedules if ROUND_TRIP
  useEffect(() => {
    if (tripType !== 'ROUND_TRIP' || !returnDateParam) return;

    const fetchInbound = async () => {
      setLoadingInbound(true);
      try {
        const query = new URLSearchParams({
          origin: destCode, // Swapped for return
          destination: originCode,
          date: returnDateParam,
          adults: String(adultsCount),
          infants: String(infantsCount),
        });
        const res = await fetch(`/api/search/schedules?${query.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal pulang');
        setInboundResults(data.schedules || []);
      } catch (err: unknown) {
        console.error('Fetch inbound error:', err);
      } finally {
        setLoadingInbound(false);
      }
    };

    fetchInbound();
  }, [originCode, destCode, returnDateParam, tripType, adultsCount, infantsCount]);

  // Handle Pick Outbound Schedule & Subclass
  const handleSelectOutbound = (schedule: ScheduleResult, fare: FareOption) => {
    setSelectedOutbound({ schedule, fare });
    if (tripType === 'ROUND_TRIP') {
      setActiveTripTab('INBOUND');
    }
  };

  // Handle Pick Inbound Schedule & Subclass
  const handleSelectInbound = (schedule: ScheduleResult, fare: FareOption) => {
    // Validate same-day departure time
    if (returnDateParam === dateParam && selectedOutbound) {
      if (schedule.origin_departure_time <= selectedOutbound.schedule.destination_arrival_time) {
        alert(
          `Jadwal kepulangan (${schedule.origin_departure_time} WIB) harus setelah jam tiba perjalanan pergi (${selectedOutbound.schedule.destination_arrival_time} WIB).`
        );
        return;
      }
    }
    setSelectedInbound({ schedule, fare });
  };

  // Quick Demo Auto-Fill Passengers
  const handleFillDemoData = () => {
    const demoAdults = [
      { name: 'Budi Santoso', identity_number: '1271021508890001', type: 'ADULT' as const },
      { name: 'Anisa Rahmawati', identity_number: '1271025509920002', type: 'ADULT' as const },
      { name: 'Dimas Prasetyo', identity_number: '1271031104950003', type: 'ADULT' as const },
      { name: 'Rina Marlina', identity_number: '1271042307980004', type: 'ADULT' as const },
    ];
    const demoInfants = [
      { name: 'Alif Santoso (Bayi)', identity_number: '1271022201240005', type: 'INFANT' as const },
      { name: 'Naila Rahma (Bayi)', identity_number: '1271022202240006', type: 'INFANT' as const },
    ];

    const filled: PassengerInput[] = [];
    for (let i = 0; i < adultsCount; i++) {
      filled.push(demoAdults[i % demoAdults.length]);
    }
    for (let j = 0; j < infantsCount; j++) {
      filled.push(demoInfants[j % demoInfants.length]);
    }
    setPassengers(filled);
    setContact({
      name: demoAdults[0].name,
      email: 'budi.santoso@example.com',
      phone: '081234567890',
    });
    setPassengerErrors(null);
  };

  // Validate Step 2 and proceed to Step 3 (Seat Map)
  const handleProceedToSeats = async () => {
    // 1. Check Contact Info
    if (!contact.name.trim() || !contact.email.trim() || !contact.phone.trim()) {
      setPassengerErrors('Mohon lengkapi Data Kontak Pemesan (Nama, Email, dan No. HP/WhatsApp).');
      return;
    }
    if (!contact.email.includes('@')) {
      setPassengerErrors('Format email pemesan tidak valid.');
      return;
    }

    // 2. Check all passenger fields
    for (let i = 0; i < adultsCount; i++) {
      const p = passengers[i];
      if (!p.name.trim() || !p.identity_number.trim()) {
        setPassengerErrors(`Mohon lengkapi Nama dan No. Identitas (NIK/NISN) Penumpang Dewasa #${i + 1}`);
        return;
      }
      if (p.identity_number.trim().length < 10) {
        setPassengerErrors(`No. Identitas Penumpang Dewasa #${i + 1} minimal 10 digit (NISN) atau 16 digit (NIK)`);
        return;
      }
    }

    setPassengerErrors(null);
    setCurrentStep(3);
    await loadSeatMaps();
  };

  // Load Seat Maps for Outbound and Inbound
  const loadSeatMaps = async () => {
    if (!selectedOutbound) return;
    setLoadingSeatMap(true);

    try {
      // 1. Fetch Outbound Seat Map
      const outOriginId = stations.find((s) => s.code === originCode)?.id;
      const outDestId = stations.find((s) => s.code === destCode)?.id;
      const outRes = await fetch(
        `/api/schedules/${selectedOutbound.schedule.schedule_id}/seat-map?origin_station_id=${outOriginId}&destination_station_id=${outDestId}&wagon_class=${selectedOutbound.fare.wagon_class}`
      );
      const outData = await outRes.json();
      if (outData.wagons) {
        setOutboundWagons(outData.wagons);
        setSelectedOutboundWagonId(outData.wagons[0]?.id || 0);
      }

      // 2. Fetch Inbound Seat Map if ROUND_TRIP
      if (tripType === 'ROUND_TRIP' && selectedInbound) {
        const inRes = await fetch(
          `/api/schedules/${selectedInbound.schedule.schedule_id}/seat-map?origin_station_id=${outDestId}&destination_station_id=${outOriginId}&wagon_class=${selectedInbound.fare.wagon_class}`
        );
        const inData = await inRes.json();
        if (inData.wagons) {
          setInboundWagons(inData.wagons);
          setSelectedInboundWagonId(inData.wagons[0]?.id || 0);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load seat map:', err);
    } finally {
      setLoadingSeatMap(false);
    }
  };

  // Handle Seat Click in Interactive Seat Map
  const handleSeatClick = (seat: SeatItem) => {
    if (seat.status !== 'AVAILABLE') return;

    if (activeLegForSeats === 'OUTBOUND') {
      const copy = { ...outboundSeatAssignments };
      copy[activePassengerIdx] = { wagon_id: selectedOutboundWagonId, seat_number: seat.seat_number };
      setOutboundSeatAssignments(copy);

      // Auto advance to next adult passenger if any unassigned
      const nextIdx = (activePassengerIdx + 1) % adultsCount;
      setActivePassengerIdx(nextIdx);
    } else {
      const copy = { ...inboundSeatAssignments };
      copy[activePassengerIdx] = { wagon_id: selectedInboundWagonId, seat_number: seat.seat_number };
      setInboundSeatAssignments(copy);

      const nextIdx = (activePassengerIdx + 1) % adultsCount;
      setActivePassengerIdx(nextIdx);
    }
  };

  // Calculate Total Bill
  const outboundTotal = (selectedOutbound?.fare.adult_price || 0) * adultsCount;
  const inboundTotal = tripType === 'ROUND_TRIP' ? (selectedInbound?.fare.adult_price || 0) * adultsCount : 0;
  const grandTotal = outboundTotal + inboundTotal;

  // Check if all adult seats assigned
  const allOutboundSeatsAssigned = Array.from({ length: adultsCount }).every(
    (_, i) => outboundSeatAssignments[i]?.seat_number
  );
  const allInboundSeatsAssigned =
    tripType === 'ONE_WAY' ||
    Array.from({ length: adultsCount }).every((_, i) => inboundSeatAssignments[i]?.seat_number);

  const canProceedToPayment = allOutboundSeatsAssigned && allInboundSeatsAssigned;

  // Handle Lock Seats & Proceed to Payment
  const handleLockSeatsAndProceed = async () => {
    if (!canProceedToPayment || !selectedOutbound) return;
    setIsLockingSeats(true);
    setBookingError(null);

    try {
      const outOrigin = stations.find((s) => s.code === originCode);
      const outDest = stations.find((s) => s.code === destCode);
      if (!outOrigin || !outDest) {
        throw new Error('Data stasiun keberangkatan / tujuan tidak valid.');
      }

      const departureSeats = passengers
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p.type === 'ADULT')
        .map(({ idx }) => outboundSeatAssignments[idx]);

      interface BookingPayload {
        trip_type: 'ONE_WAY' | 'ROUND_TRIP';
        contact: {
          name: string;
          email: string;
          phone: string;
        };
        departure_segment: {
          schedule_id: number;
          origin_station_id: number;
          destination_station_id: number;
          wagon_class: string;
          subclass: string;
          seats: Array<{ wagon_id: number; seat_number: string }>;
        };
        return_segment?: {
          schedule_id: number;
          origin_station_id: number;
          destination_station_id: number;
          wagon_class: string;
          subclass: string;
          seats: Array<{ wagon_id: number; seat_number: string }>;
        };
        passengers: PassengerInput[];
      }

      const payload: BookingPayload = {
        trip_type: tripType,
        contact,
        departure_segment: {
          schedule_id: selectedOutbound.schedule.schedule_id,
          origin_station_id: outOrigin.id,
          destination_station_id: outDest.id,
          wagon_class: selectedOutbound.fare.wagon_class,
          subclass: selectedOutbound.fare.subclass,
          seats: departureSeats,
        },
        passengers,
      };

      if (tripType === 'ROUND_TRIP' && selectedInbound) {
        const returnSeats = passengers
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => p.type === 'ADULT')
          .map(({ idx }) => inboundSeatAssignments[idx]);

        payload.return_segment = {
          schedule_id: selectedInbound.schedule.schedule_id,
          origin_station_id: outDest.id,
          destination_station_id: outOrigin.id,
          wagon_class: selectedInbound.fare.wagon_class,
          subclass: selectedInbound.fare.subclass,
          seats: returnSeats,
        };
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setBookingError(
            `KURSUS TERKUNCI / BENTROK: ${data.error}. Silakan pilih nomor kursi lain yang masih tersedia.`
          );
          // Auto refresh seat map so newly locked seat updates visually
          await loadSeatMaps();
        } else {
          setBookingError(data.error || 'Gagal memproses penguncian kursi.');
        }
        return;
      }

      // Success! Redirect to checkout page
      router.push(data.redirect_url || `/checkout/${data.invoice_number}`);
    } catch (err: unknown) {
      setBookingError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mengunci kursi.');
    } finally {
      setIsLockingSeats(false);
    }
  };

  // Active Wagon in Seat Map
  const currentWagonsList = activeLegForSeats === 'OUTBOUND' ? outboundWagons : inboundWagons;
  const currentSelectedWagonId = activeLegForSeats === 'OUTBOUND' ? selectedOutboundWagonId : selectedInboundWagonId;
  const activeWagon = currentWagonsList.find((w) => w.id === currentSelectedWagonId) || currentWagonsList[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <StorefrontNavbar />

      {/* Top Search Overview Bar */}
      <section className="bg-slate-900 text-white py-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sky-400 text-sm">{originCode}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono font-bold text-sky-400 text-sm">{destCode}</span>
            </div>

            <span className="text-slate-500">&bull;</span>
            <span className="font-mono text-slate-300">Pergi: {dateParam}</span>
            {tripType === 'ROUND_TRIP' && (
              <>
                <span className="text-slate-500">&bull;</span>
                <span className="font-mono text-slate-300">Pulang: {returnDateParam}</span>
              </>
            )}
            <span className="text-slate-500">&bull;</span>
            <span className="text-slate-300">
              {adultsCount} Dewasa {infantsCount > 0 ? `, ${infantsCount} Bayi` : ''}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800">
              {tripType === 'ROUND_TRIP' ? 'PULANG-PERGI' : 'SEKALI JALAN'}
            </span>
          </div>

          <button
            onClick={() => setIsModifySearchOpen(!isModifySearchOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-sky-400" />
            <span>{isModifySearchOpen ? 'Tutup Form' : 'Ubah Pencarian'}</span>
          </button>
        </div>

        {/* Collapsible Modify Search Drawer */}
        {isModifySearchOpen && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
            <SearchWidget
              stations={stations}
              initialOrigin={originCode}
              initialDestination={destCode}
              initialDate={dateParam}
              initialReturnDate={returnDateParam}
              initialTripType={tripType}
              initialAdults={adultsCount}
              initialInfants={infantsCount}
              compact
            />
          </div>
        )}
      </section>

      {/* Stepper Progress Header */}
      <div className="bg-white border-b border-slate-200 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-6 text-xs overflow-x-auto">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-1.5 font-bold transition-colors ${
                currentStep === 1 ? 'text-sky-600' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                1
              </span>
              <span>1. Pilih Tiket</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

            <button
              disabled={!selectedOutbound || (tripType === 'ROUND_TRIP' && !selectedInbound)}
              onClick={() => setCurrentStep(2)}
              className={`flex items-center gap-1.5 font-bold transition-colors disabled:opacity-40 ${
                currentStep === 2 ? 'text-sky-600' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === 2 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                2
              </span>
              <span>2. Data Penumpang</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

            <button
              disabled={!selectedOutbound}
              onClick={() => setCurrentStep(3)}
              className={`flex items-center gap-1.5 font-bold transition-colors disabled:opacity-40 ${
                currentStep === 3 ? 'text-sky-600' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === 3 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                3
              </span>
              <span>3. Pilih Kursi (Seat Map)</span>
            </button>
          </div>

          {/* Mini Sticky Price Tracker */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="text-slate-500">Estimasi Tagihan:</span>
            <span className="font-mono font-bold text-base text-orange-600">
              {formatIDR(grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* ========================================================================= */}
        {/* STEP 1: PILIH JADWAL TIKET (ONE-WAY ATAU ROUND-TRIP STATE MACHINE) */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {searchError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* 2-Step Round-Trip Selection Header Tray */}
            {tripType === 'ROUND_TRIP' && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTripTab('OUTBOUND')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    activeTripTab === 'OUTBOUND'
                      ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-500/20'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                      Langkah 1: Perjalanan Pergi
                    </span>
                    {selectedOutbound && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Terpilih
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="font-mono">{originCode}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{destCode}</span>
                    <span className="text-slate-500 font-normal">({dateParam})</span>
                  </div>
                  {selectedOutbound ? (
                    <div className="text-[11px] text-sky-800 font-medium mt-1">
                      {selectedOutbound.schedule.fleet_name} &bull; {selectedOutbound.fare.wagon_class} ({selectedOutbound.fare.subclass}) &bull;{' '}
                      <strong className="font-mono">{formatIDR(selectedOutbound.fare.adult_price)}</strong>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 mt-1 italic">Silakan pilih jadwal keberangkatan di bawah</div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTripTab('INBOUND')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    activeTripTab === 'INBOUND'
                      ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-500/20'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                      Langkah 2: Perjalanan Pulang
                    </span>
                    {selectedInbound && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Terpilih
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="font-mono">{destCode}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{originCode}</span>
                    <span className="text-slate-500 font-normal">({returnDateParam})</span>
                  </div>
                  {selectedInbound ? (
                    <div className="text-[11px] text-sky-800 font-medium mt-1">
                      {selectedInbound.schedule.fleet_name} &bull; {selectedInbound.fare.wagon_class} ({selectedInbound.fare.subclass}) &bull;{' '}
                      <strong className="font-mono">{formatIDR(selectedInbound.fare.adult_price)}</strong>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 mt-1 italic">
                      {selectedOutbound ? 'Silakan pilih jadwal kepulangan' : 'Pilih tiket pergi terlebih dahulu'}
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Schedule Cards Section */}
            {activeTripTab === 'OUTBOUND' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Jadwal Keberangkatan Pergi: {originCode} &rarr; {destCode} ({dateParam})
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    {outboundResults.length} Jadwal Tersedia
                  </span>
                </div>

                {loadingOutbound ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
                    <RefreshCw className="w-5 h-5 text-sky-600 animate-spin mx-auto mb-2" />
                    Mencari jadwal terbaik...
                  </div>
                ) : outboundResults.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                    Tidak ada jadwal operasional pada tanggal dan rute ini.
                  </div>
                ) : (
                  outboundResults.map((sched) => (
                    <ScheduleCard
                      key={sched.schedule_id}
                      schedule={sched}
                      originCode={originCode}
                      destCode={destCode}
                      selectedFareId={selectedOutbound?.schedule.schedule_id === sched.schedule_id ? selectedOutbound.fare.fare_id : null}
                      onSelectFare={(fare) => handleSelectOutbound(sched, fare)}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Jadwal Perjalanan Pulang: {destCode} &rarr; {originCode} ({returnDateParam})
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    {inboundResults.length} Jadwal Tersedia
                  </span>
                </div>

                {loadingInbound ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
                    <RefreshCw className="w-5 h-5 text-sky-600 animate-spin mx-auto mb-2" />
                    Mencari jadwal kepulangan...
                  </div>
                ) : inboundResults.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                    Tidak ada jadwal kepulangan pada tanggal ini.
                  </div>
                ) : (
                  inboundResults.map((sched) => (
                    <ScheduleCard
                      key={sched.schedule_id}
                      schedule={sched}
                      originCode={destCode}
                      destCode={originCode}
                      selectedFareId={selectedInbound?.schedule.schedule_id === sched.schedule_id ? selectedInbound.fare.fare_id : null}
                      onSelectFare={(fare) => handleSelectInbound(sched, fare)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Sticky Action Footer to Advance to Step 2 */}
            {selectedOutbound && (tripType === 'ONE_WAY' || selectedInbound) && (
              <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl p-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <div className="text-xs text-slate-500">
                      Tiket Terpilih:{' '}
                      <strong className="text-slate-800">
                        {tripType === 'ROUND_TRIP' ? 'Pulang-Pergi (2 Tiket)' : 'Sekali Jalan (1 Tiket)'}
                      </strong>
                    </div>
                    <div className="text-lg font-mono font-extrabold text-orange-600">
                      {formatIDR(grandTotal)}
                      <span className="text-xs font-sans font-normal text-slate-500"> ({adultsCount} Dewasa)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentStep(2)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-orange-600 hover:bg-orange-700 text-white shadow-lg transition-all"
                  >
                    Lanjut Isi Data Penumpang &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: ISI DATA PENUMPANG */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-sky-600" />
                  Data Penumpang Kereta / Bus
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pastikan nama sesuai kartu identitas resmi (KTP / Paspor / Kartu Pelajar).
                </p>
              </div>

              <button
                type="button"
                onClick={handleFillDemoData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Isi Cepat Data Demo</span>
              </button>
            </div>

            {passengerErrors && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passengerErrors}</span>
              </div>
            )}

            {/* Contact Information Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Data Kontak Pemesan (Penerima E-Ticket & Notifikasi)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tiket elektronik resmi dan kode pembayaran 15 menit akan dikirim ke kontak ini.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Pemesan *
                  </label>
                  <input
                    type="text"
                    required
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. Handphone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Passenger Forms */}
            <div className="space-y-4">
              {passengers.map((p, idx) => {
                const isAdult = p.type === 'ADULT';
                const adultIdx = isAdult ? idx + 1 : idx - adultsCount + 1;

                return (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                            isAdult ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          P{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {isAdult ? `Penumpang Dewasa #${adultIdx}` : `Penumpang Bayi #${adultIdx} (Pangku)`}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {isAdult ? 'Dapat Jatah Kursi' : 'Tanpa Kursi (Rp 0)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nama Lengkap Sesuai Identitas *
                        </label>
                        <input
                          type="text"
                          required
                          value={p.name}
                          onChange={(e) => {
                            const copy = [...passengers];
                            copy[idx].name = e.target.value;
                            setPassengers(copy);
                          }}
                          placeholder={isAdult ? 'Contoh: Budi Santoso' : 'Nama Lengkap Bayi'}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isAdult ? 'Nomor Identitas (NIK 16 Digit / NISN 10 Digit) *' : 'Tanggal Lahir / NIK Bayi *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={p.identity_number}
                          onChange={(e) => {
                            const copy = [...passengers];
                            copy[idx].identity_number = e.target.value;
                            setPassengers(copy);
                          }}
                          placeholder={isAdult ? 'Contoh: 1271021508890001' : 'Contoh: 2024-02-15'}
                          className="w-full px-3 py-2 text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                &larr; Kembali ke Pilihan Jadwal
              </button>

              <button
                type="button"
                onClick={handleProceedToSeats}
                className="px-6 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-all"
              >
                Lanjut ke Pemilihan Kursi (Seat Map) &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: INTERACTIVE WAGON SEAT MAP */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Header with Switcher if ROUND_TRIP */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Train className="w-5 h-5 text-sky-600" />
                  Pilih Kursi Gerbong Interaktif (Persis KAI Access)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik nama penumpang aktif, lalu klik kursi kosong untuk menentukan nomor tempat duduk.
                </p>
              </div>

              {tripType === 'ROUND_TRIP' && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg text-xs">
                  <button
                    onClick={() => setActiveLegForSeats('OUTBOUND')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                      activeLegForSeats === 'OUTBOUND'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Segmen Pergi ({originCode} &rarr; {destCode})
                  </button>
                  <button
                    onClick={() => setActiveLegForSeats('INBOUND')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                      activeLegForSeats === 'INBOUND'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Segmen Pulang ({destCode} &rarr; {originCode})
                  </button>
                </div>
              )}
            </div>

            {/* Error Notification Banner (e.g. 409 Conflict Double-Booking) */}
            {bookingError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-sm text-rose-950">Gagal Mengunci Kursi (Bentrok Jadwal / Double-Booking)</div>
                  <div className="mt-0.5 text-rose-800">{bookingError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingError(null)}
                  className="text-rose-500 hover:text-rose-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Passenger Selector Tray */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700">Pilih Penumpang untuk Menempatkan Kursi:</div>
              <div className="flex items-center gap-2 flex-wrap">
                {passengers
                  .filter((p) => p.type === 'ADULT')
                  .map((p, idx) => {
                    const assignment =
                      activeLegForSeats === 'OUTBOUND'
                        ? outboundSeatAssignments[idx]
                        : inboundSeatAssignments[idx];

                    const isAssigned = Boolean(assignment?.seat_number);
                    const isActive = activePassengerIdx === idx;

                    return (
                      <button
                        key={idx}
                        onClick={() => setActivePassengerIdx(idx)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                            : isAssigned
                            ? 'bg-sky-50 text-sky-900 border-sky-300'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            isActive ? 'bg-white text-sky-700' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          P{idx + 1}
                        </span>
                        <span>{p.name || `Penumpang ${idx + 1}`}</span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            isActive ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {assignment?.seat_number ? `Kursi ${assignment.seat_number}` : 'Pilih Kursi'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Seat Map Area */}
            {loadingSeatMap ? (
              <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 text-sky-600 animate-spin mx-auto mb-2" />
                Memuat konfigurasi gerbong dan ketersediaan kursi...
              </div>
            ) : !activeWagon ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
                Data gerbong tidak ditemukan.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Wagon Selector Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {currentWagonsList.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        if (activeLegForSeats === 'OUTBOUND') setSelectedOutboundWagonId(w.id);
                        else setSelectedInboundWagonId(w.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all shrink-0 ${
                        w.id === activeWagon.id
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {w.wagon_code} ({w.available_seats} Kosong)
                    </button>
                  ))}
                </div>

                {/* Seat Map Legend */}
                <div className="flex items-center justify-center gap-6 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
                    <span className="text-slate-600">Tersedia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-sky-600 text-white font-mono text-[9px] flex items-center justify-center font-bold">
                      P1
                    </div>
                    <span className="text-slate-600">Dipilih Anda</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-amber-100 border border-amber-400" />
                    <span className="text-slate-600">Terkunci (Pending)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-slate-200" />
                    <span className="text-slate-600">Terisi (Booked)</span>
                  </div>
                </div>

                {/* Interactive Wagon Visualizer Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl mx-auto overflow-x-auto">
                  {/* Direction of vehicle indicator */}
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-400 mb-6 pb-2 border-b-2 border-dashed border-slate-200">
                    ⬆️ ARAH LAJU KENDARAAN (DEPAN)
                  </div>

                  {/* Seat Grid */}
                  <div className="space-y-2.5 min-w-[320px]">
                    {activeWagon.seat_rows.map((row) => (
                      <div key={row.row_number} className="flex items-center justify-between gap-4">
                        {/* Left Seats */}
                        <div className="flex items-center gap-2">
                          {row.left_seats.map((seat) => {
                            // Check if this seat is chosen by any passenger in current leg
                            const assignments =
                              activeLegForSeats === 'OUTBOUND'
                                ? outboundSeatAssignments
                                : inboundSeatAssignments;

                            const assignedPassengerEntry = Object.entries(assignments).find(
                              ([_, val]) => val.wagon_id === activeWagon.id && val.seat_number === seat.seat_number
                            );

                            const isSelectedByMe = Boolean(assignedPassengerEntry);
                            const assignedPassengerIdx = assignedPassengerEntry ? Number(assignedPassengerEntry[0]) : null;

                            return (
                              <button
                                key={seat.seat_number}
                                type="button"
                                disabled={seat.status !== 'AVAILABLE'}
                                onClick={() => handleSeatClick(seat)}
                                className={`w-10 h-10 rounded-lg text-xs font-mono font-bold transition-all flex flex-col items-center justify-center ${
                                  isSelectedByMe
                                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400'
                                    : seat.status === 'AVAILABLE'
                                    ? 'bg-white border border-slate-300 hover:border-sky-500 hover:bg-sky-50 text-slate-800'
                                    : seat.status === 'LOCKED'
                                    ? 'bg-amber-100 border border-amber-300 text-amber-700 cursor-not-allowed opacity-70'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isSelectedByMe ? (
                                  <>
                                    <span className="text-[9px] font-sans">P{assignedPassengerIdx! + 1}</span>
                                    <span>{seat.seat_number}</span>
                                  </>
                                ) : (
                                  <span>{seat.seat_number}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Central Aisle */}
                        <div className="text-[10px] font-mono text-slate-300 px-2 select-none">
                          {row.row_number}
                        </div>

                        {/* Right Seats */}
                        <div className="flex items-center gap-2">
                          {row.right_seats.map((seat) => {
                            const assignments =
                              activeLegForSeats === 'OUTBOUND'
                                ? outboundSeatAssignments
                                : inboundSeatAssignments;

                            const assignedPassengerEntry = Object.entries(assignments).find(
                              ([_, val]) => val.wagon_id === activeWagon.id && val.seat_number === seat.seat_number
                            );

                            const isSelectedByMe = Boolean(assignedPassengerEntry);
                            const assignedPassengerIdx = assignedPassengerEntry ? Number(assignedPassengerEntry[0]) : null;

                            return (
                              <button
                                key={seat.seat_number}
                                type="button"
                                disabled={seat.status !== 'AVAILABLE'}
                                onClick={() => handleSeatClick(seat)}
                                className={`w-10 h-10 rounded-lg text-xs font-mono font-bold transition-all flex flex-col items-center justify-center ${
                                  isSelectedByMe
                                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400'
                                    : seat.status === 'AVAILABLE'
                                    ? 'bg-white border border-slate-300 hover:border-sky-500 hover:bg-sky-50 text-slate-800'
                                    : seat.status === 'LOCKED'
                                    ? 'bg-amber-100 border border-amber-300 text-amber-700 cursor-not-allowed opacity-70'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isSelectedByMe ? (
                                  <>
                                    <span className="text-[9px] font-sans">P{assignedPassengerIdx! + 1}</span>
                                    <span>{seat.seat_number}</span>
                                  </>
                                ) : (
                                  <span>{seat.seat_number}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rear indicator */}
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-400 mt-6 pt-2 border-t-2 border-dashed border-slate-200">
                    ⬇️ PINTU BELAKANG / BORDES
                  </div>
                </div>
              </div>
            )}

            {/* Sticky Summary Bar & Submit */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-xs text-slate-500">Status Penempatan Kursi:</div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-3">
                  <span>
                    Pergi:{' '}
                    <strong className={allOutboundSeatsAssigned ? 'text-emerald-700' : 'text-amber-700'}>
                      {Object.keys(outboundSeatAssignments).length}/{adultsCount} Kursi
                    </strong>
                  </span>
                  {tripType === 'ROUND_TRIP' && (
                    <span>
                      Pulang:{' '}
                      <strong className={allInboundSeatsAssigned ? 'text-emerald-700' : 'text-amber-700'}>
                        {Object.keys(inboundSeatAssignments).length}/{adultsCount} Kursi
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  &larr; Data Penumpang
                </button>

                <button
                  type="button"
                  disabled={!canProceedToPayment || isLockingSeats}
                  onClick={handleLockSeatsAndProceed}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 shadow-md transition-all"
                >
                  {isLockingSeats ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengunci Kursi 15 Menit...</span>
                    </>
                  ) : (
                    <>
                      <span>Kunci Kursi & Lanjut ke Pembayaran</span>
                      <span>&rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Subcomponent: Schedule Card with Subclass Pills
function ScheduleCard({
  schedule,
  originCode,
  destCode,
  selectedFareId,
  onSelectFare,
}: {
  schedule: ScheduleResult;
  originCode: string;
  destCode: string;
  selectedFareId: number | null;
  onSelectFare: (fare: FareOption) => void;
}) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
      {/* Top Details */}
      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            {schedule.fleet_type === 'TRAIN' ? <Train className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">{schedule.fleet_name}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                {schedule.fleet_code}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{schedule.route_name}</div>
          </div>
        </div>

        {/* Departure, Duration, Arrival */}
        <div className="flex items-center gap-4 text-center">
          <div>
            <div className="text-base font-mono font-extrabold text-slate-900">
              {schedule.origin_departure_time}
            </div>
            <div className="text-[10px] font-mono font-bold text-sky-700">{originCode}</div>
          </div>

          <div className="flex flex-col items-center px-2">
            <span className="text-[10px] text-slate-500 font-mono">{schedule.duration_formatted}</span>
            <div className="w-16 border-t border-slate-300 my-1 relative">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-600 absolute right-0 -top-0.5" />
            </div>
            <span className="text-[9px] text-emerald-600 font-semibold">Langsung</span>
          </div>

          <div>
            <div className="text-base font-mono font-extrabold text-slate-900">
              {schedule.destination_arrival_time}
              {schedule.days_added > 0 && <span className="text-[10px] text-amber-600 ml-0.5">+1h</span>}
            </div>
            <div className="text-[10px] font-mono font-bold text-sky-700">{destCode}</div>
          </div>
        </div>
      </div>

      {/* Subclasses and Fares Row */}
      <div className="p-4 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold text-slate-700">Pilih Kelas & Subclass Tiket:</div>
        <div className="flex items-center gap-2 flex-wrap">
          {schedule.fares.map((fare) => {
            const isSelected = selectedFareId === fare.fare_id;
            const isSoldOut = fare.available_seats <= 0;

            return (
              <button
                key={fare.fare_id}
                type="button"
                disabled={isSoldOut}
                onClick={() => onSelectFare(fare)}
                className={`px-3 py-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-400'
                    : isSoldOut
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-sky-400 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span>{fare.wagon_class}</span>
                  <span
                    className={`px-1 rounded text-[9px] font-mono ${
                      isSelected ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Sub {fare.subclass}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold mt-0.5">
                  {formatIDR(fare.adult_price)}
                </div>
                <div
                  className={`text-[9px] font-mono mt-0.5 ${
                    isSelected
                      ? 'text-sky-100'
                      : isSoldOut
                      ? 'text-rose-500'
                      : fare.available_seats <= 10
                      ? 'text-amber-600 font-semibold'
                      : 'text-emerald-700'
                  }`}
                >
                  {isSoldOut ? 'Habis' : `Sisa ${fare.available_seats} kursi`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
