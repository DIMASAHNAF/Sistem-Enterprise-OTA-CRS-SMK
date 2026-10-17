'use client';

import React, { useState, useEffect } from 'react';
import { Train, Bus, MapPin, Plus, Search, Edit2, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Station, StationType } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default function StationsMasterPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formType, setFormType] = useState<StationType>('TRAIN_STATION');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/master/stations', window.location.origin);
      if (activeType !== 'ALL') url.searchParams.set('type', activeType);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setStations(data.stations);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, [activeType, search]);

  const handleOpenAdd = () => {
    setEditingStation(null);
    setFormCode('');
    setFormName('');
    setFormCity('');
    setFormType('TRAIN_STATION');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: Station) => {
    setEditingStation(st);
    setFormCode(st.code);
    setFormName(st.name);
    setFormCity(st.city);
    setFormType(st.type);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload = {
        id: editingStation?.id,
        code: formCode.toUpperCase().trim(),
        name: formName.trim(),
        city: formCity.trim(),
        type: formType,
      };

      const method = editingStation ? 'PUT' : 'POST';
      const res = await fetch('/api/master/stations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan data stasiun');
      }

      setIsModalOpen(false);
      setToastMessage(editingStation ? 'Stasiun berhasil diperbarui' : 'Stasiun baru berhasil ditambahkan');
      setTimeout(() => setToastMessage(null), 3000);
      fetchStations();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (st: Station) => {
    if (!confirm(`Hapus stasiun ${st.code} - ${st.name}?`)) return;

    try {
      const res = await fetch(`/api/master/stations?id=${st.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus stasiun');
        return;
      }
      setToastMessage(`Stasiun ${st.code} berhasil dihapus`);
      setTimeout(() => setToastMessage(null), 3000);
      fetchStations();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus stasiun');
    }
  };

  const typeBadges: Record<string, { label: string; badgeClass: string; icon: React.ReactNode }> = {
    TRAIN_STATION: {
      label: 'Stasiun Kereta Api',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: <Train className="w-3 h-3" />,
    },
    BUS_TERMINAL: {
      label: 'Terminal Bus Tipe A',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <Bus className="w-3 h-3" />,
    },
    MEETING_POINT: {
      label: 'Titik Kumpul Praktik',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <MapPin className="w-3 h-3" />,
    },
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Master Data Stasiun, Terminal & Titik Kumpul
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Jaringan simpul transportasi darat & meeting point praktik ULP di Sumatera Utara
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Stasiun / Hub
        </button>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveType('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Simpul
          </button>
          <button
            onClick={() => setActiveType('TRAIN_STATION')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'TRAIN_STATION'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Stasiun Kereta
          </button>
          <button
            onClick={() => setActiveType('BUS_TERMINAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'BUS_TERMINAL'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Terminal Bus
          </button>
          <button
            onClick={() => setActiveType('MEETING_POINT')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeType === 'MEETING_POINT'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Titik Kumpul
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Cari stasiun, kode, kota..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 w-20">Kode</th>
                <th className="px-4 py-3">Nama Simpul / Stasiun</th>
                <th className="px-4 py-3">Kota / Wilayah</th>
                <th className="px-4 py-3">Kategori Simpul</th>
                <th className="px-4 py-3">Tanggal Dibuat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Memuat data stasiun...
                  </td>
                </tr>
              ) : stations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada stasiun yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                stations.map((st) => {
                  const typeInfo = typeBadges[st.type] || {
                    label: st.type,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: null,
                  };
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-sky-800">
                          {st.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {st.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {st.city}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${typeInfo.badgeClass}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {new Date(st.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(st)}
                          title="Edit Stasiun"
                          className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          onClick={() => handleDelete(st)}
                          title="Hapus Stasiun"
                          className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="font-extrabold text-sm text-slate-900">
                {editingStation ? 'Edit Master Stasiun' : 'Tambah Stasiun / Hub Baru'}
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode (3 Huruf)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="MDN"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Simpul
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as StationType)}
                  >
                    <option value="TRAIN_STATION">Stasiun Kereta Api</option>
                    <option value="BUS_TERMINAL">Terminal Bus</option>
                    <option value="MEETING_POINT">Titik Kumpul Sekolah</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Stasiun / Terminal / Hub
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Stasiun Besar Medan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kota / Kabupaten Wilayah
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kota Medan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Data Stasiun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
