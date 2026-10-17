import React from 'react';
import Link from 'next/link';
import {
  Train,
  Building2,
  CalendarClock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Users,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { ROLE_CONFIGS } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export default async function BackofficeDashboard() {
  const user = await getCurrentUser();
  const db = getDatabase();

  // Load real metrics from database
  const stationsCount = (db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number }).count;
  const fleetsCount = (db.prepare('SELECT COUNT(*) as count FROM fleets').get() as { count: number }).count;
  const wagonsCount = (db.prepare('SELECT COUNT(*) as count FROM wagons').get() as { count: number }).count;
  const schedulesCount = (db.prepare('SELECT COUNT(*) as count FROM schedules').get() as { count: number }).count;
  const toursCount = (db.prepare('SELECT COUNT(*) as count FROM tour_packages').get() as { count: number }).count;
  const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;

  // Recent audit logs
  const recentLogs = db
    .prepare(`
      SELECT a.*, u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 6
    `)
    .all() as unknown as Array<{
    id: number;
    action: string;
    target_id: string;
    created_at: string;
    user_name: string;
    user_role: string;
    details: string;
  }>;

  // Active fleets
  const fleetsList = db.prepare('SELECT * FROM fleets LIMIT 4').all() as unknown as Array<{
    id: number;
    code: string;
    name: string;
    type: string;
    status: string;
  }>;

  const roleConfig = user ? ROLE_CONFIGS[user.role] : ROLE_CONFIGS.SUPER_ADMIN;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white border-l-4 border-l-sky-600 border border-slate-200 rounded-lg p-5 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              <ShieldCheck className="w-3.5 h-3.5" /> {roleConfig.code}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Konsol Manajemen CRS & OTA SMK
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Selamat Datang, {user?.name}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {roleConfig.description}
          </p>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-right">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
            Status Operasional
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs font-bold text-emerald-700 font-mono">
              ONLINE & SYNCHRONIZED
            </span>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Stasiun / Hub
              </div>
              <div className="font-mono font-bold text-2xl text-slate-900 mt-1">
                {stationsCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate">
            MDN, LBP, TBI, KIS, RAP
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Armada Aktif
              </div>
              <div className="font-mono font-bold text-2xl text-slate-900 mt-1">
                {fleetsCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Train className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate">
            2 Kereta & 2 Bus KI
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Gerbong/Kabin
              </div>
              <div className="font-mono font-bold text-2xl text-slate-900 mt-1">
                {wagonsCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate">
            Eks 2-2 & Eko 3-2
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Jadwal Dinas
              </div>
              <div className="font-mono font-bold text-2xl text-slate-900 mt-1">
                {schedulesCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate">
            Outbound & Inbound
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Paket Tour
              </div>
              <div className="font-mono font-bold text-2xl text-slate-900 mt-1">
                {toursCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate">
            HPP & Costing ULP
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Akun Role
              </div>
              <div className="font-mono font-bold text-2xl text-slate-900 mt-1">
                {usersCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate">
            6 Role RBAC Aktif
          </div>
        </div>
      </div>

      {/* Main Grid: Fleets & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Fleets */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Train className="w-4 h-4 text-sky-600" /> Armada Kereta & Bus Pariwisata
            </div>
            <Link
              href="/backoffice/master/fleets"
              className="text-xs text-sky-600 font-semibold flex items-center gap-1 hover:text-sky-700"
            >
              Kelola Armada <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="p-4 space-y-2.5">
            {fleetsList.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200/80"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${
                      f.type === 'TRAIN'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {f.type}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {f.name}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      Kode: {f.code}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Security & Operational Audit Log */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Activity className="w-4 h-4 text-sky-600" /> Log Audit Keamanan Terakhir
            </div>
            {user?.role === 'SUPER_ADMIN' && (
              <Link
                href="/backoffice/audit-logs"
                className="text-xs text-sky-600 font-semibold flex items-center gap-1 hover:text-sky-700"
              >
                Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <div className="p-3 divide-y divide-slate-100">
            {recentLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-xs">
                Belum ada catatan log audit.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="py-2.5 px-2 flex justify-between items-center text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                        {log.action}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {log.user_name || 'System Auto'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Target: <span className="font-mono font-medium">{log.target_id || '-'}</span>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleString('id-ID', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
