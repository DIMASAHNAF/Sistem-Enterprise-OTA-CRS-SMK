'use client';

import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Calculator,
  Train,
  Bus,
  ArrowRight,
  Filter,
  DollarSign,
  Tag,
  Trash2,
  Edit2,
  RefreshCw,
} from 'lucide-react';

interface RouteOption {
  id: number;
  route_name: string;
  direction: 'OUTBOUND' | 'INBOUND';
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  total_stops: number;
}

interface ScheduleItem {
  id: number;
  route_id: number;
  route_name: string;
  direction: 'OUTBOUND' | 'INBOUND';
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  departure_date: string;
  base_departure_time: string;
  status: 'OPEN' | 'CLOSED' | 'DELAYED' | 'DEPARTED';
  gate_info: string | null;
  total_fares: number;
  total_stops: number;
}

interface FareItem {
  id: number;
  schedule_id: number;
  origin_station_id: number;
  destination_station_id: number;
  wagon_class: string;
  subclass: string;
  price: number;
  quota: number;
  origin_code: string;
  origin_name: string;
  origin_city: string;
  dest_code: string;
  dest_name: string;
  dest_city: string;
  origin_order: number;
  dest_order: number;
}

interface Props {
  initialSchedules: ScheduleItem[];
  routes: RouteOption[];
}

