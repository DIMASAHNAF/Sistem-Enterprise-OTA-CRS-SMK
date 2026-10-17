import React from 'react';
import { getDatabase } from '@/lib/db';
import { TourManifestClient } from './TourManifestClient';

export const dynamic = 'force-dynamic';

export default function TourManifestsPage() {
  const db = getDatabase();

  const rawPackages = db.prepare(`
    SELECT id, title, destination, duration_days
    FROM tour_packages
    ORDER BY id DESC
  `).all() as any[];
  const packages = rawPackages.map((p) => ({ ...p }));

  const rawUsers = db.prepare(`
    SELECT id, name, identity_number, role
    FROM users
    ORDER BY name ASC
  `).all() as any[];
  const availableUsers = rawUsers.map((u) => ({ ...u }));

  return <TourManifestClient packages={packages} availableUsers={availableUsers} />;
}
