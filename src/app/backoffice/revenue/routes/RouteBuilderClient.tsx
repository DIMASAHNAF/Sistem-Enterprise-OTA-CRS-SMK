'use client';

import React, { useState } from 'react';
import {
  Plus,
  ArrowRight,
  ArrowLeftRight,
  Clock,
  MapPin,
  Train,
  Bus,
  CheckCircle2,
  AlertCircle,
  MoveUp,
  MoveDown,
  Trash2,
  X,
  Search,
  Layers,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface Station {
  id: number;
  code: string;
  name: string;
  city: string;
  type: string;
}

interface Fleet {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface RouteStop {
  id: number;
  route_id: number;
  station_id: number;
  stop_order: number;
  arrival_offset_minutes: number;
  departure_offset_minutes: number;
  station_code: string;
  station_name: string;
  station_city: string;
  station_type: string;
}

interface RouteItem {
  id: number;
  fleet_id: number;
  route_name: string;
  direction: 'OUTBOUND' | 'INBOUND';
  created_at: string;
  fleet_name: string;
  fleet_code: string;
  fleet_type: string;
  stops: RouteStop[];
}

interface Props {
  initialRoutes: RouteItem[];
  stations: Station[];
  fleets: Fleet[];
}

interface StopDraft {
  station_id: number;
  arrival_offset_minutes: number;
  departure_offset_minutes: number;
}

function formatMinutes(min: number): string {
  const hours = Math.floor(min / 60);
  const remMinutes = min % 60;
  if (hours === 0) return `${remMinutes}m`;
  if (remMinutes === 0) return `${hours}j`;
  return `${hours}j ${remMinutes}m`;
}

export default function RouteBuilderClient({ initialRoutes, stations, fleets }: Props) {
  const [routes, setRoutes] = useState<RouteItem[]>(initialRoutes);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');
  const [filterFleet, setFilterFleet] = useState<string>('ALL');

  // Modal State for New Route
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFleetId, setCreateFleetId] = useState<number>(fleets[0]?.id || 0);
  const [createDirection, setCreateDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [createRouteName, setCreateRouteName] = useState('');
  const [createStops, setCreateStops] = useState<StopDraft[]>([
    { station_id: stations[0]?.id || 0, arrival_offset_minutes: 0, departure_offset_minutes: 0 },
    { station_id: stations[1]?.id || 0, arrival_offset_minutes: 120, departure_offset_minutes: 120 },
  ]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Modal State for 1-Click Reverse
  const [reverseTarget, setReverseTarget] = useState<RouteItem | null>(null);
  const [reverseCustomName, setReverseCustomName] = useState('');
  const [reverseSubmitting, setReverseSubmitting] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  // Modal State for Detailed Timeline
  const [detailTarget, setDetailTarget] = useState<RouteItem | null>(null);

  // Success Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filter routes
  const filteredRoutes = routes.filter((r) => {
    const matchSearch =
      r.route_name.toLowerCase().includes(search.toLowerCase()) ||
      r.fleet_name.toLowerCase().includes(search.toLowerCase()) ||
      r.stops.some(
        (s) =>
          s.station_code.toLowerCase().includes(search.toLowerCase()) ||
          s.station_city.toLowerCase().includes(search.toLowerCase())
      );
    const matchDirection = filterDirection === 'ALL' || r.direction === filterDirection;
    const matchFleet = filterFleet === 'ALL' || String(r.fleet_id) === filterFleet;
    return matchSearch && matchDirection && matchFleet;
  });

  // Handle Add Stop to Draft
  const handleAddStopDraft = () => {
    const unusedStation = stations.find((s) => !createStops.some((draft) => draft.station_id === s.id)) || stations[0];
    const lastStop = createStops[createStops.length - 1];
    const nextArr = (lastStop?.departure_offset_minutes || 0) + 45;
    setCreateStops([
      ...createStops,
      {
        station_id: unusedStation.id,
        arrival_offset_minutes: nextArr,
        departure_offset_minutes: nextArr + 5,
      },
    ]);
  };

  // Reorder stops
  const handleMoveStop = (idx: number, direction: 'UP' | 'DOWN') => {
    const newIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= createStops.length) return;
    const copy = [...createStops];
    const temp = copy[idx];
    copy[idx] = copy[newIdx];
    copy[newIdx] = temp;
    // ensure first stop arrival is 0
    copy[0].arrival_offset_minutes = 0;
    setCreateStops(copy);
  };

  // Remove stop
  const handleRemoveStop = (idx: number) => {
    if (createStops.length <= 2) {
      alert('Rute wajib memiliki minimal 2 titik stasiun pemberhentian');
      return;
    }
    const updated = createStops.filter((_, i) => i !== idx);
    updated[0].arrival_offset_minutes = 0;
    setCreateStops(updated);
  };

  // Update stop draft property
  const handleUpdateStop = (idx: number, field: keyof StopDraft, value: number) => {
    const copy = [...createStops];
    copy[idx] = { ...copy[idx], [field]: value };
    if (idx === 0) copy[0].arrival_offset_minutes = 0;
    setCreateStops(copy);
  };

  // Validate create form live
  const validateCreateStops = (): string | null => {
    if (!createRouteName.trim()) return 'Nama rute wajib diisi';
    if (createStops.length < 2) return 'Rute harus memiliki minimal 2 titik stasiun';

    const stationIds = createStops.map((s) => s.station_id);
    if (new Set(stationIds).size !== stationIds.length) {
      return 'Stasiun pemberhentian tidak boleh duplikat dalam satu rute';
    }

    if (createStops[0].arrival_offset_minutes !== 0) {
      return 'Menit tiba stasiun awal harus 0';
    }

    for (let i = 0; i < createStops.length; i++) {
      const curr = createStops[i];
      if (curr.departure_offset_minutes < curr.arrival_offset_minutes) {
        return `Stasiun urutan #${i + 1}: Menit berangkat (${curr.departure_offset_minutes}m) tidak boleh lebih awal dari menit tiba (${curr.arrival_offset_minutes}m)`;
      }
      if (i > 0) {
        const prev = createStops[i - 1];
        if (curr.arrival_offset_minutes <= prev.departure_offset_minutes) {
          return `Stasiun urutan #${i + 1}: Menit tiba (${curr.arrival_offset_minutes}m) harus lebih besar dari menit berangkat stasiun #${i} (${prev.departure_offset_minutes}m)`;
        }
      }
    }
    return null;
  };

  // Submit Create Route
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateCreateStops();
    if (errorMsg) {
      setCreateError(errorMsg);
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/revenue/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleet_id: Number(createFleetId),
          route_name: createRouteName.trim(),
          direction: createDirection,
          stops: createStops.map((s, idx) => ({
            station_id: Number(s.station_id),
            stop_order: idx,
            arrival_offset_minutes: Number(s.arrival_offset_minutes),
            departure_offset_minutes: Number(s.departure_offset_minutes),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat rute');
      }

      // Refresh routes
      const refreshedRes = await fetch('/api/revenue/routes');
      const refreshedData = await refreshedRes.json();
      if (refreshedData.routes) {
        setRoutes(refreshedData.routes);
      }

      setIsCreateOpen(false);
      showNotification('Rute berarah dan timeline transit berhasil disimpan!');
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open 1-Click Reverse Modal
  const handleOpenReverse = (route: RouteItem) => {
    setReverseTarget(route);
    setReverseError(null);
    const revStops = [...route.stops].reverse();
    const firstCity = revStops[0]?.station_city || 'Origin';
    const lastCity = revStops[revStops.length - 1]?.station_city || 'Dest';
    setReverseCustomName(`${route.fleet_name} (${firstCity} - ${lastCity})`);
  };

  // Submit 1-Click Reverse
  const handleSubmitReverse = async () => {
    if (!reverseTarget) return;
    setReverseSubmitting(true);
    setReverseError(null);

    try {
      const res = await fetch(`/api/revenue/routes/${reverseTarget.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_name: reverseCustomName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membalik rute');
      }

      // Refresh routes list
      const refreshedRes = await fetch('/api/revenue/routes');
      const refreshedData = await refreshedRes.json();
      if (refreshedData.routes) {
        setRoutes(refreshedData.routes);
      }

      setReverseTarget(null);
      showNotification(data.message || 'Rute pulang berhasil digenerate otomatis!');
    } catch (err: unknown) {
      setReverseError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setReverseSubmitting(false);
    }
  };

  // Delete Route
  const handleDeleteRoute = async (routeId: number, routeName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus rute "${routeName}"?`)) return;

    try {
      const res = await fetch(`/api/revenue/routes?id=${routeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus rute');
      }

      setRoutes(routes.filter((r) => r.id !== routeId));
      showNotification(`Rute "${routeName}" berhasil dihapus`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus rute');
    }
  };

  const validationNotice = validateCreateStops();

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

      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            Route Builder & Multi-Station Timeline
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi rute berarah (<span className="font-mono text-sky-700">OUTBOUND</span> / <span className="font-mono text-emerald-700">INBOUND</span>), urutan stasiun singgah, offset menit tiba-berangkat, serta fitur <strong className="text-slate-700">1-Click Reverse Route</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsCreateOpen(true);
              setCreateError(null);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Rute Berarah Baru
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Rute Aktif</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">{routes.length}</span>
            <span className="text-xs text-slate-500">Jalur</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600">Rute Outbound (Pergi)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-sky-700">
              {routes.filter((r) => r.direction === 'OUTBOUND').length}
            </span>
            <span className="text-xs text-slate-500">Rute</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Rute Inbound (Pulang)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-emerald-700">
              {routes.filter((r) => r.direction === 'INBOUND').length}
            </span>
            <span className="text-xs text-slate-500">Rute</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stasiun & Hub Terdaftar</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">{stations.length}</span>
            <span className="text-xs text-slate-500">Titik</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari rute, armada, stasiun..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Direction Filter */}
          <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFilterDirection('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filterDirection === 'ALL' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua Arah
            </button>
            <button
              onClick={() => setFilterDirection('OUTBOUND')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filterDirection === 'OUTBOUND' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              OUTBOUND
            </button>
            <button
              onClick={() => setFilterDirection('INBOUND')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filterDirection === 'INBOUND' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              INBOUND
            </button>
          </div>

          {/* Fleet Filter */}
          <select
            value={filterFleet}
            onChange={(e) => setFilterFleet(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">Semua Armada</option>
            {fleets.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Routes List */}
      <div className="space-y-4">
        {filteredRoutes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-xs text-slate-500">Tidak ada rute yang cocok dengan kriteria filter.</p>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const firstStop = route.stops[0];
            const lastStop = route.stops[route.stops.length - 1];
            const totalMinutes = lastStop ? lastStop.arrival_offset_minutes : 0;

            return (
              <div
                key={route.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
              >
                {/* Route Header */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold font-mono tracking-wider ${
                        route.direction === 'OUTBOUND'
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {route.direction}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {route.fleet_type === 'TRAIN' ? (
                        <Train className="w-3 h-3 text-sky-600" />
                      ) : (
                        <Bus className="w-3 h-3 text-amber-600" />
                      )}
                      <span className="font-mono">{route.fleet_code}</span> &bull; {route.fleet_name}
                    </span>

                    <h2 className="text-sm font-bold text-slate-900">{route.route_name}</h2>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReverse(route)}
                      title="Generate Rute Pulang / Inbound Kebalikannya Secara Otomatis"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>1-Click Reverse</span>
                    </button>

                    <button
                      onClick={() => setDetailTarget(route)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors"
                    >
                      <span>Detail Timeline</span>
                    </button>

                    <button
                      onClick={() => handleDeleteRoute(route.id, route.route_name)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus Rute"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Route Visualizer Body */}
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-sky-600" />
                        {firstStop ? `${firstStop.station_name} (${firstStop.station_code})` : '-'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {lastStop ? `${lastStop.station_name} (${lastStop.station_code})` : '-'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <span>
                        Stasiun Transit:{' '}
                        <strong className="font-mono text-slate-800">{route.stops.length} Stasiun</strong>
                      </span>
                      <span>
                        Total Estimasi Perjalanan:{' '}
                        <strong className="font-mono text-sky-700 font-bold">{formatMinutes(totalMinutes)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Sequential Stop Beads */}
                  <div className="relative pt-2 pb-1 overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-max">
                      {route.stops.map((stop, sIdx) => {
                        const isFirst = sIdx === 0;
                        const isLast = sIdx === route.stops.length - 1;
                        const dwell = stop.departure_offset_minutes - stop.arrival_offset_minutes;

                        return (
                          <React.Fragment key={stop.id}>
                            <div className="flex flex-col items-center group relative">
                              <div
                                className={`px-2.5 py-1.5 rounded-lg border text-center transition-all ${
                                  isFirst
                                    ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-sm'
                                    : isLast
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                  <span className="font-mono text-slate-400 text-[10px]">#{sIdx + 1}</span>
                                  <span className="font-mono font-extrabold">{stop.station_code}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium truncate max-w-[90px]">
                                  {stop.station_city}
                                </div>
                                <div className="text-[10px] font-mono mt-0.5 text-slate-600">
                                  {isFirst ? (
                                    <span className="font-bold text-sky-700">00:00 (Dep)</span>
                                  ) : isLast ? (
                                    <span className="font-bold text-emerald-700">+{formatMinutes(stop.arrival_offset_minutes)}</span>
                                  ) : (
                                    <span>
                                      +{formatMinutes(stop.arrival_offset_minutes)}
                                      {dwell > 0 && (
                                        <span className="text-[9px] text-amber-600 block">stop {dwell}m</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!isLast && (
                              <div className="flex items-center px-1 text-slate-300">
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Create New Route */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full my-8 overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-sky-600" />
                  Rancang Rute Berarah & Timeline Transit Baru
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur urutan stasiun, offset waktu tiba (arrival), dan waktu berangkat transit stasiun.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-6">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-medium text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Armada Operasional *</label>
                  <select
                    value={createFleetId}
                    onChange={(e) => setCreateFleetId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {fleets.map((f) => (
                      <option key={f.id} value={f.id}>
                        [{f.type === 'TRAIN' ? 'KERETA' : 'BUS'}] {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Arah Trayek (Direction) *</label>
                  <select
                    value={createDirection}
                    onChange={(e) => setCreateDirection(e.target.value as 'OUTBOUND' | 'INBOUND')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="OUTBOUND">OUTBOUND (Pergi)</option>
                    <option value="INBOUND">INBOUND (Pulang)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Rute Perjalanan *</label>
                  <input
                    type="text"
                    required
                    value={createRouteName}
                    onChange={(e) => setCreateRouteName(e.target.value)}
                    placeholder="Contoh: Sribilah Utama (Medan - Rantau Prapat)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Stop Timeline Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      Urutan Stasiun & Offset Timeline Menit ({createStops.length} Titik)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Offset menit dihitung relatif dari stasiun keberangkatan pertama (stasiun #1 = 0 menit).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStopDraft}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Stasiun Singgah
                  </button>
                </div>

                {/* Stops Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2 text-center w-12">Urutan</th>
                        <th className="px-3 py-2">Stasiun / Hub</th>
                        <th className="px-3 py-2 w-32">Offset Tiba (Menit)</th>
                        <th className="px-3 py-2 w-32">Offset Berangkat (Menit)</th>
                        <th className="px-3 py-2 text-center w-24">Waktu Singgah</th>
                        <th className="px-3 py-2 text-right w-24">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {createStops.map((draft, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === createStops.length - 1;
                        const dwell = draft.departure_offset_minutes - draft.arrival_offset_minutes;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-500">
                              #{idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={draft.station_id}
                                onChange={(e) => handleUpdateStop(idx, 'station_id', Number(e.target.value))}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              >
                                {stations.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} - {s.name} ({s.city})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={isFirst}
                                  value={draft.arrival_offset_minutes}
                                  onChange={(e) =>
                                    handleUpdateStop(idx, 'arrival_offset_minutes', Number(e.target.value))
                                  }
                                  className={`w-20 px-2 py-1 text-xs font-mono font-bold border rounded focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                                    isFirst
                                      ? 'bg-slate-100 border-slate-200 text-slate-400'
                                      : 'bg-white border-slate-300 text-slate-900'
                                  }`}
                                />
                                <span className="text-[10px] text-slate-500">m</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.departure_offset_minutes}
                                  onChange={(e) =>
                                    handleUpdateStop(idx, 'departure_offset_minutes', Number(e.target.value))
                                  }
                                  className="w-20 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                                <span className="text-[10px] text-slate-500">m</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  dwell < 0
                                    ? 'bg-rose-100 text-rose-700'
                                    : dwell === 0
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {dwell < 0 ? 'Invalid' : `${dwell}m`}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={() => handleMoveStop(idx, 'UP')}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                  title="Pindah ke Atas"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLast}
                                  onClick={() => handleMoveStop(idx, 'DOWN')}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                  title="Pindah ke Bawah"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStop(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                  title="Hapus Stasiun"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Live validation info */}
                {validationNotice ? (
                  <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Perhatian: {validationNotice}</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Urutan timeline valid & konsisten
                    </span>
                    <span className="font-mono font-bold">
                      Total Estimasi Durasi:{' '}
                      {formatMinutes(createStops[createStops.length - 1]?.departure_offset_minutes || 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting || Boolean(validationNotice)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 transition-colors"
                >
                  {createSubmitting ? 'Menyimpan...' : 'Simpan Rute & Timeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 1-Click Reverse Route Confirmation */}
      {reverseTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  1-Click Reverse Route (Generate Rute Kebalikan)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menduplikasi rute dan membalik seluruh urutan stasiun pemberhentian beserta offset waktunya.
                </p>
              </div>
              <button
                onClick={() => setReverseTarget(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {reverseError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{reverseError}</span>
                </div>
              )}

              {/* Source vs Target Comparison */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rute Sumber:</span>
                  <span className="font-bold text-slate-800">{reverseTarget.route_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Arah Sumber:</span>
                  <span className="font-mono font-bold text-sky-700">{reverseTarget.direction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Arah Baru Dihasilkan:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {reverseTarget.direction === 'OUTBOUND' ? 'INBOUND' : 'OUTBOUND'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Stasiun:</span>
                  <span className="font-mono font-bold text-slate-800">{reverseTarget.stops.length} Stasiun</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Rute Kebalikan yang Dihasilkan
                </label>
                <input
                  type="text"
                  value={reverseCustomName}
                  onChange={(e) => setReverseCustomName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                💡 Sistem akan membalik urutan stasiun dari akhir ke awal secara otomatis, menghitung ulang offset menit tiba & menit berangkat, dan merekam audit log mutasi secara instan.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReverseTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={reverseSubmitting}
                  onClick={handleSubmitReverse}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
                >
                  {reverseSubmitting ? 'Memproses Reverse...' : 'Generate Rute Kebalikan Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Detailed Stop Timeline Viewer */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  Detail Timeline Stasiun: {detailTarget.route_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Arah <span className="font-mono font-bold text-sky-700">{detailTarget.direction}</span> &bull; {detailTarget.fleet_name}
                </p>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-center w-12">#</th>
                      <th className="px-3 py-2">Stasiun (Kode)</th>
                      <th className="px-3 py-2">Kota</th>
                      <th className="px-3 py-2 font-mono">Tiba (Offset)</th>
                      <th className="px-3 py-2 font-mono">Berangkat (Offset)</th>
                      <th className="px-3 py-2 font-mono text-center">Singgah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailTarget.stops.map((st, i) => {
                      const dwell = st.departure_offset_minutes - st.arrival_offset_minutes;
                      return (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-center font-mono font-bold text-slate-400">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {st.station_name} <span className="font-mono text-sky-700 font-bold">({st.station_code})</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{st.station_city}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">
                            +{st.arrival_offset_minutes}m
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">
                            +{st.departure_offset_minutes}m
                          </td>
                          <td className="px-3 py-2 font-mono text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                              {dwell}m
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDetailTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
