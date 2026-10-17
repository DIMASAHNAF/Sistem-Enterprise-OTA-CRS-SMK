import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    redirect('/backoffice/unauthorized');
  }

  const db = getDatabase();
  const logs = db
    .prepare(`
      SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `)
    .all() as unknown as Array<{
    id: number;
    action: string;
    target_id: string;
    ip_address: string;
    details: string;
    created_at: string;
    user_name: string;
    user_email: string;
    user_role: string;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Log Audit Keamanan & Riwayat Operasional Sistem (Audit Trail)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekaman aktivitas transaksi, otentikasi login, perubahan master data, dan verifikasi tiket
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5" /> HAK AKSES KHUSUS SUPER_ADMIN
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-2.5 w-16">ID</th>
                <th className="px-4 py-2.5">Waktu Transaksi (WIB)</th>
                <th className="px-4 py-2.5">Aksi Sistem</th>
                <th className="px-4 py-2.5">Pengguna / Pelaksana</th>
                <th className="px-4 py-2.5">Peran</th>
                <th className="px-4 py-2.5">Target ID</th>
                <th className="px-4 py-2.5">Alamat IP</th>
                <th className="px-4 py-2.5">Rincian Parameter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-slate-500">
                    #{log.id}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-900">
                    {new Date(log.created_at).toLocaleString('id-ID', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border ${
                        log.action.includes('FAILED')
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : log.action.includes('LOGIN')
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">
                      {log.user_name || 'System / Unauthenticated'}
                    </div>
                    {log.user_email && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        {log.user_email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.user_role ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        {log.user_role}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                        ANONYMOUS
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-800">
                    {log.target_id || '-'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] max-w-xs break-all text-slate-600 font-mono">
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
