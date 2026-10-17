'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Clock, ShieldCheck } from 'lucide-react';
import { UserRole } from '@/lib/db/types';
import { ROLE_CONFIGS } from '@/lib/auth/rbac';

interface BackofficeHeaderProps {
  userRole: UserRole;
  userName: string;
  userEmail: string;
}

export function BackofficeHeader({ userRole, userName, userEmail }: BackofficeHeaderProps) {
  const router = useRouter();
  const [time, setTime] = useState<string>('');
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS.SUPER_ADMIN;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.refresh();
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      {/* Left side: Context badge */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
          <ShieldCheck className="w-3.5 h-3.5" /> {roleConfig.code}
        </span>
        <span className="text-xs text-slate-500 font-medium hidden md:inline">
          {roleConfig.description}
        </span>
      </div>

      {/* Right side: Live clock, user info, logout */}
      <div className="flex items-center gap-4">
        {/* Clock */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span className="font-mono text-slate-900 font-semibold">
            {time || '00:00:00 WIB'}
          </span>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs border border-sky-200">
            {userName.charAt(0)}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-900 leading-tight">
              {userName}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {userEmail}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors font-semibold"
          title="Keluar dari sesi backoffice"
        >
          <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
