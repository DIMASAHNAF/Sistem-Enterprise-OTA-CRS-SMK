import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/travel.db');

console.log('--- Current Stations with TEST ---');
const testStations = db.prepare(`SELECT id, code, name, city FROM stations WHERE code LIKE 'TES%' OR name LIKE '%uji%' OR name LIKE '%Test%'`).all();
console.log(testStations);

if (testStations.length > 0) {
  for (const s of testStations) {
    db.prepare(`DELETE FROM route_stops WHERE station_id = ?`).run(s.id);
    db.prepare(`DELETE FROM stations WHERE id = ?`).run(s.id);
  }
  console.log(`Cleaned ${testStations.length} test stations.`);
}

console.log('--- Current Tour Packages ---');
const tourPkgs = db.prepare(`SELECT id, slug, title, status FROM tour_packages`).all();
console.log(tourPkgs);

// Clean up duplicate/test tour packages (e.g., ULP-3803, ULP-4717, test packages)
const testTourPkgs = db.prepare(`SELECT id, slug, title FROM tour_packages WHERE slug LIKE '%ulp-%' OR title LIKE '%ULP-%' OR title LIKE '%Test%' OR slug LIKE '%test%'`).all();
console.log('--- Test Tour Packages to delete ---', testTourPkgs);

if (testTourPkgs.length > 0) {
  for (const p of testTourPkgs) {
    db.prepare(`DELETE FROM tour_manifests WHERE tour_package_id = ?`).run(p.id);
    db.prepare(`DELETE FROM tour_itineraries WHERE tour_package_id = ?`).run(p.id);
    db.prepare(`DELETE FROM tour_packages WHERE id = ?`).run(p.id);
  }
  console.log(`Cleaned ${testTourPkgs.length} test tour packages.`);
}

console.log('--- Remaining Tour Packages ---');
console.log(db.prepare(`SELECT id, slug, title, destination, price_per_pax FROM tour_packages`).all());

console.log('--- Remaining Stations ---');
console.log(db.prepare(`SELECT id, code, name, city FROM stations`).all());