export default function SchedulesRevenueClient({ initialSchedules, routes }: Props) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(initialSchedules);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  // Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Create Schedule Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRouteId, setCreateRouteId] = useState<number>(routes[0]?.id || 0);
  const [createDate, setCreateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createTime, setCreateTime] = useState<string>('08:00');
  const [createGate, setCreateGate] = useState<string>('Jalur 1 / Gate A');
  const [createExecBase, setCreateExecBase] = useState<number>(240000);
  const [createBusBase, setCreateBusBase] = useState<number>(170000);
  const [createEconBase, setCreateEconBase] = useState<number>(130000);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Manage Fares Modal
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [faresList, setFaresList] = useState<FareItem[]>([]);
  const [loadingFares, setLoadingFares] = useState(false);
  const [fareClassFilter, setFareClassFilter] = useState<string>('ALL');
  const [fareSearch, setFareSearch] = useState<string>('');
  const [savingFares, setSavingFares] = useState(false);

  // Bulk Calculator Inputs
  const [showBulkCalc, setShowBulkCalc] = useState(false);
  const [bulkExecPrice, setBulkExecPrice] = useState<number>(240000);
  const [bulkBusPrice, setBulkBusPrice] = useState<number>(170000);
  const [bulkEconPrice, setBulkEconPrice] = useState<number>(130000);
  const [bulkPromoDiscount, setBulkPromoDiscount] = useState<number>(15);
  const [bulkCalculating, setBulkCalculating] = useState(false);

  // Filtered Schedules
  const filteredSchedules = schedules.filter((s) => {
    const matchSearch =
      s.route_name.toLowerCase().includes(search.toLowerCase()) ||
      s.fleet_name.toLowerCase().includes(search.toLowerCase()) ||
      s.fleet_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
    const matchDirection = filterDirection === 'ALL' || s.direction === filterDirection;
    const matchDate = !filterDate || s.departure_date === filterDate;
    return matchSearch && matchStatus && matchDirection && matchDate;
  });

  // Handle open fares modal
  const handleOpenFares = async (sched: ScheduleItem) => {
    setSelectedSchedule(sched);
    setLoadingFares(true);
    setShowBulkCalc(false);
    try {
      const res = await fetch(`/api/revenue/schedules/${sched.id}/fares`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat tarif segmen');
      setFaresList(data.fares || []);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memuat tarif');
    } finally {
      setLoadingFares(false);
    }
  };

  // Handle Fare Value Change in Table
  const handleFareChange = (id: number, field: 'price' | 'quota', val: number) => {
    setFaresList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: Math.max(0, val) } : f))
    );
  };

  // Submit manual fare edits
  const handleSaveFares = async () => {
    if (!selectedSchedule) return;
    setSavingFares(true);
    try {
      const payload = {
        fares: faresList.map((f) => ({
          id: f.id,
          price: f.price,
          quota: f.quota,
        })),
      };
      const res = await fetch(`/api/revenue/schedules/${selectedSchedule.id}/fares`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tarif');
      showNotification('Perubahan matriks tarif berhasil disimpan!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSavingFares(false);
    }
  };

  // Submit Bulk Calculator
  const handleRunBulkCalculator = async () => {
    if (!selectedSchedule) return;
    setBulkCalculating(true);
    try {
      const payload = {
        bulk_calculator: {
          executive_base_price: Number(bulkExecPrice),
          business_base_price: Number(bulkBusPrice),
          economy_base_price: Number(bulkEconPrice),
          promo_discount_percent: Number(bulkPromoDiscount),
        },
      };
      const res = await fetch(`/api/revenue/schedules/${selectedSchedule.id}/fares`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal kalkulasi bulk');

      // Refresh fares
      const refRes = await fetch(`/api/revenue/schedules/${selectedSchedule.id}/fares`);
      const refData = await refRes.json();
      if (refData.fares) setFaresList(refData.fares);

      showNotification('Kalkulasi tarif otomatis seluruh segmen berhasil diterapkan!');
      setShowBulkCalc(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal kalkulasi bulk');
    } finally {
      setBulkCalculating(false);
    }
  };

  // Submit Create Schedule
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/revenue/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: Number(createRouteId),
          departure_date: createDate,
          base_departure_time: createTime,
          gate_info: createGate,
          base_executive_fare: Number(createExecBase),
          base_business_fare: Number(createBusBase),
          base_economy_fare: Number(createEconBase),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuka jadwal');

      // Refresh schedules
      const ref = await fetch('/api/revenue/schedules');
      const refData = await ref.json();
      if (refData.schedules) setSchedules(refData.schedules);

      setIsCreateOpen(false);
      showNotification(data.message || 'Jadwal dan matriks tarif kombinatorial berhasil dibuka!');
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Quick Update Status
  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      const res = await fetch('/api/revenue/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status');

      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus as ScheduleItem['status'] } : s))
      );
      showNotification(`Status jadwal berhasil diubah ke ${newStatus}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Yakin ingin menghapus jadwal ini beserta seluruh matriks tarifnya?')) return;
    try {
      const res = await fetch(`/api/revenue/schedules?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus jadwal');

      setSchedules((prev) => prev.filter((s) => s.id !== id));
      showNotification('Jadwal berhasil dihapus');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  // Filter fares in modal
  const filteredFares = faresList.filter((f) => {
    const matchClass = fareClassFilter === 'ALL' || f.wagon_class === fareClassFilter;
    const matchSearch =
      f.origin_code.toLowerCase().includes(fareSearch.toLowerCase()) ||
      f.dest_code.toLowerCase().includes(fareSearch.toLowerCase()) ||
      f.origin_name.toLowerCase().includes(fareSearch.toLowerCase()) ||
      f.dest_name.toLowerCase().includes(fareSearch.toLowerCase()) ||
      f.subclass.toLowerCase().includes(fareSearch.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-600" />
            Jadwal Operasional & Matriks Tarif Segmen Kombinatorial
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pembukaan jadwal keberangkatan, generator otomatis seluruh pasangan stasiun Asal &rarr; Tujuan (
            <span className="font-mono text-sky-700">N(N-1)/2</span> segmen), subclass (<span className="font-mono">A/H, C/P</span>), dan kalkulator tarif massal.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Buka Jadwal & Generate Matriks Tarif
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari rute atau armada..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Date Filter */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline"
            >
              Reset Tgl
            </button>
          )}

          {/* Direction Filter */}
          <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFilterDirection('ALL')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filterDirection === 'ALL' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterDirection('OUTBOUND')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filterDirection === 'OUTBOUND' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-500'
              }`}
            >
              OUTBOUND
            </button>
            <button
              onClick={() => setFilterDirection('INBOUND')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filterDirection === 'INBOUND' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-500'
              }`}
            >
              INBOUND
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="OPEN">OPEN (Terbuka)</option>
            <option value="DELAYED">DELAYED (Tertunda)</option>
            <option value="CLOSED">CLOSED (Ditutup)</option>
            <option value="DEPARTED">DEPARTED (Berangkat)</option>
          </select>
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-xs text-slate-500">Tidak ada jadwal yang cocok dengan filter yang dipilih.</p>
          </div>
        ) : (
          filteredSchedules.map((sched) => (
            <div
              key={sched.id}
              className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
            >
              {/* Header Card */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono tracking-wider ${
                        sched.direction === 'OUTBOUND'
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {sched.direction}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {sched.fleet_type === 'TRAIN' ? (
                        <Train className="w-3 h-3 text-sky-600" />
                      ) : (
                        <Bus className="w-3 h-3 text-amber-600" />
                      )}
                      <span className="font-mono">{sched.fleet_code}</span> &bull; {sched.fleet_name}
                    </span>

                    <h2 className="text-sm font-bold text-slate-900">{sched.route_name}</h2>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Tanggal:{' '}
                      <strong className="font-mono text-slate-900">{sched.departure_date}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      Berangkat Awal:{' '}
                      <strong className="font-mono text-sky-700 font-bold">
                        {sched.base_departure_time} WIB
                      </strong>
                    </span>
                    <span>
                      Gate / Peron:{' '}
                      <strong className="text-slate-800">{sched.gate_info || '-'}</strong>
                    </span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-500">
                      Stasiun Transit:{' '}
                      <strong className="font-mono text-slate-800">{sched.total_stops} titik</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Status Dropdown */}
                  <select
                    value={sched.status}
                    onChange={(e) => handleUpdateStatus(sched.id, e.target.value)}
                    className={`px-2 py-1 rounded text-[11px] font-bold border ${
                      sched.status === 'OPEN'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : sched.status === 'DELAYED'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : sched.status === 'DEPARTED'
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    <option value="OPEN">OPEN (Aktif)</option>
                    <option value="DELAYED">DELAYED (Tertunda)</option>
                    <option value="CLOSED">CLOSED (Ditutup)</option>
                    <option value="DEPARTED">DEPARTED (Berangkat)</option>
                  </select>

                  <button
                    onClick={() => handleOpenFares(sched)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Matriks Tarif & Bulk Calc ({sched.total_fares})</span>
                  </button>

                  <button
                    onClick={() => handleDeleteSchedule(sched.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Hapus Jadwal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: Create New Schedule */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  Buka Jadwal Keberangkatan & Matriks Tarif Otomatis
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sistem otomatis menghasilkan seluruh kombinasi segmen perjalanan Asal &rarr; Tujuan.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Select Route */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Rute Berarah *</label>
                <select
                  value={createRouteId}
                  onChange={(e) => setCreateRouteId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.direction}] {r.route_name} ({r.fleet_name} - {r.total_stops} stasiun)
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Keberangkatan *</label>
                  <input
                    type="date"
                    required
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Berangkat Awal (WIB) *</label>
                  <input
                    type="time"
                    required
                    value={createTime}
                    onChange={(e) => setCreateTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Gate Info */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Informasi Peron / Gate / Jalur</label>
                <input
                  type="text"
                  value={createGate}
                  onChange={(e) => setCreateGate(e.target.value)}
                  placeholder="Contoh: Peron 2 / Jalur 1A"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Base Prices for Segment Generator */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Tarif Dasar Rute Penuh (Untuk Auto-Calculator Segmen)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Eksekutif (A)</label>
                    <input
                      type="number"
                      step={5000}
                      value={createExecBase}
                      onChange={(e) => setCreateExecBase(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Bisnis (B)</label>
                    <input
                      type="number"
                      step={5000}
                      value={createBusBase}
                      onChange={(e) => setCreateBusBase(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Ekonomi (C)</label>
                    <input
                      type="number"
                      step={5000}
                      value={createEconBase}
                      onChange={(e) => setCreateEconBase(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Subclass promo (H, P, K) akan otomatis dihitung 85% dari subclass reguler dan kuota dibagi proporsional.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 transition-colors"
                >
                  {createSubmitting ? 'Memproses...' : 'Buka Jadwal Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Combinatorial Fare Matrix & Bulk Calculator */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full my-6 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedSchedule.direction === 'OUTBOUND'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedSchedule.direction}
                  </span>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Matriks Tarif Segmen: {selectedSchedule.route_name}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tanggal: <strong className="font-mono">{selectedSchedule.departure_date}</strong> &bull; Jam:{' '}
                  <strong className="font-mono text-sky-700">{selectedSchedule.base_departure_time} WIB</strong> &bull; Total Tarif: {faresList.length} baris
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkCalc(!showBulkCalc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{showBulkCalc ? 'Tutup Auto-Calc' : 'Bulk Fare / Auto-Calculator'}</span>
                </button>

                <button
                  onClick={() => setSelectedSchedule(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Bulk Calculator Drawer / Panel */}
            {showBulkCalc && (
              <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-700" />
                    Auto-Calculator Tarif Berbasis Proporsi Waktu Segmen
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Kalkulasi otomatis seluruh pasangan stasiun tanpa input manual satu per satu
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Tarif Penuh Eksekutif (Rp)
                    </label>
                    <input
                      type="number"
                      step={5000}
                      value={bulkExecPrice}
                      onChange={(e) => setBulkExecPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Tarif Penuh Bisnis (Rp)
                    </label>
                    <input
                      type="number"
                      step={5000}
                      value={bulkBusPrice}
                      onChange={(e) => setBulkBusPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Tarif Penuh Ekonomi (Rp)
                    </label>
                    <input
                      type="number"
                      step={5000}
                      value={bulkEconPrice}
                      onChange={(e) => setBulkEconPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Diskon Subclass Promo (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={bulkPromoDiscount}
                      onChange={(e) => setBulkPromoDiscount(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={bulkCalculating}
                    onClick={handleRunBulkCalculator}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${bulkCalculating ? 'animate-spin' : ''}`} />
                    <span>{bulkCalculating ? 'Mengkalkulasi...' : 'Terapkan Kalkulasi ke Seluruh Segmen'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fareSearch}
                  onChange={(e) => setFareSearch(e.target.value)}
                  placeholder="Filter stasiun atau subclass..."
                  className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={fareClassFilter}
                  onChange={(e) => setFareClassFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="ALL">Semua Kelas</option>
                  <option value="EXECUTIVE">EXECUTIVE</option>
                  <option value="BUSINESS">BUSINESS</option>
                  <option value="ECONOMY">ECONOMY</option>
                </select>

                <span className="text-xs text-slate-500 font-mono">
                  Menampilkan {filteredFares.length} baris
                </span>
              </div>
            </div>

            {/* Fares Matrix Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingFares ? (
                <div className="py-12 text-center text-xs text-slate-500">Memuat matriks tarif...</div>
              ) : filteredFares.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Tidak ada tarif yang sesuai dengan filter.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2 text-center w-12">#</th>
                        <th className="px-3 py-2">Pasangan Segmen Stasiun</th>
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2 text-center">Subclass</th>
                        <th className="px-3 py-2 w-44">Tarif Tiket (Rp)</th>
                        <th className="px-3 py-2 w-32">Alokasi Kuota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFares.map((f, idx) => (
                        <tr key={f.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-bold text-sky-700">{f.origin_code}</span>
                              <span className="text-slate-400">&rarr;</span>
                              <span className="font-bold text-sky-700">{f.dest_code}</span>
                              <span className="text-[10px] text-slate-500 font-sans">
                                ({f.origin_city} &bull; {f.dest_city})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                f.wagon_class === 'EXECUTIVE'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : f.wagon_class === 'BUSINESS'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {f.wagon_class}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 border border-slate-200 text-slate-800">
                              {f.subclass}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-mono text-[11px]">Rp</span>
                              <input
                                type="number"
                                step={5000}
                                value={f.price}
                                onChange={(e) => handleFareChange(f.id, 'price', Number(e.target.value))}
                                className="w-28 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={f.quota}
                                onChange={(e) => handleFareChange(f.id, 'quota', Number(e.target.value))}
                                className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-emerald-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <span className="text-[10px] text-slate-500">Kursi</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Setiap mutasi tarif segmen dicatat pada audit log untuk kepatuhan revenue control.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={savingFares}
                  onClick={handleSaveFares}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                >
                  {savingFares ? 'Menyimpan...' : 'Simpan Perubahan Matriks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
