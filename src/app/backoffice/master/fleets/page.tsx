'use client';

import React, { useState, useEffect } from 'react';
import {
  Train,
  Bus,
  Plus,
  Layers,
  Edit2,
  Trash2,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  Armchair,
} from 'lucide-react';
import { Fleet, Wagon, WagonClass, DirectionIndicator } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

interface FleetWithWagons extends Fleet {
  wagons: Wagon[];
}

export default function FleetsMasterPage() {
  const [fleets, setFleets] = useState<FleetWithWagons[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fleet Modal
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [fleetCode, setFleetCode] = useState('');
  const [fleetName, setFleetName] = useState('');
  const [fleetType, setFleetType] = useState<'TRAIN' | 'BUS'>('TRAIN');
  const [fleetStatus, setFleetStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE');
  const [fleetError, setFleetError] = useState<string | null>(null);

  // Wagon Modal
  const [isWagonModalOpen, setIsWagonModalOpen] = useState(false);
  const [selectedFleetId, setSelectedFleetId] = useState<number | null>(null);
  const [editingWagon, setEditingWagon] = useState<Wagon | null>(null);
  const [wagonCode, setWagonCode] = useState('');
  const [wagonClass, setWagonClass] = useState<WagonClass>('EXECUTIVE');
  const [wagonRows, setWagonRows] = useState<number>(10);
  const [wagonLayout, setWagonLayout] = useState<'2-2' | '3-2' | '2-1'>('2-2');
  const [wagonDirection, setWagonDirection] = useState<DirectionIndicator>('FORWARD');
  const [wagonError, setWagonError] = useState<string | null>(null);

  // Seat Preview Modal
  const [previewWagon, setPreviewWagon] = useState<{ wagon: Wagon; fleetName: string } | null>(null);

  const fetchFleets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/master/fleets');
      const data = await res.json();
      if (data.success) {
        setFleets(data.fleets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleets();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fleet Handlers
  const handleOpenAddFleet = () => {
    setEditingFleet(null);
    setFleetCode('');
    setFleetName('');
    setFleetType('TRAIN');
    setFleetStatus('ACTIVE');
    setFleetError(null);
    setIsFleetModalOpen(true);
  };

  const handleOpenEditFleet = (f: Fleet) => {
    setEditingFleet(f);
    setFleetCode(f.code);
    setFleetName(f.name);
    setFleetType(f.type);
    setFleetStatus(f.status);
    setFleetError(null);
    setIsFleetModalOpen(true);
  };

  const handleSaveFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    setFleetError(null);

    try {
      const payload = {
        id: editingFleet?.id,
        code: fleetCode.toUpperCase().trim(),
        name: fleetName.trim(),
        type: fleetType,
        status: fleetStatus,
      };

      const res = await fetch('/api/master/fleets', {
        method: editingFleet ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan armada');

      setIsFleetModalOpen(false);
      showToast(editingFleet ? 'Armada berhasil diperbarui' : 'Armada baru berhasil ditambahkan');
      fetchFleets();
    } catch (err: any) {
      setFleetError(err.message || 'Terjadi kesalahan sistem');
    }
  };

  const handleDeleteFleet = async (f: Fleet) => {
    if (!confirm(`Hapus armada ${f.name} (${f.code})?`)) return;

    try {
      const res = await fetch(`/api/master/fleets?id=${f.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus armada');
        return;
      }
      showToast(`Armada ${f.name} berhasil dihapus`);
      fetchFleets();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus armada');
    }
  };

  // Wagon Handlers
  const handleOpenAddWagon = (fleetId: number) => {
    setSelectedFleetId(fleetId);
    setEditingWagon(null);
    setWagonCode('');
    setWagonClass('EXECUTIVE');
    setWagonRows(10);
    setWagonLayout('2-2');
    setWagonDirection('FORWARD');
    setWagonError(null);
    setIsWagonModalOpen(true);
  };

  const handleOpenEditWagon = (w: Wagon) => {
    setSelectedFleetId(w.fleet_id);
    setEditingWagon(w);
    setWagonCode(w.wagon_code);
    setWagonClass(w.class);
    setWagonRows(w.rows);
    setWagonLayout(w.cols_layout as '2-2' | '3-2' | '2-1');
    setWagonDirection(w.direction_indicator);
    setWagonError(null);
    setIsWagonModalOpen(true);
  };

  const handleSaveWagon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFleetId) return;
    setWagonError(null);

    try {
      const payload = {
        id: editingWagon?.id,
        wagon_code: wagonCode.toUpperCase().trim(),
        class: wagonClass,
        rows: Number(wagonRows),
        cols_layout: wagonLayout,
        direction_indicator: wagonDirection,
      };

      const res = await fetch(`/api/master/fleets/${selectedFleetId}/wagons`, {
        method: editingWagon ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan gerbong');

      setIsWagonModalOpen(false);
      showToast(editingWagon ? 'Gerbong berhasil diperbarui' : 'Gerbong baru berhasil ditambahkan');
      fetchFleets();
    } catch (err: any) {
      setWagonError(err.message || 'Terjadi kesalahan sistem');
    }
  };

  const handleDeleteWagon = async (w: Wagon) => {
    if (!confirm(`Hapus gerbong ${w.wagon_code}?`)) return;

    try {
      const res = await fetch(`/api/master/fleets/${w.fleet_id}/wagons?wagon_id=${w.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus gerbong');
        return;
      }
      showToast(`Gerbong ${w.wagon_code} berhasil dihapus`);
      fetchFleets();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus gerbong');
    }
  };

  const calculateCapacity = (w: Wagon) => {
    const seatsPerRow = w.cols_layout === '3-2' ? 5 : w.cols_layout === '2-1' ? 3 : 4;
    return w.rows * seatsPerRow;
  };

  // Helper for generating seat columns
  const getLayoutColumns = (layout: string) => {
    if (layout === '3-2') {
      return { left: ['A', 'B', 'C'], right: ['D', 'E'] };
    }
    if (layout === '2-1') {
      return { left: ['A', 'B'], right: ['C'] };
    }
    return { left: ['A', 'B'], right: ['C', 'D'] };
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Master Data Armada & Konfigurasi Gerbong (Wagons)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen spesifikasi kereta & bus pariwisata, susunan denah kursi, dan kalkulator kapasitas
          </p>
        </div>
        <button
          onClick={handleOpenAddFleet}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Armada Baru
        </button>
      </div>

      {/* Fleets List */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-400">
            Memuat data armada dan denah gerbong...
          </div>
        ) : (
          fleets.map((fleet) => {
            const totalSeats = fleet.wagons.reduce((acc, w) => acc + calculateCapacity(w), 0);

            return (
              <div key={fleet.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {/* Fleet Header */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        fleet.type === 'TRAIN'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {fleet.type === 'TRAIN' ? <Train className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">
                        {fleet.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        Kode: <strong className="font-mono text-slate-800">{fleet.code}</strong> &bull; Tipe: {fleet.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                      <Layers className="w-3.5 h-3.5" /> {fleet.wagons.length} Gerbong / Kabin
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {totalSeats} Kursi
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {fleet.status}
                    </span>

                    <button
                      onClick={() => handleOpenEditFleet(fleet)}
                      title="Edit Armada"
                      className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-slate-200/60 ml-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFleet(fleet)}
                      title="Hapus Armada"
                      className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-slate-200/60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Wagons Grid */}
                <div className="p-5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Susunan Gerbong & Konfigurasi Kursi
                    </div>
                    <button
                      onClick={() => handleOpenAddWagon(fleet.id)}
                      className="inline-flex items-center gap-1 text-xs text-sky-700 font-semibold hover:text-sky-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Gerbong ke Armada Ini
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {fleet.wagons.map((w) => {
                      const cap = calculateCapacity(w);
                      return (
                        <div
                          key={w.id}
                          className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-extrabold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {w.wagon_code}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                w.class === 'EXECUTIVE'
                                  ? 'bg-sky-100 text-sky-700'
                                  : w.class === 'BUSINESS'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {w.class}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600">
                            Layout: <strong className="font-mono text-slate-900">{w.cols_layout}</strong> &bull; {w.rows} Baris ({w.direction_indicator})
                          </div>

                          <div className="flex justify-between items-center border-t border-dashed border-slate-200 pt-2 text-xs">
                            <span className="font-mono font-bold text-sky-700">
                              {cap} Kursi
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPreviewWagon({ wagon: w, fleetName: fleet.name })}
                                title="Pratinjau Denah Kursi"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> Denah
                              </button>
                              <button
                                onClick={() => handleOpenEditWagon(w)}
                                title="Edit Gerbong"
                                className="p-1 rounded text-slate-400 hover:text-slate-700"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteWagon(w)}
                                title="Hapus Gerbong"
                                className="p-1 rounded text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Fleet Form Modal */}
      {isFleetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="font-extrabold text-sm text-slate-900">
                {editingFleet ? 'Edit Armada' : 'Tambah Armada Baru'}
              </div>
              <button onClick={() => setIsFleetModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveFleet} className="p-5 space-y-4">
              {fleetError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{fleetError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Armada</label>
                  <input
                    type="text"
                    required
                    placeholder="SRB-UTM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={fleetCode}
                    onChange={(e) => setFleetCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Kendaraan</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={fleetType}
                    onChange={(e) => setFleetType(e.target.value as 'TRAIN' | 'BUS')}
                  >
                    <option value="TRAIN">Kereta Api (TRAIN)</option>
                    <option value="BUS">Bus Pariwisata (BUS)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Armada</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: KA Sribilah Utama"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={fleetName}
                  onChange={(e) => setFleetName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Operasional</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={fleetStatus}
                  onChange={(e) => setFleetStatus(e.target.value as any)}
                >
                  <option value="ACTIVE">ACTIVE (Siap Berdinas)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Perawatan)</option>
                  <option value="INACTIVE">INACTIVE (Tidak Aktif)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFleetModalOpen(false)}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                >
                  Simpan Armada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wagon Form Modal */}
      {isWagonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="font-extrabold text-sm text-slate-900">
                {editingWagon ? 'Edit Konfigurasi Gerbong' : 'Tambah Gerbong / Kabin'}
              </div>
              <button onClick={() => setIsWagonModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWagon} className="p-5 space-y-4">
              {wagonError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{wagonError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Gerbong</label>
                  <input
                    type="text"
                    required
                    placeholder="EKS-1 atau BUS-A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={wagonCode}
                    onChange={(e) => setWagonCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelas Layanan</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={wagonClass}
                    onChange={(e) => setWagonClass(e.target.value as WagonClass)}
                  >
                    <option value="EXECUTIVE">Eksekutif (EXECUTIVE)</option>
                    <option value="BUSINESS">Bisnis (BUSINESS)</option>
                    <option value="ECONOMY">Ekonomi (ECONOMY)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Baris Kursi</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={wagonRows}
                    onChange={(e) => setWagonRows(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Layout Kolom Denah</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={wagonLayout}
                    onChange={(e) => setWagonLayout(e.target.value as any)}
                  >
                    <option value="2-2">2 - 2 (4 Kursi/Baris)</option>
                    <option value="3-2">3 - 2 (5 Kursi/Baris)</option>
                    <option value="2-1">2 - 1 (3 Kursi/Baris VIP)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Indikator Arah Kursi</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={wagonDirection}
                  onChange={(e) => setWagonDirection(e.target.value as DirectionIndicator)}
                >
                  <option value="FORWARD">FORWARD (Searah Laju Kereta)</option>
                  <option value="BACKWARD">BACKWARD (Berlawanan Arah)</option>
                  <option value="FACING">FACING (Saling Berhadapan)</option>
                </select>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded p-3 text-xs text-sky-800">
                Total estimasi kapasitas gerbong ini:{' '}
                <strong className="font-mono font-bold">
                  {wagonRows * (wagonLayout === '3-2' ? 5 : wagonLayout === '2-1' ? 3 : 4)} Kursi
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWagonModalOpen(false)}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                >
                  Simpan Gerbong
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Seat Layout Preview Modal */}
      {previewWagon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-sm text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                    {previewWagon.wagon.wagon_code}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {previewWagon.fleetName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">
                    {previewWagon.wagon.class}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Layout: <strong className="font-mono">{previewWagon.wagon.cols_layout}</strong> &bull; Total Kapasitas:{' '}
                  <strong className="font-mono text-sky-700 font-bold">
                    {calculateCapacity(previewWagon.wagon)} Kursi
                  </strong>{' '}
                  ({previewWagon.wagon.rows} Baris)
                </div>
              </div>

              <button
                onClick={() => setPreviewWagon(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Seat Map Visualizer */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
              {/* Direction Indicator */}
              <div className="flex flex-col items-center justify-center py-2 px-4 bg-sky-50 border border-sky-200 rounded-lg text-xs font-bold text-sky-800 tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="w-4 h-4 text-sky-600 animate-bounce" />
                  <span>ARAH LAJU KENDARAAN ⬆️ (DEPAN)</span>
                </div>
                <span className="text-[10px] text-sky-600 font-normal">
                  Pintu Masuk & Bordes Gerbong Depan
                </span>
              </div>

              {/* Wagon Carriage Box */}
              <div className="bg-white border-2 border-slate-300 rounded-xl p-5 shadow-sm max-w-lg mx-auto">
                <div className="space-y-2.5">
                  {Array.from({ length: previewWagon.wagon.rows }).map((_, rIdx) => {
                    const rowNumber = rIdx + 1;
                    const layoutCols = getLayoutColumns(previewWagon.wagon.cols_layout);

                    return (
                      <div key={rowNumber} className="flex items-center justify-between gap-3">
                        {/* Row Number Left */}
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-5 text-right">
                          {rowNumber}
                        </span>

                        {/* Left Column Seats */}
                        <div className="flex items-center gap-2">
                          {layoutCols.left.map((colLetter) => {
                            const seatId = `${rowNumber}${colLetter}`;
                            return (
                              <div
                                key={seatId}
                                className={`w-10 h-10 rounded-md border flex flex-col items-center justify-center transition-all ${
                                  previewWagon.wagon.class === 'EXECUTIVE'
                                    ? 'border-sky-300 bg-sky-50/70 text-sky-900'
                                    : previewWagon.wagon.class === 'BUSINESS'
                                    ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                                    : 'border-slate-300 bg-slate-100 text-slate-800'
                                }`}
                              >
                                <Armchair className="w-3.5 h-3.5 opacity-60" />
                                <span className="font-mono font-bold text-[10px] leading-none mt-0.5">
                                  {seatId}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Aisle (Gang) */}
                        <div className="flex-1 border-b border-dashed border-slate-300 text-center">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest px-1 bg-white">
                            GANG
                          </span>
                        </div>

                        {/* Right Column Seats */}
                        <div className="flex items-center gap-2">
                          {layoutCols.right.map((colLetter) => {
                            const seatId = `${rowNumber}${colLetter}`;
                            return (
                              <div
                                key={seatId}
                                className={`w-10 h-10 rounded-md border flex flex-col items-center justify-center transition-all ${
                                  previewWagon.wagon.class === 'EXECUTIVE'
                                    ? 'border-sky-300 bg-sky-50/70 text-sky-900'
                                    : previewWagon.wagon.class === 'BUSINESS'
                                    ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                                    : 'border-slate-300 bg-slate-100 text-slate-800'
                                }`}
                              >
                                <Armchair className="w-3.5 h-3.5 opacity-60" />
                                <span className="font-mono font-bold text-[10px] leading-none mt-0.5">
                                  {seatId}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Row Number Right */}
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-5 text-left">
                          {rowNumber}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Toilet / Bordes Indicator */}
              <div className="flex items-center justify-center py-2 px-4 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                <span>Pintu Masuk & Toilet Gerbong Belakang</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewWagon(null)}
                className="px-4 py-2 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
