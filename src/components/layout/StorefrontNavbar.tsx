'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Train,
  Bus,
  MapPin,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  User,
  QrCode,
  Tv,
  Menu,
  X,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface UserSession {
  id: number;
  name: string;
  email: string;
  role: string;
  roleTitle?: string;
  badgeLabel?: string;
}

export function StorefrontNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setSession(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession(null);
      setProfileDropdownOpen(false);
      setMobileMenuOpen(false);
      router.refresh();
      router.push('/');
    } catch (err) {
      console.error(err);
    }
  };

  const navLinks = [
    { href: '/', label: 'Tiket Kereta Api', icon: Train, exact: true },
    { href: '/tours', label: 'Paket Tour ULP', icon: MapPin },
    { href: '/check-in', label: 'Check-In', icon: QrCode },
    { href: '/fids', label: 'Layar FIDS', icon: Tv },
    { href: '/my-bookings', label: 'Pesanan Saya', icon: Ticket },
  ];

  const getActiveIndex = () => {
    for (let i = 0; i < navLinks.length; i++) {
      const item = navLinks[i];
      if (item.exact ? pathname === item.href : pathname.startsWith(item.href)) {
        return i;
      }
    }
    return -1;
  };

  const activeIndex = getActiveIndex();

  return (
    <header className="w-full sticky top-0 z-50">
      {/* Top Utility Bar: Swiss Railway Precision */}
      <div className="bg-slate-950 text-slate-300 text-xs py-1.5 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5 truncate">
            <span className="inline-flex items-center gap-1.5 font-bold text-sky-400 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              SMK Enterprise CRS & OTA
            </span>
            <span className="text-slate-700 hidden sm:inline">&bull;</span>
            <span className="text-slate-400 hidden sm:inline truncate">
              Praktik Jurusan ULP & Kunjungan Industri Sumut
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-slate-400">
            <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-sky-400" />
              <span>Operasional Live (WIB / UTC+7)</span>
            </div>
            <span className="text-slate-800 hidden md:inline">&bull;</span>
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Sistem Aktif
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar: Vercel Geist Sticky Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
              <Train className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-tight text-slate-900 whitespace-nowrap">
                SMK <span className="text-sky-600">TRAVEL</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200/80 tracking-wide uppercase whitespace-nowrap">
                CRS & OTA
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links: Vercel Sliding Spring Pill */}
          <div
            className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/70 rounded-full border border-slate-200/60 relative"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {navLinks.map((item, idx) => {
              const isActive = activeIndex === idx;
              const isHovered = hoveredIndex === idx;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap z-10 transition-colors duration-200 ${
                    isActive
                      ? 'text-sky-700 font-bold'
                      : isHovered
                      ? 'text-slate-900'
                      : 'text-slate-600'
                  }`}
                >
                  {/* Sliding pill indicator with spring physics */}
                  {(isHovered || (isActive && hoveredIndex === null)) && (
                    <motion.div
                      layoutId="navbar-sliding-pill"
                      transition={{
                        type: 'spring',
                        bounce: 0.18,
                        duration: 0.45,
                      }}
                      className="absolute inset-0 bg-white rounded-full shadow-2xs border border-slate-200/80 -z-10"
                    />
                  )}

                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      isActive ? 'text-sky-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Auth Actions & Compact Dropdown */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!loading && session ? (
              <div className="relative" ref={profileRef}>
                {/* Compact Avatar Pill */}
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-full pl-1.5 pr-2.5 py-1 transition-all duration-200 shadow-2xs cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs group-hover:scale-105 transition-transform">
                    {session.name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block max-w-[100px] truncate">
                    <div className="text-xs font-bold text-slate-900 truncate leading-tight">
                      {session.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono font-medium leading-none">
                      {session.role}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      profileDropdownOpen ? 'rotate-180 text-sky-600' : ''
                    }`}
                  />
                </button>

                {/* Animated Profile Dropdown Popover */}
                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-50 overflow-hidden"
                    >
                      <div className="p-3 bg-slate-50 rounded-xl mb-2 border border-slate-100">
                        <div className="font-extrabold text-xs text-slate-900 truncate">
                          {session.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">
                          {session.email}
                        </div>
                        <div className="mt-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            {session.role}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {session.role !== 'CUSTOMER' && (
                          <Link
                            href="/backoffice"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 text-sky-600" />
                            <span>Workspace Backoffice</span>
                          </Link>
                        )}

                        <Link
                          href="/my-bookings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                        >
                          <Ticket className="w-4 h-4 text-slate-400" />
                          <span>Riwayat Pesanan Saya</span>
                        </Link>

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Keluar dari Akun</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 whitespace-nowrap"
                >
                  Masuk
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-sm shadow-orange-500/20 transition-all duration-200 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Akun Demo</span>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Buka Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-lg overflow-hidden"
            >
              <div className="space-y-1">
                {navLinks.map((item) => {
                  const active =
                    item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-sky-50 text-sky-600 font-bold border border-sky-100'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {session ? (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                      {session.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{session.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{session.role}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200"
                  >
                    Keluar
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100"
                  >
                    Masuk Akun
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl text-xs font-bold bg-orange-500 text-white shadow-sm"
                  >
                    Buka Pilihan Akun Demo (6 Role)
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
