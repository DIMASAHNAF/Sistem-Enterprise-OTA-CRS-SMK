import React, { Suspense } from 'react';
import { getDatabase } from '@/lib/db';
import SearchClient from './SearchClient';
import { StationOption } from '@/components/search/SearchWidget';
import { StorefrontNavbar } from '@/components/layout/StorefrontNavbar';

export const dynamic = 'force-dynamic';

function SearchLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <StorefrontNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Memuat hasil pencarian tiket perjalanan...</p>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const db = getDatabase();

  const rawStations = db.prepare(`
    SELECT id, code, name, city, type
    FROM stations
    ORDER BY city ASC, name ASC
  `).all() as any[];
  const stations: StationOption[] = rawStations.map((s) => ({ ...s }));

  return (
    <Suspense fallback={<SearchLoadingFallback />}>
      <SearchClient stations={stations} />
    </Suspense>
  );
}
