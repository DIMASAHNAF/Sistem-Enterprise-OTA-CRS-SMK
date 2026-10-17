'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Train, Bus, MapPin, Search, ChevronDown, Check } from 'lucide-react';
import { StationOption } from './SearchWidget';

interface CustomStationSelectProps {
  label: string;
  icon: React.ReactNode;
  value: string; // station code e.g. 'MDN'
  onChange: (code: string) => void;
  stations: StationOption[];
  placeholder?: string;
}

export function CustomStationSelect({
  label,
  icon,
  value,
  onChange,
  stations,
  placeholder = 'Pilih stasiun / terminal...',
}: CustomStationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);

  const selectedStation = stations.find((s) => s.code === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputSearchRef.current) {
      inputSearchRef.current.focus();
    }
  }, [isOpen]);

  const filteredStations = stations.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q)
    );
  });

  const getStationIcon = (type: string) => {
    if (type === 'BUS_TERMINAL') return <Bus className="w-3.5 h-3.5 text-emerald-600" />;
    if (type === 'MEETING_POINT') return <MapPin className="w-3.5 h-3.5 text-amber-600" />;
    return <Train className="w-3.5 h-3.5 text-sky-600" />;
  };

  return (
    <div className="relative min-w-0 w-full" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </label>

      {/* Trigger Button: Clean Geist Input Box with strict truncation & anti-blowout */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery('');
        }}
        title={selectedStation ? `${selectedStation.name} (${selectedStation.city})` : placeholder}
        className={`w-full min-w-0 text-left pl-3 pr-8 py-2.5 rounded-xl border transition-all duration-200 shadow-2xs flex items-center justify-between cursor-pointer overflow-hidden ${
          isOpen
            ? 'bg-white border-sky-500 ring-4 ring-sky-500/15'
            : 'bg-slate-50/70 hover:bg-white border-slate-300'
        }`}
      >
        <div className="min-w-0 flex-1 overflow-hidden pr-1">
          {selectedStation ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono font-black text-xs text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/80 shrink-0">
                {selectedStation.code}
              </span>
              <span className="font-bold text-xs text-slate-900 truncate">
                {selectedStation.name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-normal truncate block">{placeholder}</span>
          )}
        </div>

        <div className="absolute right-2.5 top-1/2 translate-y-1 text-slate-400 shrink-0 pointer-events-none">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-sky-600' : ''}`}
          />
        </div>
      </button>

      {/* Popover Dropdown with Search */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-50 max-h-72 flex flex-col overflow-hidden"
          >
            {/* Quick Filter Search Input */}
            <div className="relative mb-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputSearchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik kode (MDN, RAP) atau kota..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 placeholder:text-slate-400"
              />
            </div>

            {/* List of Stations */}
            <div className="overflow-y-auto space-y-1 pr-1 flex-1">
              {filteredStations.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Stasiun tidak ditemukan.
                </div>
              ) : (
                filteredStations.map((st) => {
                  const isSelected = st.code === value;
                  return (
                    <button
                      key={st.code}
                      type="button"
                      onClick={() => {
                        onChange(st.code);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-sky-50 text-sky-900 border border-sky-200/70 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          {getStationIcon(st.type)}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-sky-700">
                              {st.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {st.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate font-normal">
                            {st.city} &bull; {st.type === 'TRAIN_STATION' ? 'Stasiun Kereta' : st.type === 'BUS_TERMINAL' ? 'Terminal Bus' : 'Titik Kumpul SMK'}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-sky-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
