'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Train,
  Bus,
  Clock,
  Radio,
  ArrowRight,
  RefreshCw,
  Tv,
  ChevronLeft,
  Calendar,
  Sparkles,
  Volume2,
  VolumeX,
  Megaphone,
} from 'lucide-react';

interface FidsItem {
  schedule_id: number;
  departure_time: string;
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  route_name: string;
  stops_sequence: string;
  destination_name: string;
  gate_info: string;
  booked_count: number;
  boarded_count: number;
  status: 'BOARDING' | 'OPEN' | 'DELAYED' | 'DEPARTED' | string;
}

interface StationOption {
  id: number;
  code: string;
  name: string;
  city: string;
}

export function FidsClient() {
  const [items, setItems] = useState<FidsItem[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Digital Real-time Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Auto-Refresh Countdown (15s)
  const [countdown, setCountdown] = useState<number>(15);

  // Station TOA Voice Announcer State
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [autoAnnounce, setAutoAnnounce] = useState(false);
  const [announcementToast, setAnnouncementToast] = useState<string | null>(null);
  const announcedScheduleIdsRef = useRef<Set<number>>(new Set());

  // Digital Clock Updater (every 1 second)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio API: Station Two-Tone Harmonic Chime (C5 523.25Hz -> E5 659.25Hz)
  const playStationChime = (): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          resolve();
          return;
        }
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;

        // Tone 1: C5 (523.25 Hz) with gentle exponential decay
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.65);

        // Tone 2: E5 (659.25 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.38);
        gain2.gain.setValueAtTime(0.001, now + 0.38);
        gain2.gain.exponentialRampToValueAtTime(0.38, now + 0.43);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.38);
        osc2.stop(now + 1.25);

        setTimeout(() => {
          try {
            ctx.close();
          } catch {}
          resolve();
        }, 1300);
      } catch {
        resolve();
      }
    });
  };

  // Trigger TOA Voice Announcement for a schedule
  const handleAnnounce = async (targetItem?: FidsItem) => {
    if (isAnnouncing) return;

    // Pick target: Provided item OR first BOARDING OR next upcoming schedule
    const item =
      targetItem ||
      items.find((i) => i.status === 'BOARDING') ||
      items.find((i) => i.status === 'OPEN') ||
      items[0];

    if (!item) {
      setAnnouncementToast('Belum ada jadwal keberangkatan aktif saat ini.');
      setTimeout(() => setAnnouncementToast(null), 4000);
      return;
    }

    setIsAnnouncing(true);

    // Clean destination city name
    const rawDest = item.destination_name;
    const destCity = rawDest.includes(' - ') ? rawDest.split(' - ')[1] : rawDest;
    const gateText = item.gate_info ? `melalui ${item.gate_info}` : 'melalui jalur keberangkatan';

    const announcementText = `Perhatian, para penumpang ${item.fleet_name} tujuan ${destCity}, kereta Anda akan segera diberangkatkan ${gateText}. Harap persiapkan tiket dan kartu identitas Anda. Terima kasih.`;

    setAnnouncementToast(announcementText);

    // 1. Play Station Chime Jingle
    await playStationChime();

    // 2. Speak via Web Speech API (Indonesian)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(announcementText);
        utterance.lang = 'id-ID';
        utterance.rate = 0.92;
        utterance.pitch = 1.05;

        // Search for Indonesian voice
        const voices = window.speechSynthesis.getVoices();
        const idVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
        if (idVoice) utterance.voice = idVoice;

        utterance.onend = () => {
          setIsAnnouncing(false);
          setTimeout(() => setAnnouncementToast(null), 3000);
        };
        utterance.onerror = () => {
          setIsAnnouncing(false);
          setTimeout(() => setAnnouncementToast(null), 3000);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('TTS error:', err);
        setIsAnnouncing(false);
        setTimeout(() => setAnnouncementToast(null), 4000);
      }
    } else {
      // Fallback if browser doesn't support TTS
      setTimeout(() => {
        setIsAnnouncing(false);
        setAnnouncementToast(null);
      }, 5000);
    }
  };

  // Fetch FIDS Data
  const fetchFids = async (stationCode?: string) => {
    try {
      const url = new URL('/api/fids', window.location.origin);
      if (stationCode) url.searchParams.set('station_code', stationCode);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        const fetchedItems = data.items || [];
        setItems(fetchedItems);
        if (data.stations) setStations(data.stations);

        // Auto-Announce first new BOARDING schedule if enabled
        if (autoAnnounce && !isAnnouncing) {
          const boardingItem = fetchedItems.find(
            (i: FidsItem) => i.status === 'BOARDING' && !announcedScheduleIdsRef.current.has(i.schedule_id)
          );
          if (boardingItem) {
            announcedScheduleIdsRef.current.add(boardingItem.schedule_id);
            handleAnnounce(boardingItem);
          }
        }
      }
    } catch (err) {
      console.error('Fetch FIDS failed:', err);
    } finally {
      setLoading(false);
      setCountdown(15);
    }
  };

  useEffect(() => {
    fetchFids(selectedStation);
  }, [selectedStation]);

  // Auto-Refresh Interval (every 15 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchFids(selectedStation);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedStation]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Station TOA Broadcast Banner (Visual & Audio Feedback) */}
      {announcementToast && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/50 px-4 py-3 text-center text-xs font-mono text-amber-200 flex items-center justify-center gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Megaphone className={`w-4 h-4 text-amber-400 ${isAnnouncing ? 'animate-bounce' : ''}`} />
            <span className="font-extrabold text-amber-400">[PENGUMUMAN TOA STASIUN]:</span>
          </div>
          <span className="font-sans font-medium text-amber-100">{announcementToast}</span>
          {isAnnouncing && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="w-1.5 h-3 bg-amber-400 animate-pulse rounded-full"></span>
              <span className="w-1.5 h-5 bg-amber-300 animate-pulse delay-75 rounded-full"></span>
              <span className="w-1.5 h-3 bg-amber-400 animate-pulse delay-150 rounded-full"></span>
            </div>
          )}
        </div>
      )}

      {/* Top Utility Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali ke Storefront</span>
          </Link>
          <span className="text-slate-700">|</span>
          <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold">
            <Tv className="w-3.5 h-3.5" />
            <span>Smart TV FIDS Terminal Display</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Live Sync</span>
            <span className="font-mono text-slate-200">({countdown}s)</span>
          </div>

          <button
            type="button"
            onClick={() => fetchFids(selectedStation)}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Manual"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Airport / Railway Station LED Header Board */}
      <header className="border-b-2 border-slate-800 bg-slate-950 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Papan Informasi Keberangkatan (FIDS)
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentDateStr}
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>JADWAL KEBERANGKATAN</span>
              <span className="text-amber-400">&bull;</span>
              <span className="text-sky-400">DEPARTURES</span>
            </div>

            <div className="text-xs text-slate-400">
              SMK TraveLoka &bull; Hub Terpadu Kereta Api & Bus Pariwisata Sumatera Utara
            </div>
          </div>

          {/* Clock & Station Filter Control + TOA Voice Button */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
            {/* Station Dropdown */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Lokasi Stasiun / Hub
              </label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full sm:w-56 px-3 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="">Semua Stasiun & Hub</option>
                {stations.map((st) => (
                  <option key={st.id} value={st.code}>
                    {st.code} - {st.name} ({st.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Big LED Digital Clock */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 text-center sm:text-right shrink-0 shadow-inner">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                WAKTU SERVER (WIB)
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-wider">
                {currentTime || '00:00:00'}
              </div>
            </div>
          </div>
        </div>

        {/* TOA Station Announcer Quick Action Strip */}
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleAnnounce()}
              disabled={isAnnouncing}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 shadow-md cursor-pointer ${
                isAnnouncing
                  ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/40 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 shadow-amber-500/20'
              }`}
            >
              <Megaphone className={`w-4 h-4 ${isAnnouncing ? 'animate-bounce' : ''}`} />
              <span>{isAnnouncing ? 'Menyiarkan Pengumuman TOA...' : '📢 Bunyikan Pengumuman Stasiun (TOA)'}</span>
            </button>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={autoAnnounce}
                onChange={(e) => setAutoAnnounce(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-400 cursor-pointer"
              />
              <span>Otomatis Siarkan Saat Ada Jadwal Boarding</span>
            </label>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Web Audio Chime C5/E5 &bull; TTS Bahasa Indonesia</span>
          </div>
        </div>
      </header>

      {/* Main FIDS LED Board */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex-1 w-full space-y-4">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
            <div>Menghubungkan ke server informasi jadwal stasiun...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">
              Tidak ada jadwal keberangkatan aktif pada stasiun ini hari ini.
            </div>
            <div className="text-xs text-slate-500">
              Silakan pilih &quot;Semua Stasiun & Hub&quot; pada menu dropdown di atas.
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-2">JAM (WIB)</div>
              <div className="col-span-3">ARMADA & KODE</div>
              <div className="col-span-4">RUTE & PEMBERHENTIAN</div>
              <div className="col-span-1 text-center">PERON</div>
              <div className="col-span-2 text-right">STATUS & AKSI</div>
            </div>

            {/* Departure Rows */}
            <div className="divide-y divide-slate-800/80">
              {items.map((item) => {
                const isTrain = item.fleet_type === 'TRAIN';
                const isBoarding = item.status === 'BOARDING';
                const isDelayed = item.status === 'DELAYED';
                const isDeparted = item.status === 'DEPARTED';

                return (
                  <div
                    key={item.schedule_id}
                    className={`grid grid-cols-12 gap-3 px-5 py-4 items-center transition-colors ${
                      isBoarding
                        ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                        : isDelayed
                        ? 'bg-rose-950/20 hover:bg-rose-950/30'
                        : 'hover:bg-slate-850/60'
                    }`}
                  >
                    {/* Departure Time */}
                    <div className="col-span-2">
                      <div className="font-mono text-xl sm:text-2xl font-extrabold text-amber-400 tracking-tight">
                        {item.departure_time}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">WIB</div>
                    </div>

                    {/* Fleet Name & Code */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-slate-800 text-sky-400 flex items-center justify-center shrink-0">
                          {isTrain ? <Train className="w-3.5 h-3.5" /> : <Bus className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-white leading-tight">
                            {item.fleet_name}
                          </div>
                          <div className="text-[11px] font-mono font-bold text-sky-400 mt-0.5">
                            {item.fleet_code}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Route Destination & Intermediate Stops */}
                    <div className="col-span-4 space-y-1">
                      <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                        <span>Tujuan:</span>
                        <span className="text-amber-300 font-extrabold">{item.destination_name}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {item.stops_sequence}
                      </div>
                    </div>

                    {/* Gate / Platform */}
                    <div className="col-span-1 text-center">
                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono font-extrabold text-sky-400 text-xs sm:text-sm">
                        {item.gate_info}
                      </span>
                    </div>

                    {/* Status Badge & Boarding Count & Per-Row TOA Button */}
                    <div className="col-span-2 text-right space-y-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnnounce(item)}
                          title={`Bunyikan Pengumuman Suara TOA untuk ${item.fleet_name}`}
                          className="p-1 rounded-md bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 hover:text-amber-200 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>TOA</span>
                        </button>

                        {isBoarding ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500 animate-pulse">
                            BOARDING
                          </span>
                        ) : isDelayed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500 animate-pulse">
                            DELAYED
                          </span>
                        ) : isDeparted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-slate-800 text-slate-500">
                            DEPARTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-sky-500/20 text-sky-400 border border-sky-500">
                            OPEN
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-slate-400">
                        Boarded: <strong className="text-slate-200">{item.boarded_count}</strong>/{item.booked_count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer LED Running Marquee */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pemberitahuan Penumpang: Pintu boarding gerbang stasiun ditutup 5 menit sebelum keberangkatan.</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            FIDS System &bull; Laboratorium Praktik Usaha Layanan Pariwisata (ULP)
          </div>
        </div>
      </footer>
    </div>
  );
}
