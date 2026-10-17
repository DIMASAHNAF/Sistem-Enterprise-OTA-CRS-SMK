'use client';

import React from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface TourIllustrationProps {
  slug?: string;
  destination?: string;
  costing?: any;
  heightClass?: string;
}

export function TourLandscapeIllustration({
  slug = '',
  destination = '',
  costing,
  heightClass = 'h-36 sm:h-40',
}: TourIllustrationProps) {
  const isToba = slug.includes('toba') || destination.toLowerCase().includes('toba') || destination.toLowerCase().includes('samosir');
  const isInalum = slug.includes('inalum') || destination.toLowerCase().includes('inalum');
  const isMedan = slug.includes('medan') || destination.toLowerCase().includes('medan') || destination.toLowerCase().includes('heritage');

  // Extract HPP and Margin for transparent breakdown badge
  let hppPerPax: number | null = null;
  let marginPct: number | null = null;

  if (costing) {
    if (costing.hppPerPax) {
      hppPerPax = costing.hppPerPax;
    } else if (costing.subtotal && costing.pax_count) {
      hppPerPax = Math.round(costing.subtotal / costing.pax_count);
    }
    marginPct = costing.marginPercentage || costing.margin_percentage || 15;
  }

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden select-none bg-slate-900`}>
      {/* Dynamic Thematic SVG Landscape */}
      {isToba ? (
        /* Danau Toba & Samosir Landscape SVG */
        <svg
          viewBox="0 0 400 160"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full object-cover"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="tobaSky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0c4a6e" />
              <stop offset="50%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="tobaWater" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#082f49" />
            </linearGradient>
            <linearGradient id="mountainFar" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#075985" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="mountainNear" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Sky with Sun */}
          <rect width="400" height="160" fill="url(#tobaSky)" />
          <circle cx="310" cy="45" r="24" fill="#fed7aa" opacity="0.65" />
          <circle cx="310" cy="45" r="32" fill="#fed7aa" opacity="0.2" />

          {/* Clouds */}
          <path d="M40 35 Q55 25 70 35 Q85 30 95 40 L35 40 Z" fill="#ffffff" opacity="0.25" />
          <path d="M180 25 Q195 18 210 25 Q225 20 235 28 L175 28 Z" fill="#ffffff" opacity="0.2" />

          {/* Distant Mountains Caldera Wall */}
          <path d="M-10 100 Q40 55 110 75 Q180 50 250 80 Q320 60 410 95 L410 160 L-10 160 Z" fill="url(#mountainFar)" />

          {/* Midground Samosir Ridge */}
          <path d="M-20 115 Q60 85 140 100 Q220 80 300 105 Q360 90 420 115 L420 160 L-20 160 Z" fill="url(#mountainNear)" opacity="0.9" />

          {/* Lake Toba Water Surface */}
          <rect y="120" width="400" height="40" fill="url(#tobaWater)" />
          <path d="M20 130 Q50 128 80 130 T140 130 T200 130 T260 130 T320 130" stroke="#bae6fd" strokeWidth="1" fill="none" opacity="0.4" />
          <path d="M50 142 Q90 140 130 142 T210 142 T290 142 T370 142" stroke="#bae6fd" strokeWidth="1.2" fill="none" opacity="0.3" />

          {/* Traditional Batak House Roof Silhouette */}
          <path d="M260 118 L275 92 Q285 96 295 92 L310 118 Z" fill="#020617" />
          <path d="M272 92 L285 85 L298 92" stroke="#f59e0b" strokeWidth="1.5" fill="none" />

          {/* Ferry Boat Silhouette */}
          <path d="M70 125 L95 125 L90 132 L65 132 Z" fill="#f8fafc" opacity="0.9" />
          <rect x="74" y="121" width="12" height="4" fill="#0284c7" />
        </svg>
      ) : isInalum ? (
        /* PT Inalum High-Tech Smelting & Geowisata SVG */
        <svg
          viewBox="0 0 400 160"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full object-cover"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="inalumSky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="60%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="electricGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Night Sky & Industrial Grid */}
          <rect width="400" height="160" fill="url(#inalumSky)" />

          {/* Electric Grid Lines */}
          <line x1="0" y1="50" x2="400" y2="50" stroke="#065f46" strokeWidth="0.8" opacity="0.3" strokeDasharray="4 4" />
          <line x1="0" y1="90" x2="400" y2="90" stroke="#065f46" strokeWidth="0.8" opacity="0.3" strokeDasharray="4 4" />

          {/* Smelting Facility Silhouettes */}
          {/* Main Plant Facility */}
          <rect x="60" y="80" width="110" height="80" fill="#090d16" />
          <polygon points="60,80 115,65 170,80" fill="#0f172a" />
          {/* Windows / Lighting dots */}
          <circle cx="80" cy="95" r="2" fill="#34d399" opacity="0.8" />
          <circle cx="95" cy="95" r="2" fill="#34d399" opacity="0.8" />
          <circle cx="110" cy="95" r="2" fill="#34d399" opacity="0.8" />
          <circle cx="125" cy="95" r="2" fill="#34d399" opacity="0.8" />
          <circle cx="140" cy="95" r="2" fill="#34d399" opacity="0.8" />

          {/* Transmission Towers */}
          <path d="M210 160 L220 50 L230 160 M213 85 L227 85 M216 115 L224 115 M218 50 L210 65 M222 50 L230 65" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.7" />
          <path d="M260 160 L268 70 L276 160 M262 100 L274 100 M264 125 L272 125" stroke="#10b981" strokeWidth="1.2" fill="none" opacity="0.6" />

          {/* Modern Hydro/Smelting Turbine Silhouettes */}
          <path d="M300 120 Q330 95 360 120 L370 160 L290 160 Z" fill="#052e16" />
          <circle cx="330" cy="115" r="14" fill="#047857" opacity="0.5" />
          <circle cx="330" cy="115" r="5" fill="#a7f3d0" />

          {/* Power Glow Horizon */}
          <rect y="145" width="400" height="15" fill="#022c22" />
          <line x1="0" y1="145" x2="400" y2="145" stroke="#10b981" strokeWidth="1.5" opacity="0.8" />
        </svg>
      ) : (
        /* Medan Heritage & Hospitality Luxury SVG */
        <svg
          viewBox="0 0 400 160"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full object-cover"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="medanSky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="60%" stopColor="#312e81" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="domeGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="50%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Sunset Horizon */}
          <rect width="400" height="160" fill="url(#medanSky)" />
          <circle cx="200" cy="120" r="45" fill="#fbbf24" opacity="0.4" />

          {/* Colonial & Modern Hospitality Skyline */}
          {/* 5-Star Hotel Tower (Left) */}
          <rect x="40" y="45" width="55" height="115" fill="#0f172a" />
          <rect x="48" y="55" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="62" y="55" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="76" y="55" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="48" y="70" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="62" y="70" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="76" y="70" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="48" y="85" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="62" y="85" width="8" height="6" fill="#fde68a" opacity="0.7" />
          <rect x="76" y="85" width="8" height="6" fill="#fde68a" opacity="0.7" />

          {/* Maimun Palace Heritage Dome Silhouette (Center) */}
          <path d="M160 160 L160 110 L240 110 L240 160 Z" fill="#020617" />
          {/* Grand Dome */}
          <path d="M175 110 C175 80 225 80 225 110 Z" fill="url(#domeGold)" opacity="0.9" />
          <line x1="200" y1="78" x2="200" y2="70" stroke="#fde68a" strokeWidth="2" />
          <circle cx="200" cy="68" r="2" fill="#fde68a" />

          {/* Side Minarets */}
          <rect x="145" y="90" width="10" height="70" fill="#020617" />
          <path d="M143 90 C143 78 157 78 157 90 Z" fill="#b45309" />
          <rect x="245" y="90" width="10" height="70" fill="#020617" />
          <path d="M243 90 C243 78 257 78 257 90 Z" fill="#b45309" />

          {/* Palm Trees */}
          <path d="M310 160 Q315 130 325 110" stroke="#020617" strokeWidth="3" fill="none" />
          <path d="M325 110 Q310 95 295 105 M325 110 Q325 90 335 95 M325 110 Q345 100 355 115" stroke="#15803d" strokeWidth="2" fill="none" />
          
          <rect y="150" width="400" height="10" fill="#020617" />
        </svg>
      )}

      {/* Subtle Gradient Overlay for Text Legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

      {/* Top Floating Badge Strip */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-black/50 backdrop-blur-md text-white border border-white/20 shadow-xs">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{isToba ? 'Geowisata Danau Toba' : isInalum ? 'Industri Manufaktur' : 'Heritage & Perhotelan'}</span>
        </span>

        {/* Transparent Costing / HPP Badge */}
        {hppPerPax && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 backdrop-blur-md text-emerald-300 border border-emerald-500/40 shadow-xs">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>HPP Rp {(hppPerPax / 1000).toFixed(0)}rb • Mgn {marginPct}%</span>
          </span>
        )}
      </div>
    </div>
  );
}
