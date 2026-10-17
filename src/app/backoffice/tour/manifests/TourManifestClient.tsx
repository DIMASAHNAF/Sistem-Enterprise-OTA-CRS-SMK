'use client';

import React, { useState, useEffect } from 'react';
import {
  Bus,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Bed,
  Plus,
  Trash2,
  AlertCircle,
  X,
  Search,
  Filter,
  Volume2,
  CheckCheck,
} from 'lucide-react';

interface ManifestItem {
  id: number;
  tour_package_id: number;
  bus_name: string;
  seat_number: string;
  room_number?: string | null;
  user_id: number;
  checkpoint_1_status: number;
  checkpoint_2_status: number;
  checkpoint_3_status: number;
  cp1_label: 'PRESENT' | 'PENDING';
  cp2_label: 'PRESENT' | 'PENDING';
  cp3_label: 'PRESENT' | 'PENDING';
  user_name: string;
  user_identity: string;
  user_email: string;
  user_phone?: string;
}

interface BusSummary {
  bus_name: string;
  total_pax: number;
  cp1_present: number;
  cp2_present: number;
  cp3_present: number;
  absent_cp1: string[];
  absent_cp2: string[];
  absent_cp3: string[];
}

interface RoomSummary {
  room_number: string;
  occupants: Array<{
    id: number;
    user_name: string;
    user_identity: string;
    bus_name: string;
    seat_number: string;
  }>;
}

interface UserOption {
  id: number;
  name: string;
  identity_number: string;
  role: string;
}

interface TourPackageOption {
  id: number;
  title: string;
  destination: string;
  duration_days: number;
}

