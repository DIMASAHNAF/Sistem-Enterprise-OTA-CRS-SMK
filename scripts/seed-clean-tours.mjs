import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/travel.db');

const check2 = db.prepare(`SELECT id FROM tour_packages WHERE slug = ?`).get('ki-pt-inalum-geowisata-2d1n');
if (!check2) {
  const costing2 = {
    bus_cost: 3500000,
    hotel_cost: 6000000,
    meal_cost: 4800000,
    ticket_cost: 2000000,
    insurance_cost: 600000,
    misc_cost: 1100000,
    margin_percentage: 15,
    pax_count: 40,
    subtotal: 18000000,
    margin_amount: 2700000,
    total_selling_price: 20700000,
    price_per_pax: 517500
  };

  const res = db.prepare(`
    INSERT INTO tour_packages (slug, title, destination, duration_days, min_pax, price_per_pax, costing_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(
    'ki-pt-inalum-geowisata-2d1n',
    'Kunjungan Industri PT Inalum Smelting & Geowisata Danau Toba (2H1M)',
    'Kuala Tanjung & Parapat, Sumatera Utara',
    2,
    30,
    520000,
    JSON.stringify(costing2)
  );

  const pkgId = Number(res.lastInsertRowid);
  db.prepare(`
    INSERT INTO tour_itineraries (tour_package_id, day_number, start_time, activity_title, description, location)
    VALUES 
    (?, 1, '06:30', 'Kumpul & Pelepasan Rombongan', 'Briefing keselamatan perjalanan dari Guru Pembimbing ULP di gerbang sekolah.', 'SMK Negeri 1 Percut Sei Tuan'),
    (?, 1, '09:30', 'Observasi Industri Smelter Aluminium', 'Studi proses reduksi dan peleburan aluminium primer ramah lingkungan di PT Inalum.', 'PT Indonesia Asahan Aluminium, Kuala Tanjung'),
    (?, 1, '14:30', 'Perjalanan & Check-in Hotel Danau Toba', 'Check-in hotel rekanan ULP dan istirahat santai di tepi danau.', 'Parapat, Danau Toba'),
    (?, 2, '08:00', 'Observasi Geosite & Tata Kelola Wisata', 'Praktek pemanduan wisata siswa ULP di Geopark Kaldera Toba.', 'Batu Gantung & Danau Toba'),
    (?, 2, '14:00', 'Belanja Oleh-Oleh Khas & Perjalanan Pulang', 'Kunjungan UMKM tenun Ulos Pematang Siantar dan perjalanan kembali ke Medan.', 'Pematang Siantar')
  `).run(pkgId, pkgId, pkgId, pkgId, pkgId);
  console.log('Added Tour Package 2: Inalum & Geowisata');
}

const check3 = db.prepare(`SELECT id FROM tour_packages WHERE slug = ?`).get('medan-heritage-hospitality-1d');
if (!check3) {
  const costing3 = {
    bus_cost: 1500000,
    hotel_cost: 0,
    meal_cost: 2000000,
    ticket_cost: 1000000,
    insurance_cost: 400000,
    misc_cost: 500000,
    margin_percentage: 15,
    pax_count: 35,
    subtotal: 5400000,
    margin_amount: 810000,
    total_selling_price: 6210000,
    price_per_pax: 177400
  };

  const res = db.prepare(`
    INSERT INTO tour_packages (slug, title, destination, duration_days, min_pax, price_per_pax, costing_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(
    'medan-heritage-hospitality-1d',
    'City Tour Medan Heritage & Benchmarking Perhotelan Bintang 5 (1 Hari)',
    'Kota Medan, Sumatera Utara',
    1,
    25,
    185000,
    JSON.stringify(costing3)
  );

  const pkgId = Number(res.lastInsertRowid);
  db.prepare(`
    INSERT INTO tour_itineraries (tour_package_id, day_number, start_time, activity_title, description, location)
    VALUES 
    (?, 1, '07:30', 'Meeting Point Kampus Praktik ULP', 'Registrasi dan pembagian ID card serta buku panduan tour panduan siswa.', 'Kampus Praktik ULP Medan'),
    (?, 1, '09:00', 'Observasi Sejarah Deli di Istana Maimun', 'Praktek pemanduan bahasa asing dan telaah arsitektur Melayu-Islam.', 'Istana Maimun Medan'),
    (?, 1, '11:30', 'Hotel Showroom & Table Manner Course', 'Observasi operasional Front Office dan Housekeeping di Hotel Bintang 5.', 'Grand City Hall Hotel Medan'),
    (?, 1, '15:00', 'Kunjungan Museum Perkebunan Indonesia', 'Mempelajari sejarah komoditas tembakau Deli dan perkebunan sawit modern.', 'Museum Perkebunan Indonesia')
  `).run(pkgId, pkgId, pkgId, pkgId);
  console.log('Added Tour Package 3: Medan Heritage & Hospitality');
}
