'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  QrCode,
  ShieldCheck,
  Camera,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Train,
  Bus,
  Clock,
  ArrowRight,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ManifestItem {
  id: number;
  full_name: string;
  identity_number: string;
  pax_type: string;
  seat_number: string | null;
  boarding_status: 'BOOKED' | 'CHECKED_IN' | 'BOARDED';
  checked_in_at: string | null;
  boarded_at: string | null;
  wagon_code?: string;
  wagon_class?: string;
  pnr_code: string;
  invoice_number: string;
  origin_code: string;
  dest_code: string;
}

interface ScheduleOption {
  id: number;
  departure_date: string;
  base_departure_time: string;
  status: string;
  gate_info: string | null;
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  route_name: string;
}

interface VerificationResult {
  status: 'SUCCESS' | 'INVALID_SIGNATURE' | 'ALREADY_BOARDED' | 'ERROR';
  message: string;
  passenger?: {
    id?: number;
    name: string;
    identity?: string;
    wagon?: string;
    seat?: string;
    pnr_code?: string;
    fleet?: string;
    route?: string;
    boarded_at?: string;
  };
}

function playAudioFeedback(type: 'success' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Audio might be blocked by browser policy
  }
}

export function BoardingScannerClient() {
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);

  // Audio mute toggle
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manifest Panel State
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number>(0);
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [stats, setStats] = useState({
    total_passengers: 0,
    checked_in_count: 0,
    boarded_count: 0,
    not_checked_in_count: 0,
  });
  const [loadingManifest, setLoadingManifest] = useState(false);

  // Load Initial Schedules & Manifest
  const loadManifest = async (schedId?: number) => {
    setLoadingManifest(true);
    try {
      const url = new URL('/api/boarding/manifest', window.location.origin);
      if (schedId) url.searchParams.set('schedule_id', String(schedId));

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setSchedules(data.schedules || []);
        setSelectedScheduleId(data.active_schedule_id || 0);
        setStats(data.stats || stats);
        setManifest(data.manifest || []);
      }
    } catch (err) {
      console.error('Failed to load manifest:', err);
    } finally {
      setLoadingManifest(false);
    }
  };

  useEffect(() => {
    loadManifest();
  }, []);

  // Handle Verify QR Payload
  const handleVerifyPayload = async (payloadToVerify?: string) => {
    const rawPayload = (payloadToVerify || tokenInput).trim();
    if (!rawPayload) return;

    setIsVerifying(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/boarding/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: rawPayload }),
      });

      const data = await res.json();

      if (res.status === 200) {
        if (!isAudioMuted) playAudioFeedback('success');
        setLastResult({
          status: 'SUCCESS',
          message: data.message || 'BOARDING DIIZINKAN — SILAKAN NAIK KE ARMADA',
          passenger: data.passenger,
        });
        setTokenInput('');
        // Refresh manifest table to reflect new BOARDED status
        loadManifest(selectedScheduleId);
      } else if (res.status === 409) {
        if (!isAudioMuted) playAudioFeedback('error');
        setLastResult({
          status: 'ALREADY_BOARDED',
          message: data.error,
          passenger: data.passenger,
        });
      } else if (res.status === 403) {
        if (!isAudioMuted) playAudioFeedback('error');
        setLastResult({
          status: 'INVALID_SIGNATURE',
          message: data.error,
        });
      } else {
        if (!isAudioMuted) playAudioFeedback('error');
        setLastResult({
          status: 'ERROR',
          message: data.error || 'Verifikasi gagal',
        });
      }
    } catch (err: unknown) {
      if (!isAudioMuted) playAudioFeedback('error');
      setLastResult({
        status: 'ERROR',
        message: err instanceof Error ? err.message : 'Kesalahan jaringan saat verifikasi.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Camera Management
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);

      // Check BarcodeDetector support
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const detectFrame = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const scannedValue = barcodes[0].rawValue;
              if (scannedValue && scannedValue.startsWith('ULP-BP')) {
                handleVerifyPayload(scannedValue);
              }
            }
          } catch {
            // Frame error
          }
          if (streamRef.current) {
            requestAnimationFrame(detectFrame);
          }
        };
        requestAnimationFrame(detectFrame);
      }
    } catch (err: unknown) {
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan atau gunakan input manual.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Aplikasi Gate Scanner & Manifest Boarding Petugas
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
              BOARDING_OFFICER
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verifikasi tanda tangan digital HMAC-SHA256, proteksi anti-passback, dan checklist manifest penumpang
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/backoffice/tour/manifests"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm transition-colors"
          >
            <Bus className="w-3.5 h-3.5 text-sky-600" />
            <span>Absen Bus KI &rarr;</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isAudioMuted
                ? 'bg-slate-100 text-slate-500 border-slate-300'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
            }`}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isAudioMuted ? 'Suara Senyap' : 'Suara Aktif'}</span>
          </button>

          <button
            type="button"
            onClick={isCameraActive ? stopCamera : startCamera}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isCameraActive
                ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                : 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isCameraActive ? 'Matikan Kamera' : 'Buka Kamera Scanner'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Left Verification & Scanner, Right Live Manifest */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================================= */}
        {/* LEFT: SCANNER CONSOLE & VERIFICATION RESULTS */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card: Live Scanner & Quick Token Input */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs tracking-tight">
                <QrCode className="w-4 h-4 text-sky-400" />
                <span>Konsol Pemindai Gate Masuk (HMAC-SHA256 Guard)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Mode Dual Input</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Camera Video Area */}
              {isCameraActive ? (
                <div className="relative w-full h-64 bg-slate-950 rounded-xl overflow-hidden border-2 border-sky-500 flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  {/* Overlay scanning viewfinder */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-dashed border-sky-400 rounded-xl animate-pulse" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded text-center text-[10px] text-sky-300 font-mono">
                    Arahkan QR Code Tiket ke Kotak Kamera
                  </div>
                </div>
              ) : (
                cameraError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )
              )}

              {/* Quick Input (Barcode Gun / Manual Token Paste) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyPayload();
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-bold text-slate-700">
                  Tempel Token QR / Scan dengan Barcode Gun USB *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Contoh: ULP-BP|R4UK6G|1|1|2A|9f8a..."
                    className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying || !tokenInput.trim()}
                    className="px-5 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 shadow-sm transition-all whitespace-nowrap flex items-center gap-1.5"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Verifikasi</span>
                  </button>
                </div>
                <div className="text-[10px] text-slate-400">
                  Tip: Barcode scanner USB akan otomatis menekan tombol Enter setelah memindai.
                </div>
              </form>
            </div>
          </div>

          {/* Verification Result Cards */}
          {lastResult && (
            <div className="animate-in fade-in">
              {lastResult.status === 'SUCCESS' && lastResult.passenger && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                          BOARDING DIIZINKAN &bull; VALID
                        </div>
                        <div className="text-sm font-extrabold text-emerald-800">
                          {lastResult.message}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                      {lastResult.passenger.boarded_at} WIB
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase">Nama Penumpang</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">
                        {lastResult.passenger.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        PNR: {lastResult.passenger.pnr_code}
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase">Gerbong</div>
                      <div className="text-xl font-mono font-extrabold text-slate-900 mt-0.5">
                        {lastResult.passenger.wagon}
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase">Nomor Kursi</div>
                      <div className="text-xl font-mono font-extrabold text-emerald-700 mt-0.5">
                        {lastResult.passenger.seat}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {lastResult.status === 'ALREADY_BOARDED' && (
                <div className="bg-amber-50 border-2 border-amber-500 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2.5 text-amber-950">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        PERINGATAN ANTI-PASSBACK
                      </div>
                      <div className="text-sm font-extrabold text-amber-950 mt-0.5">
                        {lastResult.message}
                      </div>
                    </div>
                  </div>
                  {lastResult.passenger && (
                    <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs space-y-1">
                      <div className="font-bold text-slate-900">Rincian Penumpang:</div>
                      <div className="text-slate-600">Nama: {lastResult.passenger.name}</div>
                      <div className="text-slate-600 font-mono">
                        Gerbong: {lastResult.passenger.wagon} &bull; Kursi: {lastResult.passenger.seat}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {lastResult.status === 'INVALID_SIGNATURE' && (
                <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-5 shadow-sm space-y-2">
                  <div className="flex items-center gap-2.5 text-rose-950">
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-700">
                        KEAMANAN KRIPTOGRAFI: DITOLAK
                      </div>
                      <div className="text-sm font-extrabold text-rose-950 mt-0.5">
                        {lastResult.message}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-rose-800">
                    Sistem mendeteksi bahwa QR Code ini tidak ditandatangani dengan secret key resmi SMK ULP atau telah dimanipulasi secara ilegal. Insiden ini telah dicatat ke audit log keamanan.
                  </div>
                </div>
              )}

              {lastResult.status === 'ERROR' && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{lastResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT: LIVE MANIFEST & PASSENGER CHECKLIST */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header with Schedule Selector */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>Manifest Keberangkatan Hari Ini</span>
                </div>

                <button
                  type="button"
                  onClick={() => loadManifest(selectedScheduleId)}
                  disabled={loadingManifest}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingManifest ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Schedule Dropdown */}
              <div>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedScheduleId(id);
                    loadManifest(id);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.base_departure_time} WIB &bull; {s.fleet_name} ({s.route_name}) &bull; Gate: {s.gate_info || '1'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Boarding Stats Counters */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Tiket</div>
                  <div className="text-base font-mono font-extrabold text-slate-900">
                    {stats.total_passengers}
                  </div>
                </div>

                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-sky-700 font-bold uppercase">Check-In</div>
                  <div className="text-base font-mono font-extrabold text-sky-700">
                    {stats.checked_in_count}
                  </div>
                </div>

                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Boarded</div>
                  <div className="text-base font-mono font-extrabold text-emerald-700">
                    {stats.boarded_count}
                  </div>
                </div>
              </div>
            </div>

            {/* Manifest List Table */}
            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100">
              {manifest.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada penumpang lunas pada jadwal ini.
                </div>
              ) : (
                manifest.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p.full_name}</span>
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-slate-100 text-slate-600">
                            {p.pax_type}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          PNR: {p.pnr_code} &bull; {p.origin_code} &rarr; {p.dest_code}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <div className="text-[10px] text-slate-400">Kursi</div>
                        <div className="font-bold text-slate-900">
                          {p.seat_number ? `${p.wagon_code || 'EKS'} / ${p.seat_number}` : 'PANGKU'}
                        </div>
                      </div>

                      <div>
                        {p.boarding_status === 'BOARDED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> BOARDED
                          </span>
                        ) : p.boarding_status === 'CHECKED_IN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                            <Clock className="w-3 h-3" /> CHECKED IN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            BOOKED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