export function TourManifestClient({
  packages,
  availableUsers,
}: {
  packages: TourPackageOption[];
  availableUsers: UserOption[];
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<number>(
    packages.length > 0 ? packages[0].id : 1
  );

  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [busSummary, setBusSummary] = useState<BusSummary[]>([]);
  const [roomSummary, setRoomSummary] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'allocation' | 'rooms'>('attendance');

  // Allocation Form State
  const [selectedUserId, setSelectedUserId] = useState<number>(
    availableUsers.length > 0 ? availableUsers[0].id : 0
  );
  const [busName, setBusName] = useState('Bus 1 - Jetbus 5 ULP-01');
  const [seatNumber, setSeatNumber] = useState('1A');
  const [roomNumber, setRoomNumber] = useState('Kamar 101');

  // Search & Filter
  const [filterBus, setFilterBus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCheckpoint, setActiveCheckpoint] = useState<1 | 2 | 3>(1);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Play audio tone on click
  const playAudioTone = (freq = 880) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio not permitted or supported
    }
  };

  // Fetch manifests when package changes
  const loadManifests = (pkgId: number) => {
    setLoading(true);
    fetch(`/api/tour/manifests?tour_package_id=${pkgId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.manifests) {
          setManifests(data.manifests);
          setBusSummary(data.bus_summary || []);
          setRoomSummary(data.room_summary || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedPackageId) {
      loadManifests(selectedPackageId);
    }
  }, [selectedPackageId]);

  // Handle single attendance toggle
  const handleToggleCheckpoint = async (manifestId: number, cpNum: 1 | 2 | 3, currentVal: number) => {
    const newVal = currentVal === 1 ? 0 : 1;
    playAudioTone(newVal === 1 ? 880 : 440);

    try {
      const res = await fetch(`/api/tour/manifests/${manifestId}/checkpoint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkpoint_num: cpNum,
          status: newVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status absensi');

      // Refresh manifests
      loadManifests(selectedPackageId);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Handle bulk attendance (Tandai Semua Hadir di Bus Ini)
  const handleBulkAttendance = async (busNameTarget: string, cpNum: 1 | 2 | 3) => {
    playAudioTone(1046);
    try {
      const res = await fetch('/api/tour/manifests/bulk-checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_package_id: selectedPackageId,
          bus_name: busNameTarget,
          checkpoint_num: cpNum,
          status: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui rombongan');

      setFeedback({ type: 'success', message: data.message });
      loadManifests(selectedPackageId);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Handle seat & room allocation
  const handleAssignParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setFeedback({ type: 'error', message: 'Pilih peserta terlebih dahulu.' });
      return;
    }

    try {
      const res = await fetch('/api/tour/manifests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_package_id: selectedPackageId,
          user_id: selectedUserId,
          bus_name: busName,
          seat_number: seatNumber.trim().toUpperCase(),
          room_number: roomNumber.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengalokasikan kursi peserta');

      setFeedback({ type: 'success', message: 'Peserta berhasil dialokasikan ke bus & kamar!' });
      loadManifests(selectedPackageId);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Handle remove manifest
  const handleDeleteManifest = async (manifestId: number) => {
    try {
      const res = await fetch(`/api/tour/manifests?manifest_id=${manifestId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus alokasi');

      setFeedback({ type: 'success', message: 'Alokasi peserta berhasil dihapus.' });
      loadManifests(selectedPackageId);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const filteredManifests = manifests.filter((m) => {
    const matchBus = filterBus === 'ALL' || m.bus_name === filterBus;
    const matchQuery =
      searchQuery === '' ||
      m.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.seat_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.room_number && m.room_number.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchBus && matchQuery;
  });

  const uniqueBuses = Array.from(new Set(manifests.map((m) => m.bus_name)));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
              Operasional Kunjungan Industri (KI)
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-medium">Tour Leader & Boarding Officer</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Bus className="w-5 h-5 text-sky-600" />
            <span>Manajemen Bus, Kamar Hotel & Absensi Checkpoint Rombongan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola alokasi nomor kursi bus, rooming list hotel, dan absensi tour leader pada 3 titik kumpul perjalanan.
          </p>
        </div>

        {/* Package Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Pilih Paket:</label>
          <select
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(Number(e.target.value))}
            className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.destination})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Tour Leader Checkpoint Attendance</span>
        </button>

        <button
          onClick={() => setActiveTab('allocation')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'allocation'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bus className="w-4 h-4" />
          <span>Alokasi Kursi Bus & Manifest ({manifests.length} Peserta)</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'rooms'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bed className="w-4 h-4" />
          <span>Rooming List Hotel ({roomSummary.length} Kamar)</span>
        </button>
      </div>

      {/* TAB 1: ATTENDANCE CONSOLE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Checkpoint selector pills */}
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pilih Titik Kumpul (Checkpoint):
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveCheckpoint(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeCheckpoint === 1
                    ? 'bg-sky-500 text-white shadow-sm ring-2 ring-sky-400/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                1. Keberangkatan (Sekolah)
              </button>
              <button
                onClick={() => setActiveCheckpoint(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeCheckpoint === 2
                    ? 'bg-sky-500 text-white shadow-sm ring-2 ring-sky-400/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                2. Rest Area / Transit
              </button>
              <button
                onClick={() => setActiveCheckpoint(3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeCheckpoint === 3
                    ? 'bg-sky-500 text-white shadow-sm ring-2 ring-sky-400/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                3. Lokasi Kunjungan Industri
              </button>
            </div>
          </div>

          {/* Real-time Bus Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {busSummary.map((b) => {
              const presentCount =
                activeCheckpoint === 1
                  ? b.cp1_present
                  : activeCheckpoint === 2
                  ? b.cp2_present
                  : b.cp3_present;
              const absentList =
                activeCheckpoint === 1
                  ? b.absent_cp1
                  : activeCheckpoint === 2
                  ? b.absent_cp2
                  : b.absent_cp3;
              const pct = Math.round((presentCount / Math.max(1, b.total_pax)) * 100);

              return (
                <div
                  key={b.bus_name}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                        <Bus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{b.bus_name}</h3>
                        <div className="text-[11px] text-slate-500">
                          {presentCount} dari {b.total_pax} Siswa Hadir ({pct}%)
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBulkAttendance(b.bus_name, activeCheckpoint)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    >
                      &check; Tandai Semua Hadir
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        pct >= 100
                          ? 'w-full bg-emerald-500'
                          : pct >= 80
                          ? 'w-4/5 bg-sky-600'
                          : pct >= 60
                          ? 'w-3/5 bg-sky-600'
                          : pct >= 50
                          ? 'w-1/2 bg-sky-600'
                          : pct >= 40
                          ? 'w-2/5 bg-sky-600'
                          : pct >= 25
                          ? 'w-1/4 bg-sky-600'
                          : pct > 0
                          ? 'w-1/12 bg-sky-600'
                          : 'w-0 bg-sky-600'
                      }`}
                    />
                  </div>

                  {/* Absent students notice */}
                  {absentList.length > 0 ? (
                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                      <span className="font-bold text-amber-900">Belum Hadir ({absentList.length} Siswa):</span>{' '}
                      <span className="text-amber-800">{absentList.join(', ')}</span>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Semua siswa di armada ini telah hadir lengkap!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Attendance Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Checklist Kehadiran Siswa per Kursi
              </h3>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Cari nama siswa / kursi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none"
                />

                <select
                  value={filterBus}
                  onChange={(e) => setFilterBus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:outline-none"
                >
                  <option value="ALL">Semua Bus</option>
                  {uniqueBuses.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Kursi</th>
                    <th className="py-2.5 px-3">Armada Bus</th>
                    <th className="py-2.5 px-3">Nama Siswa / Peserta</th>
                    <th className="py-2.5 px-3">NISN / NIK</th>
                    <th className="py-2.5 px-3 text-center">CP1 (Sekolah)</th>
                    <th className="py-2.5 px-3 text-center">CP2 (Rest Area)</th>
                    <th className="py-2.5 px-3 text-center">CP3 (Objek Wisata)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredManifests.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-700 bg-sky-50/40">
                        {m.seat_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{m.bus_name}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{m.user_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{m.user_identity}</td>

                      {/* CP1 */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleCheckpoint(m.id, 1, m.checkpoint_1_status)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                            m.checkpoint_1_status === 1
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {m.checkpoint_1_status === 1 ? '✓ HADIR' : '— PENDING'}
                        </button>
                      </td>

                      {/* CP2 */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleCheckpoint(m.id, 2, m.checkpoint_2_status)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                            m.checkpoint_2_status === 1
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {m.checkpoint_2_status === 1 ? '✓ HADIR' : '— PENDING'}
                        </button>
                      </td>

                      {/* CP3 */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleCheckpoint(m.id, 3, m.checkpoint_3_status)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                            m.checkpoint_3_status === 1
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {m.checkpoint_3_status === 1 ? '✓ HADIR' : '— PENDING'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SEAT ALLOCATION & MANIFEST FORM */}
      {activeTab === 'allocation' && (
        <div className="space-y-6">
          {/* Assignment Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-sky-600" />
              <span>Tambah / Alokasikan Peserta ke Bus & Kamar</span>
            </h2>

            <form onSubmit={handleAssignParticipant} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Peserta / Siswa
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md focus:outline-none"
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.identity_number || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Armada Bus
                </label>
                <select
                  value={busName}
                  onChange={(e) => setBusName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md focus:outline-none"
                >
                  <option value="Bus 1 - Jetbus 5 ULP-01">Bus 1 - Jetbus 5 ULP-01</option>
                  <option value="Bus 2 - Scania K410IB ULP-02">Bus 2 - Scania K410IB ULP-02</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Kursi Bus
                </label>
                <input
                  type="text"
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  placeholder="1A"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-md focus:outline-none uppercase"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Kamar Hotel
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Kamar 101"
                  className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md focus:outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors"
                >
                  + Simpan
                </button>
              </div>
            </form>
          </div>

          {/* Manifest Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Daftar Manifest Peserta Terdaftar ({filteredManifests.length} Orang)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Kursi Bus</th>
                    <th className="py-2.5 px-3">Armada Bus</th>
                    <th className="py-2.5 px-3">Nama Siswa / Peserta</th>
                    <th className="py-2.5 px-3">NISN / NIK</th>
                    <th className="py-2.5 px-3">Kamar Hotel</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredManifests.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-700 bg-sky-50/40">
                        {m.seat_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{m.bus_name}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{m.user_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{m.user_identity}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{m.room_number || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteManifest(m.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROOMING LIST HOTEL */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Bed className="w-4 h-4 text-sky-600" />
                <span>Rooming List Hotel (Distribusi Kamar Peserta & Guru)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar pembagian kamar hotel untuk koordinasi dengan pihak resepsionis dan guru pendamping.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              🖨️ Cetak Rooming List
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roomSummary.map((r) => (
              <div
                key={r.room_number}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Bed className="w-4 h-4 text-sky-600" />
                    <span>{r.room_number}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {r.occupants.length} Penghuni
                  </span>
                </div>

                <div className="space-y-2">
                  {r.occupants.map((occ) => (
                    <div
                      key={occ.id}
                      className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{occ.user_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {occ.user_identity}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-sky-100 text-sky-800">
                          {occ.seat_number}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
