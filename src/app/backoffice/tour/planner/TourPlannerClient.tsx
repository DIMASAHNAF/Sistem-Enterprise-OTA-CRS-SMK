'use client';

import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  Users,
  Percent,
  FileText,
  ChevronRight,
  Sparkles,
  Bus,
  Layers,
  X,
} from 'lucide-react';

interface CostItem {
  id?: string;
  category: string;
  item: string;
  cost: number;
}

interface ItineraryItem {
  id?: number;
  day_number: number;
  start_time: string;
  activity_title: string;
  location?: string | null;
  description?: string | null;
}

interface TourPackageItem {
  id: number;
  slug: string;
  title: string;
  destination: string;
  duration_days: number;
  min_pax: number;
  price_per_pax: number;
  costing_json: string;
  status: string;
  itineraries_count?: number;
  manifests_count?: number;
  costing?: any;
}

export function TourPlannerClient({ initialPackages }: { initialPackages: TourPackageItem[] }) {
  const [packages, setPackages] = useState<TourPackageItem[]>(initialPackages);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    initialPackages.length > 0 ? initialPackages[0].id : null
  );

  // Form states
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [minPax, setMinPax] = useState(30);
  const [freePax, setFreePax] = useState(2);
  const [marginPct, setMarginPct] = useState(15);
  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT' | 'PUBLISHED'>('ACTIVE');

  // Costs
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>([
    { category: 'Transport', item: 'Sewa Bus Pariwisata Jetbus 5 ULP-01 (3 Hari)', cost: 7500000 },
    { category: 'Transport', item: 'BBM, Tol Trans-Sumatera & Parkir', cost: 1650000 },
    { category: 'Guide', item: 'Fee Tour Leader & Tour Guide Lokal', cost: 1500000 },
    { category: 'Misc', item: 'Spanduk Kunjungan Industri, P3K & Dokumentasi', cost: 850000 },
  ]);

  const [variableCosts, setVariableCosts] = useState<CostItem[]>([
    { category: 'Hotel', item: 'Hotel Bintang 3 Parapat (Twin Share, 2 Malam)', cost: 400000 },
    { category: 'Meals', item: 'Konsumsi Makan 6x Prasmanan Halal', cost: 240000 },
    { category: 'Tickets', item: 'Tiket Masuk & Penyeberangan Ferry Samosir', cost: 75000 },
    { category: 'Snack', item: 'Air Mineral & Snack Perjalanan 3 Hari', cost: 45000 },
  ]);

  // Itineraries
  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
  const [newItinDay, setNewItinDay] = useState(1);
  const [newItinTime, setNewItinTime] = useState('08:00');
  const [newItinTitle, setNewItinTitle] = useState('');
  const [newItinLocation, setNewItinLocation] = useState('');
  const [newItinDesc, setNewItinDesc] = useState('');

  // UI States
  const [activeTab, setActiveTab] = useState<'costing' | 'itinerary'>('costing');
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load package data when selectedPackageId changes
  useEffect(() => {
    if (!selectedPackageId) return;

    setLoading(true);
    fetch(`/api/tour/packages/${selectedPackageId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.package) {
          const pkg = data.package;
          setTitle(pkg.title);
          setDestination(pkg.destination);
          setDurationDays(pkg.duration_days);
          setMinPax(pkg.min_pax);
          setStatus(pkg.status === 'PUBLISHED' ? 'ACTIVE' : pkg.status);

          if (pkg.costing) {
            setFreePax(pkg.costing.free_pax ?? 0);
            setMarginPct(pkg.costing.margin_percentage ?? 15);
            if (Array.isArray(pkg.costing.fixed_costs) && pkg.costing.fixed_costs.length > 0) {
              setFixedCosts(pkg.costing.fixed_costs);
            }
            if (Array.isArray(pkg.costing.variable_costs) && pkg.costing.variable_costs.length > 0) {
              setVariableCosts(pkg.costing.variable_costs);
            }
          }

          if (Array.isArray(pkg.itineraries)) {
            setItineraries(pkg.itineraries);
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedPackageId]);

  // Calculations
  const totalFixedCost = fixedCosts.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
  const totalVariableCostPerPax = variableCosts.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
  const totalParticipants = Number(minPax || 1) + Number(freePax || 0);
  const totalGroupCost = totalFixedCost + totalVariableCostPerPax * totalParticipants;
  const hppPerPax = Math.round(totalGroupCost / Math.max(1, Number(minPax || 1)));
  const sellingPricePerPax = Math.ceil((hppPerPax * (1 + Number(marginPct || 0) / 100)) / 1000) * 1000;
  const totalRevenue = sellingPricePerPax * Number(minPax || 1);
  const totalProfit = totalRevenue - totalGroupCost;

  // Add / Remove Costs
  const addFixedCostRow = () => {
    setFixedCosts([...fixedCosts, { category: 'Transport', item: '', cost: 0 }]);
  };
  const removeFixedCostRow = (idx: number) => {
    setFixedCosts(fixedCosts.filter((_, i) => i !== idx));
  };

  const addVariableCostRow = () => {
    setVariableCosts([...variableCosts, { category: 'Meals', item: '', cost: 0 }]);
  };
  const removeVariableCostRow = (idx: number) => {
    setVariableCosts(variableCosts.filter((_, i) => i !== idx));
  };

  // Add Itinerary Item
  const handleAddItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId) {
      setFeedback({ type: 'error', message: 'Pilih atau simpan paket wisata terlebih dahulu.' });
      return;
    }
    if (!newItinTitle.trim()) {
      setFeedback({ type: 'error', message: 'Judul aktivitas itinerary wajib diisi.' });
      return;
    }

    try {
      const res = await fetch(`/api/tour/packages/${selectedPackageId}/itineraries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: newItinDay,
          start_time: newItinTime,
          activity_title: newItinTitle,
          location: newItinLocation,
          description: newItinDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan itinerary');

      setItineraries([...itineraries, data.itinerary].sort((a, b) => a.day_number - b.day_number || a.start_time.localeCompare(b.start_time)));
      setNewItinTitle('');
      setNewItinLocation('');
      setNewItinDesc('');
      setFeedback({ type: 'success', message: 'Aktivitas itinerary berhasil ditambahkan.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteItinerary = async (itineraryId: number) => {
    if (!selectedPackageId) return;
    try {
      const res = await fetch(`/api/tour/packages/${selectedPackageId}/itineraries?itinerary_id=${itineraryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus itinerary');
      setItineraries(itineraries.filter((i) => i.id !== itineraryId));
      setFeedback({ type: 'success', message: 'Aktivitas itinerary berhasil dihapus.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Save / Update Package
  const handleSavePackage = async () => {
    if (!title.trim() || !destination.trim()) {
      setFeedback({ type: 'error', message: 'Judul paket dan destinasi wajib diisi.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const payload = {
      title,
      destination,
      duration_days: durationDays,
      min_pax: minPax,
      free_pax: freePax,
      margin_percentage: marginPct,
      fixed_costs: fixedCosts,
      variable_costs: variableCosts,
      status,
    };

    try {
      if (selectedPackageId) {
        // Update
        const res = await fetch(`/api/tour/packages/${selectedPackageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui paket');

        setFeedback({ type: 'success', message: 'Paket wisata dan HPP Costing berhasil diperbarui!' });
        // Refresh packages list
        refreshPackagesList();
      } else {
        // Create new
        const res = await fetch('/api/tour/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal membuat paket');

        setSelectedPackageId(data.package.id);
        setFeedback({ type: 'success', message: 'Paket wisata baru berhasil dibuat!' });
        refreshPackagesList();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const refreshPackagesList = () => {
    fetch('/api/tour/packages')
      .then((res) => res.json())
      .then((data) => {
        if (data.packages) setPackages(data.packages);
      })
      .catch((err) => console.error(err));
  };

  const startNewPackage = () => {
    setSelectedPackageId(null);
    setTitle('');
    setDestination('');
    setDurationDays(3);
    setMinPax(35);
    setFreePax(2);
    setMarginPct(15);
    setStatus('ACTIVE');
    setItineraries([]);
    setFeedback({ type: 'success', message: 'Silakan isi parameter paket wisata baru.' });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
              Unit Layanan Pariwisata (ULP/ULW)
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-medium">Biro Perjalanan & Kunjungan Industri</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-sky-600" />
            <span>Kalkulator HPP Tour Costing & Itinerary Builder</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rancang paket wisata sekolah, perhitungan HPP per siswa berbayar, subsidi guru pendamping, dan terbitkan Quotation resmi.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={startNewPackage}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Buat Paket Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuotationModal(true)}
            disabled={!selectedPackageId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>🖨️ Cetak PDF Quotation</span>
          </button>

          <button
            type="button"
            onClick={handleSavePackage}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Menyimpan...' : 'Simpan HPP Costing'}</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
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
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Package Selector Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Pilih Paket Tersimpan:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackageId(pkg.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedPackageId === pkg.id
                  ? 'bg-sky-600 text-white font-bold shadow-sm ring-2 ring-sky-500/30'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{pkg.title}</span>
              <span className="ml-1.5 font-mono text-[11px] opacity-80">
                (Rp {pkg.price_per_pax?.toLocaleString('id-ID')})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs (Costing Worksheet vs Itinerary Builder) */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('costing')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'costing'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Worksheet Kalkulator HPP & Parameter Biaya</span>
        </button>

        <button
          onClick={() => setActiveTab('itinerary')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'itinerary'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Timeline Itinerary Harian ({itineraries.length} Kegiatan)</span>
        </button>
      </div>

      {/* TAB 1: COSTING WORKSHEET */}
      {activeTab === 'costing' && (
        <div className="space-y-6">
          {/* Top Parameters Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span>1. Parameter Pokok Paket Wisata & Rombongan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama / Judul Paket Wisata
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Kunjungan Industri Danau Toba 3H2M"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destinasi / Wilayah Operasi
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Contoh: Parapat & Samosir, Sumut"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Durasi Perjalanan (Hari)
                </label>
                <input
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Paket
                </label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Ditampilkan di Katalog)</option>
                  <option value="DRAFT">DRAFT (Dalam Perancangan)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-lg">
                <label className="block text-xs font-bold text-sky-950 mb-1">
                  Target Peserta Berbayar (Paying Pax)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={minPax}
                    onChange={(e) => setMinPax(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-mono font-bold text-sky-900 bg-white border border-sky-200 rounded-md focus:outline-none"
                  />
                  <span className="text-xs font-bold text-sky-700">Siswa</span>
                </div>
                <p className="text-[11px] text-sky-600 mt-1">
                  Jumlah siswa/peserta yang membayar biaya paket.
                </p>
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                <label className="block text-xs font-bold text-amber-950 mb-1">
                  Guru Pendamping Gratis (Free Pax)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={freePax}
                    onChange={(e) => setFreePax(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-mono font-bold text-amber-900 bg-white border border-amber-200 rounded-md focus:outline-none"
                  />
                  <span className="text-xs font-bold text-amber-700">Guru</span>
                </div>
                <p className="text-[11px] text-amber-600 mt-1">
                  Biaya guru gratis dibebankan merata ke HPP peserta.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Markup / Margin Keuntungan (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={marginPct}
                    onChange={(e) => setMarginPct(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-mono font-bold text-emerald-900 bg-white border border-emerald-200 rounded-md focus:outline-none"
                  />
                  <span className="text-xs font-bold text-emerald-700">%</span>
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">
                  Keuntungan biro perjalanan ULP SMK.
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Tables: Fixed Costs vs Variable Costs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FIXED COSTS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    2. Fixed Cost (Biaya Tetap Rombongan)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Biaya satu rombongan bus yang tidak bergantung pada jumlah siswa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addFixedCostRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>

              <div className="p-4 flex-1 space-y-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1 text-left">
                      <th className="pb-2">Kategori</th>
                      <th className="pb-2">Komponen Biaya</th>
                      <th className="pb-2 text-right">Biaya Total (IDR)</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fixedCosts.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={c.category}
                            onChange={(e) => {
                              const updated = [...fixedCosts];
                              updated[idx].category = e.target.value;
                              setFixedCosts(updated);
                            }}
                            className="w-24 px-2 py-1 text-xs border border-slate-200 rounded font-medium focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={c.item}
                            onChange={(e) => {
                              const updated = [...fixedCosts];
                              updated[idx].item = e.target.value;
                              setFixedCosts(updated);
                            }}
                            placeholder="Deskripsi item pengeluaran"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={c.cost}
                            onChange={(e) => {
                              const updated = [...fixedCosts];
                              updated[idx].cost = Number(e.target.value);
                              setFixedCosts(updated);
                            }}
                            className="w-28 px-2 py-1 text-xs text-right font-mono font-bold border border-slate-200 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pl-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeFixedCostRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">Subtotal Fixed Cost:</span>
                <span className="font-mono text-sm text-slate-900">
                  Rp {totalFixedCost.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* VARIABLE COSTS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    3. Variable Cost per Pax (Biaya per Peserta)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Biaya individual yang dikalikan total peserta ({totalParticipants} orang: {minPax} Siswa + {freePax} Guru).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addVariableCostRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>

              <div className="p-4 flex-1 space-y-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1 text-left">
                      <th className="pb-2">Kategori</th>
                      <th className="pb-2">Komponen Biaya</th>
                      <th className="pb-2 text-right">Biaya/Pax (IDR)</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variableCosts.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={c.category}
                            onChange={(e) => {
                              const updated = [...variableCosts];
                              updated[idx].category = e.target.value;
                              setVariableCosts(updated);
                            }}
                            className="w-24 px-2 py-1 text-xs border border-slate-200 rounded font-medium focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={c.item}
                            onChange={(e) => {
                              const updated = [...variableCosts];
                              updated[idx].item = e.target.value;
                              setVariableCosts(updated);
                            }}
                            placeholder="Deskripsi item individual"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={c.cost}
                            onChange={(e) => {
                              const updated = [...variableCosts];
                              updated[idx].cost = Number(e.target.value);
                              setVariableCosts(updated);
                            }}
                            className="w-24 px-2 py-1 text-xs text-right font-mono font-bold border border-slate-200 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pl-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeVariableCostRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">Subtotal Variable per Pax:</span>
                <span className="font-mono text-sm text-slate-900">
                  Rp {totalVariableCostPerPax.toLocaleString('id-ID')} / pax
                </span>
              </div>
            </div>
          </div>

          {/* REAL-TIME CALCULATION SUMMARY CARDS */}
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                  4. Hasil Kalkulasi Resmi HPP Tour Costing (Standard Kompetensi ULP)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Formula: [Fixed + (Var &times; {totalParticipants})] / {minPax}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">Total Biaya Rombongan</div>
                <div className="text-base sm:text-lg font-mono font-bold text-slate-100 mt-1">
                  Rp {totalGroupCost.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Termasuk {freePax} Guru Pendamping
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">HPP Pokok per Siswa</div>
                <div className="text-base sm:text-lg font-mono font-bold text-sky-400 mt-1">
                  Rp {hppPerPax.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Titik Impas (BEP) per Siswa
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700">
                <div className="text-[11px] text-slate-400">Margin ({marginPct}%)</div>
                <div className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-1">
                  Rp {totalProfit.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Proyeksi Laba Bersih Biro ULP
                </div>
              </div>

              <div className="p-3.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/40">
                <div className="text-[11px] text-amber-300 font-bold uppercase tracking-wider">
                  Harga Jual Resmi per Siswa
                </div>
                <div className="text-lg sm:text-2xl font-mono font-extrabold text-amber-400 mt-0.5">
                  Rp {sellingPricePerPax.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] text-amber-200/80 mt-0.5">
                  Dibulatkan ke ribuan terdekat
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ITINERARY BUILDER */}
      {activeTab === 'itinerary' && (
        <div className="space-y-6">
          {/* Add Activity Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Tambah Aktivitas / Agenda Itinerary</span>
              </h2>
              <span className="text-xs text-slate-500">
                Paket: <span className="font-bold text-slate-800">{title || 'Belum tersimpan'}</span>
              </span>
            </div>

            <form onSubmit={handleAddItinerary} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hari Ke-
                </label>
                <select
                  value={newItinDay}
                  onChange={(e) => setNewItinDay(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-md focus:outline-none"
                >
                  {Array.from({ length: durationDays }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Hari ke-{d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jam Mulai (WIB)
                </label>
                <input
                  type="text"
                  value={newItinTime}
                  onChange={(e) => setNewItinTime(e.target.value)}
                  placeholder="08:00"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-md focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aktivitas / Kegiatan
                </label>
                <input
                  type="text"
                  value={newItinTitle}
                  onChange={(e) => setNewItinTitle(e.target.value)}
                  placeholder="Contoh: Kunjungan Industri ke Pabrik & Ulos"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi / Venue
                </label>
                <input
                  type="text"
                  value={newItinLocation}
                  onChange={(e) => setNewItinLocation(e.target.value)}
                  placeholder="Contoh: Desa Wisata Tomok Samosir"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors"
                >
                  + Tambah
                </button>
              </div>

              <div className="sm:col-span-12">
                <input
                  type="text"
                  value={newItinDesc}
                  onChange={(e) => setNewItinDesc(e.target.value)}
                  placeholder="Deskripsi tambahan / catatan tour leader (opsional)"
                  className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 focus:outline-none"
                />
              </div>
            </form>
          </div>

          {/* Timeline View */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Rangkaian Jadwal Kegiatan ({itineraries.length} Item)</span>
              </h2>
            </div>

            {itineraries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Belum ada aktivitas itinerary. Silakan tambahkan melalui form di atas.
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(new Set(itineraries.map((i) => i.day_number))).sort((a, b) => a - b).map((dayNum) => {
                  const dayItems = itineraries.filter((i) => i.day_number === dayNum);

                  return (
                    <div key={dayNum} className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                        <span>Hari ke-{dayNum}</span>
                        <span className="text-sky-600 font-normal">({dayItems.length} agenda)</span>
                      </div>

                      <div className="border-l-2 border-sky-200 ml-4 pl-4 space-y-4">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-sky-300 transition-colors flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-white">
                                  {item.start_time} WIB
                                </span>
                                <h4 className="font-bold text-xs text-slate-900">
                                  {item.activity_title}
                                </h4>
                              </div>

                              {item.location && (
                                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{item.location}</span>
                                </div>
                              )}

                              {item.description && (
                                <p className="text-[11px] text-slate-600">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            {item.id && (
                              <button
                                onClick={() => handleDeleteItinerary(item.id!)}
                                className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OFFICIAL QUOTATION MODAL / PRINT VIEW */}
      {showQuotationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-8">
            {/* Modal action bar (hidden on print) */}
            <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Dokumen Resmi Penawaran Harga (Quotation)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                >
                  🖨️ Cetak Dokumen Sekarang
                </button>
                <button
                  onClick={() => setShowQuotationModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PRINTABLE QUOTATION BODY */}
            <div className="p-8 sm:p-10 space-y-6 text-slate-900 bg-white">
              {/* Letterhead (Kop Surat SMK ULP) */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h1 className="text-lg font-black tracking-tight uppercase text-slate-900">
                    Biro Perjalanan Wisata & Perhotelan SMK ULP
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Unit Layanan Pariwisata (ULP/ULW) & Perhotelan — Konsentrasi Keahlian Tour & Travel Management
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Jl. Kolam No. 1 Percut Sei Tuan, Deli Serdang, Sumatera Utara &bull; Telp/WA: 0812-6011-2233
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nomor Dokumen
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">
                    QTO-ULP-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-{(selectedPackageId || 1).toString().padStart(4, '0')}
                  </div>
                </div>
              </div>

              {/* Title & Recipient */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Kepada Yth:</span>
                  <div className="font-bold text-slate-900 text-sm">Panitia Kunjungan Industri / Rombongan Sekolah</div>
                  <div className="text-slate-600">SMK Negeri / Swasta Mitra ULP</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold block">Tanggal Terbit:</span>
                  <div className="font-mono font-bold text-slate-800">
                    {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-slate-500">Berlaku s/d: 30 Hari Sejak Terbit</div>
                </div>
              </div>

              {/* Package Summary Box */}
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-2">
                <div className="text-sm font-extrabold text-slate-900 uppercase">
                  {title || 'Paket Kunjungan Industri & Tour'}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Destinasi:</span>{' '}
                    <span className="font-semibold text-slate-800">{destination}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Durasi:</span>{' '}
                    <span className="font-semibold text-slate-800">{durationDays} Hari</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Kuota Peserta:</span>{' '}
                    <span className="font-semibold text-slate-800">Min. {minPax} Siswa (+ {freePax} Guru Free)</span>
                  </div>
                </div>
              </div>

              {/* Facilities Included / Excluded */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="font-bold text-emerald-800 uppercase text-[11px]">
                    &check; Fasilitas Termasuk (Included):
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                    {fixedCosts.map((c, idx) => (
                      <li key={idx}>{c.item}</li>
                    ))}
                    {variableCosts.map((c, idx) => (
                      <li key={idx}>{c.item}</li>
                    ))}
                    <li>Gratis Biaya Paket untuk {freePax} Guru Pendamping</li>
                  </ul>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="font-bold text-rose-800 uppercase text-[11px]">
                    &times; Fasilitas Tidak Termasuk (Excluded):
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                    <li>Pengeluaran pribadi peserta (Laundry, Mini Bar, Telephone hotel)</li>
                    <li>Tiket wahana permainan tambahan di luar program</li>
                    <li>Obat-obatan pribadi khusus</li>
                    <li>Tipping sukarela untuk crew armada (opsional)</li>
                  </ul>
                </div>
              </div>

              {/* Official Pricing Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Rincian Penawaran Harga Resmi per Peserta
                </div>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 text-left">Kategori Peserta</th>
                      <th className="p-2.5 text-center">Jumlah Pax</th>
                      <th className="p-2.5 text-left">Fasilitas & Akomodasi</th>
                      <th className="p-2.5 text-right">Harga Resmi (IDR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Siswa / Peserta Utama</td>
                      <td className="p-2.5 text-center font-mono font-semibold">{minPax} Siswa</td>
                      <td className="p-2.5 text-slate-600">Lengkap Sesuai Program Itinerary & Bus Pariwisata AC</td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-sm text-slate-900">
                        Rp {sellingPricePerPax.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">/ pax</span>
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2.5 font-bold text-emerald-800">Guru Pendamping (Complimentary)</td>
                      <td className="p-2.5 text-center font-mono font-semibold text-emerald-800">{freePax} Guru</td>
                      <td className="p-2.5 text-emerald-800 font-medium">Bebas Biaya (Subsidi Rombongan Siswa)</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-800">Rp 0 (GRATIS)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-center border-t border-slate-200">
                <div className="space-y-16">
                  <div>
                    <span className="text-slate-500">Disiapkan Oleh:</span>
                    <div className="font-bold text-slate-800">Tour Planner (Divisi Tour ULP)</div>
                  </div>
                  <div>
                    <div className="font-bold underline text-slate-900">Anisa Rahmawati</div>
                    <div className="text-[11px] text-slate-500">Siswa Praktik Kejuruan ULP</div>
                  </div>
                </div>

                <div className="space-y-16">
                  <div>
                    <span className="text-slate-500">Mengetahui & Menyetujui:</span>
                    <div className="font-bold text-slate-800">Kepala Lab Praktik ULP & Perhotelan</div>
                  </div>
                  <div>
                    <div className="font-bold underline text-slate-900">Bpk. Drs. H. Suryadi, M.Kom</div>
                    <div className="text-[11px] text-slate-500">NIP. 19780512 200501 1 003</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
