'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Minus, ChevronDown, Check, UserCheck } from 'lucide-react';

interface PassengerPopoverProps {
  adults: number;
  infants: number;
  onAdultsChange: (val: number) => void;
  onInfantsChange: (val: number) => void;
}

export function PassengerPopover({
  adults,
  infants,
  onAdultsChange,
  onInfantsChange,
}: PassengerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDecreaseAdults = () => {
    if (adults > 1) {
      const nextAdults = adults - 1;
      onAdultsChange(nextAdults);
      // Infants cannot exceed adults
      if (infants > nextAdults) {
        onInfantsChange(nextAdults);
      }
    }
  };

  const handleIncreaseAdults = () => {
    if (adults < 8) {
      onAdultsChange(adults + 1);
    }
  };

  const handleDecreaseInfants = () => {
    if (infants > 0) {
      onInfantsChange(infants - 1);
    }
  };

  const handleIncreaseInfants = () => {
    if (infants < adults && infants < 4) {
      onInfantsChange(infants + 1);
    }
  };

  return (
    <div className="relative min-w-0 w-full" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 truncate">
        <Users className="w-3.5 h-3.5 text-sky-600" />
        <span className="truncate">Penumpang</span>
      </label>

      {/* Trigger Button: Clean Traveloka Style with anti-blowout */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-w-0 text-left pl-3.5 pr-8 py-2.5 rounded-xl border transition-all duration-200 shadow-2xs flex items-center justify-between cursor-pointer overflow-hidden ${
          isOpen
            ? 'bg-white border-sky-500 ring-4 ring-sky-500/15'
            : 'bg-slate-50/70 hover:bg-white border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden pr-1">
          <span className="text-xs font-bold text-slate-900 truncate">
            {adults} Dewasa{infants > 0 ? `, ${infants} Bayi` : ''}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            Kursi Otomatis
          </span>
        </div>

        <div className="absolute right-2.5 top-1/2 translate-y-1 text-slate-400 shrink-0 pointer-events-none">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-sky-600' : ''}`}
          />
        </div>
      </button>

      {/* Floating Popover with Stepper Counters */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 sm:right-auto sm:w-80 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 z-50 space-y-4"
          >
            <div className="text-xs font-extrabold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Atur Jumlah Penumpang</span>
              <span className="text-[10px] font-mono text-slate-400">Maks. 8 Dewasa</span>
            </div>

            {/* Adults Counter */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">Dewasa</div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  Usia &ge; 3 tahun &bull; Dapat nomor kursi
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDecreaseAdults}
                  disabled={adults <= 1}
                  className="w-7 h-7 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer"
                  aria-label="Kurangi Dewasa"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-mono font-black text-sm text-slate-900">
                  {adults}
                </span>
                <button
                  type="button"
                  onClick={handleIncreaseAdults}
                  disabled={adults >= 8}
                  className="w-7 h-7 rounded-full border border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sky-700 font-bold transition-colors cursor-pointer"
                  aria-label="Tambah Dewasa"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Infants Counter */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div>
                <div className="text-xs font-bold text-slate-900">Bayi</div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  Usia &lt; 3 tahun &bull; Dipangku (Rp 0)
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDecreaseInfants}
                  disabled={infants <= 0}
                  className="w-7 h-7 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer"
                  aria-label="Kurangi Bayi"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-mono font-black text-sm text-slate-900">
                  {infants}
                </span>
                <button
                  type="button"
                  onClick={handleIncreaseInfants}
                  disabled={infants >= adults || infants >= 4}
                  className="w-7 h-7 rounded-full border border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sky-700 font-bold transition-colors cursor-pointer"
                  aria-label="Tambah Bayi"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {infants >= adults && (
              <div className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                Maksimal 1 bayi per 1 penumpang dewasa (aturan keselamatan PT KAI & Bus).
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Simpan & Terapkan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
