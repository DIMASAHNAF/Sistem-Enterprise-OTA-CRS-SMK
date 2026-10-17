'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Train,
  Bus,
  Route,
  CalendarClock,
  ReceiptText,
  MapPin,
  QrCode,
  ShieldAlert,
  ArrowUpRight,
  Radio,
  Tv,
} from 'lucide-react';
import { BACKOFFICE_NAVIGATION, NavigationItem, ROLE_CONFIGS } from '@/lib/auth/rbac';
import { UserRole } from '@/lib/db/types';

interface BackofficeSidebarProps {
  userRole: UserRole;
  userName: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  Building2: <Building2 className="w-4 h-4" />,
  Train: <Train className="w-4 h-4" />,
  Bus: <Bus className="w-4 h-4" />,
  Route: <Route className="w-4 h-4" />,
  CalendarClock: <CalendarClock className="w-4 h-4" />,
  ReceiptText: <ReceiptText className="w-4 h-4" />,
  MapPin: <MapPin className="w-4 h-4" />,
  QrCode: <QrCode className="w-4 h-4" />,
  ShieldAlert: <ShieldAlert className="w-4 h-4" />,
  Tv: <Tv className="w-4 h-4" />,
};

export function BackofficeSidebar({ userRole }: BackofficeSidebarProps) {
  const pathname = usePathname();
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS.SUPER_ADMIN;

  const allowedNav = BACKOFFICE_NAVIGATION.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 min-w-[16rem] bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 border-r border-slate-800">
      {/* Brand & Division Header */}
      <div className="p-4 border-b border-slate-800">
        <Link href="/backoffice" className="flex items-center gap-3 text-white">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
            CRS
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-tight leading-tight">
              SMK RESERVASI
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Operational Backoffice
            </div>
          </div>
        </Link>

        {/* Current Active Role Badge */}
        <div className="mt-4 p-2.5 rounded-md bg-slate-800/80 border border-slate-700/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Role Aktif
            </span>
            <span className="text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 rounded">
              {userRole}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-100">
            {roleConfig.title}
          </div>
          <div className="text-[11px] text-sky-400 mt-0.5">
            {roleConfig.badgeLabel}
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider px-2 py-1">
          Menu Operasional ({allowedNav.length})
        </div>

        {allowedNav.map((item: NavigationItem) => {
          const isActive =
            item.href === '/backoffice'
              ? pathname === '/backoffice'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white font-bold border-l-2 border-sky-300'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>
                {ICON_MAP[item.iconName] || <LayoutDashboard className="w-4 h-4" />}
              </span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* System Status & Public Storefront Link */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between text-xs text-sky-400 px-2.5 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 font-semibold hover:bg-slate-800 transition-colors"
        >
          <span>Buka Etalase Publik</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse" /> SQLite WAL
          </span>
          <span className="font-mono text-slate-400">SMK-CRS v1.0</span>
        </div>
      </div>
    </aside>
  );
}
