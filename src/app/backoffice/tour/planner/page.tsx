import React from 'react';
import { getDatabase } from '@/lib/db';
import { TourPlannerClient } from './TourPlannerClient';

export const dynamic = 'force-dynamic';

export default function TourPlannerPage() {
  const db = getDatabase();

  const rawPackages = db.prepare(`
    SELECT 
      tp.*,
      (SELECT COUNT(*) FROM tour_itineraries ti WHERE ti.tour_package_id = tp.id) as itineraries_count,
      (SELECT COUNT(*) FROM tour_manifests tm WHERE tm.tour_package_id = tp.id) as manifests_count
    FROM tour_packages tp
    ORDER BY tp.id DESC
  `).all() as Array<Record<string, any>>;

  const packages = rawPackages.map((pkg) => {
    let costing = null;
    try {
      costing = JSON.parse(pkg.costing_json);
    } catch {
      costing = null;
    }
    return {
      ...pkg,
      costing,
    };
  });

  return <TourPlannerClient initialPackages={packages as any} />;
}
