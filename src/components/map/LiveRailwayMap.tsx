'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Info, Clock, CheckCircle2 } from 'lucide-react';

interface StationNode {
  code: string;
  name: string;
  city: string;
  x: number;
  y: number;
  type: 'TRAIN' | 'BUS';
  isHub?: boolean;
}

const STATIONS: StationNode[] = [
  { code: 'MDN', name: 'Stasiun Medan', city: 'Kota Medan', x: 70, y: 70, type: 'TRAIN', isHub: true },
  { code: 'LBP', name: 'Lubuk Pakam', city: 'Deli Serdang', x: 175, y: 85, type: 'TRAIN' },
  { code: 'TBI', name: 'Tebing Tinggi', city: 'Tebing Tinggi', x: 285, y: 110, type: 'TRAIN', isHub: true },
  { code: 'KIS', name: 'Kisaran', city: 'Asahan', x: 420, y: 140, type: 'TRAIN', isHub: true },
  { code: 'RAP', name: 'Rantau Prapat', city: 'Labuhanbatu', x: 590, y: 165, type: 'TRAIN' },
  { code: 'TNB', name: 'Tanjung Balai', city: 'Tanjung Balai', x: 510, y: 75, type: 'TRAIN' },
  { code: 'TOBA', name: 'Danau Toba', city: 'Parapat', x: 335, y: 185, type: 'BUS' },
];

interface Props {
  onSelectStation?: (code: string) => void;
}

export function LiveRailwayMap({ onSelectStation }: Props) {
  const [selectedStation, setSelectedStation] = useState<StationNode | null>(null);
  const [hoveredStationCode, setHoveredStationCode] = useState<string | null>(null);

  return (
    <div className="w-full bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-5 shadow-2xl relative text-slate-100 font-sans">
      {/* Top Header of the Map Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <Radio className="w-4 h-4 animate-pulse text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs tracking-tight text-white uppercase">
                Radar Jalur Rel & Armada Sumut
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Visualisasi real-time lintasan kereta Divre 1 & rute bus KI SMK
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400 font-bold">● 3 Armada Aktif</span> di Jalur
          </div>
        </div>
      </div>

      {/* SVG Canvas Map: Purely Responsive 680x240 Without Scrollbars */}
      <div className="relative w-full">
        <svg
          viewBox="0 0 680 240"
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Defs: Gradients and Glow Filter */}
          <defs>
            <linearGradient id="mainTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>

            <linearGradient id="branchTrackGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Beds */}
          <path
            d="M 70 70 Q 175 85 285 110 T 420 140 T 590 165"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 420 140 Q 465 105 510 75"
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 285 110 Q 310 150 335 185"
            fill="none"
            stroke="#1e293b"
            strokeWidth="5"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />

          {/* Active Glowing Main Tracks */}
          <path
            d="M 70 70 Q 175 85 285 110 T 420 140 T 590 165"
            fill="none"
            stroke="url(#mainTrackGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#trackGlow)"
          />
          <path
            d="M 420 140 Q 465 105 510 75"
            fill="none"
            stroke="url(#branchTrackGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 285 110 Q 310 150 335 185"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />

          {/* Live Moving Train 1: KA Sribilah Utama (MDN -> RAP) */}
          <motion.g
            animate={{
              x: [0, 105, 215, 350, 520],
              y: [0, 15, 40, 70, 95],
            }}
            transition={{
              duration: 14,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="pointer-events-none"
          >
            <circle cx="70" cy="70" r="10" fill="#0284c7" opacity="0.4" className="animate-ping" />
            <circle cx="70" cy="70" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
            <g transform="translate(15, -28)">
              <rect x="70" y="70" width="105" height="18" rx="4" fill="#090d16" stroke="#0284c7" strokeWidth="1" />
              <text x="76" y="83" fill="#e2e8f0" fontSize="9" fontFamily="monospace" fontWeight="bold">
                🚆 Sribilah (85 km/j)
              </text>
            </g>
          </motion.g>

          {/* Live Moving Train 2: KA Putri Deli (Branching from Kisaran to TNB) */}
          <motion.g
            animate={{
              x: [0, 45, 90],
              y: [0, -32, -65],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="pointer-events-none"
          >
            <circle cx="420" cy="140" r="8" fill="#10b981" opacity="0.4" className="animate-ping" />
            <circle cx="420" cy="140" r="4.5" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />
            <g transform="translate(15, -24)">
              <rect x="420" y="140" width="95" height="18" rx="4" fill="#090d16" stroke="#10b981" strokeWidth="1" />
              <text x="425" y="153" fill="#e2e8f0" fontSize="9" fontFamily="monospace" fontWeight="bold">
                🚆 KA Putri Deli
              </text>
            </g>
          </motion.g>

          {/* Station Nodes: Absolute Circle Coordinates (Zero Transform Scale to Prevent Jumping) */}
          {STATIONS.map((st) => {
            const isSelected = selectedStation?.code === st.code;
            const isHovered = hoveredStationCode === st.code;

            return (
              <g
                key={st.code}
                onClick={() => {
                  setSelectedStation(st);
                  if (onSelectStation) onSelectStation(st.code);
                }}
                onMouseEnter={() => setHoveredStationCode(st.code)}
                onMouseLeave={() => setHoveredStationCode(null)}
                className="cursor-pointer"
              >
                {/* Outer Glow Halo on Hover or Selection */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={isSelected ? 16 : 14}
                    fill={isSelected ? '#f97316' : '#0284c7'}
                    opacity={isSelected ? 0.35 : 0.25}
                    className="pointer-events-none"
                  />
                )}

                {/* Base Station Circle with Fixed Center */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={isSelected ? 10 : isHovered ? 9 : st.isHub ? 8 : 6.5}
                  fill={isSelected ? '#f97316' : isHovered ? '#38bdf8' : st.isHub ? '#0284c7' : '#0f172a'}
                  stroke={isSelected ? '#ffedd5' : isHovered ? '#ffffff' : '#38bdf8'}
                  strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                  className="transition-colors duration-200"
                />

                {/* Inner White Core Dot */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={isSelected ? 4 : isHovered ? 3.5 : 2.5}
                  fill="#ffffff"
                  className="pointer-events-none"
                />

                {/* Station Code Label */}
                <text
                  x={st.x}
                  y={st.y - (st.isHub ? 14 : 12)}
                  textAnchor="middle"
                  fill={isSelected ? '#fb923c' : isHovered ? '#ffffff' : st.isHub ? '#38bdf8' : '#94a3b8'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  className="transition-colors duration-150 select-none pointer-events-none"
                >
                  {st.code}
                </text>

                {/* Station City Name */}
                <text
                  x={st.x}
                  y={st.y + (st.isHub ? 18 : 16)}
                  textAnchor="middle"
                  fill={isHovered ? '#cbd5e1' : '#64748b'}
                  fontSize="8.5"
                  className="transition-colors duration-150 select-none pointer-events-none"
                >
                  {st.name.replace('Stasiun ', '')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Live Info Strip */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-[11px] text-slate-400">
            {selectedStation ? (
              <span>
                Stasiun Terpilih: <strong className="text-white font-mono">{selectedStation.code} ({selectedStation.name})</strong> &bull; Klik untuk cari tiket dari sini.
              </span>
            ) : (
              <span>Klik salah satu titik stasiun pada peta untuk memilih stasiun pencarian tiket secara instan.</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded-md border border-sky-800/60">
            <Clock className="w-3 h-3" /> KA Sribilah (MDN-RAP): On-Schedule
          </span>
        </div>
      </div>
    </div>
  );
}
