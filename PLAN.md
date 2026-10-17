# PLAN.md — Sistem Enterprise OTA & CRS SMK (Edukasi & Operasional ULP/ULW & Perhotelan)

## 1. Visi & Standar Kualitas (STRICT ANTI-AI-SLOP RULES)
Aplikasi ini adalah gabungan **Computer Reservation System (seperti KAI Access)** dan **Online Travel Agent (seperti Traveloka)** untuk praktik jurusan ULP/ULW & Perhotelan serta operasional Kunjungan Industri (KI) sekolah.

### Aturan Mutlak Anti-AI-Slop (UI/UX & Code):
1. **DILARANG KERAS** menggunakan gradasi ungu-biru neon (`from-indigo-500 to-purple-600`), glassmorphism berlebihan, atau ikon generik tanpa fungsi.
2. **Design System (UI/UX Pro Max):** Gunakan gaya **Clean Transactional OTA** (inspirasi Traveloka / KAI Access / Stripe):
   - Background utama: `#F8FAFC` (Slate 50), Surface Card: `#FFFFFF` dengan border tegas `1px solid #E2E8F0`.
   - Primary Brand: `#0284C7` (Sky/Ocean Blue) atau `#1E3A8A` (Deep Navy), Accent/CTA: `#F97316` (Vibrant Orange untuk tombol Pesan/Bayar).
   - Tipografi: `Plus Jakarta Sans` atau `Inter` untuk UI, dan **`JetBrains Mono`** wajib untuk Kode Booking (PNR), Nomor Kursi, Harga, Jam Keberangkatan, dan Countdown Timer.
3. **Zero Placeholder Policy:** Dilarang menulis `// TODO`, `alert('Fitur segera hadir')`, atau data *hardcoded* di komponen UI. Semua fitur harus terhubung ke database dan memiliki validasi utuh.
4. **Tech Stack UI (Wajib 100% Tailwind CSS):** Wajib 100% menggunakan Tailwind CSS utility classes. DILARANG KERAS menggunakan React inline `style={{...}}` atau menulis CSS manual di luar konfigurasi tema Tailwind.

---

## 2. Role-Based Access Control (RBAC - 6 Role Nyata)
1. `SUPER_ADMIN` (Guru Kabeng ULP / Tim Inti IT): Kelola Master Data (Stasiun, Armada, Gerbong, Akun, Audit Log).
2. `REVENUE_CONTROLLER` (Siswa ULP Divisi Jadwal & Tarif): Buat rute berarah (`OUTBOUND`/`INBOUND`), atur waktu transit multi-stasiun, harga per segmen & *subclass* (Ekonomi C/P, Eksekutif A/H), buka/tutup kuota.
3. `TICKETING_OFFICER` (Siswa ULP Kasir/Loket): Layani pembelian *Go-Show* di loket praktik, verifikasi pembayaran manual/VA simulasi, proses *Refund* & *Reschedule*.
4. `TOUR_PLANNER` (Siswa ULP Divisi Tour): Buat katalog paket wisata, *Itinerary Builder*, Kalkulator HPP *Tour Costing* (cetak PDF Quotation), kelola *Rooming List* kamar & kursi bus Kunjungan Industri.
5. `BOARDING_OFFICER` (Siswa ULP Konduktor / Tour Leader): Scan QR Boarding Pass via kamera HP, dan ceklis *Manifest Checkpoint* penumpang di bus.
6. `CUSTOMER` (Siswa/Guru/Publik): Cari tiket (One-Way & Round-Trip), pilih kursi per gerbong, *Online Check-in*, unduh PDF E-Ticket & E-Boarding Pass.

---

## 3. Standar Keamanan (Security-First Architecture)
1. **Anti-Race Condition (Concurrency Seat Lock):** Pemilihan kursi wajib menggunakan transaksi database atomik (`SELECT ... FOR UPDATE` atau `UNIQUE INDEX` dengan status aktif) + batas waktu `expires_at` (15 menit). Dua user tidak boleh pernah berhasil mengunci kursi yang sama pada segmen rute yang beririsan.
2. **Server-Side Price Calculation:** Frontend tidak pernah mengirim nominal harga total ke backend. Backend wajib menghitung ulang harga dari tabel `schedule_fares` berdasarkan segmen asal-tujuan, kelas, dan tipe penumpang (`ADULT` bayar penuh, `INFANT` Rp0/tanpa kursi).
3. **Cryptographic Signed QR Boarding Pass:** QR Code pada Boarding Pass tidak boleh hanya berisi teks PNR polos. Wajib berisi payload yang ditandatangani dengan **HMAC-SHA256** (`pnr + passenger_id + schedule_id + signature`) agar tidak bisa dipalsukan oleh siswa dengan generator QR biasa.
4. **RBAC Middleware & IDOR Protection:** Setiap *endpoint* wajib memverifikasi role pengguna dan kepemilikan transaksi (User A tidak bisa mengintip/mengunduh E-Ticket milik User B meskipun menebak ID transaksi).
5. **Input Validation & Rate Limiting:** Gunakan skema validasi ketat (Zod/Joi/FormRequest) dan batasi *request* pada endpoint pencarian, login, serta *seat locking* untuk mencegah *brute-force* atau *seat hoarding* (memborong kunci kursi tanpa bayar).

---

## 4. Skema Database Inti
- `users` (`id`, `name`, `email`, `password_hash`, `identity_number` [NIK/NISN], `role`, `phone`)
- `stations` (`id`, `code` [3 huruf unik, mis: MDN, LBP, RAP], `name`, `city`, `type` [TRAIN_STATION, BUS_TERMINAL, MEETING_POINT])
- `fleets` (`id`, `code`, `name`, `type` [TRAIN, BUS], `status`)
- `wagons` (`id`, `fleet_id`, `wagon_code` [EKS-1, EKO-1], `class` [EXECUTIVE, BUSINESS, ECONOMY], `rows`, `cols_layout` [mis: "2-2" atau "2-3"], `direction_indicator`)
- `routes` (`id`, `fleet_id`, `route_name`, `direction` [OUTBOUND, INBOUND])
- `route_stops` (`id`, `route_id`, `station_id`, `stop_order`, `arrival_offset_minutes`, `departure_offset_minutes`)
- `schedules` (`id`, `route_id`, `departure_date`, `base_departure_time`, `status` [OPEN, CLOSED, DEPARTED, DELAYED], `gate_info`)
- `schedule_fares` (`id`, `schedule_id`, `origin_station_id`, `destination_station_id`, `wagon_class`, `subclass`, `price`, `quota`)
- `bookings` (`id`, `invoice_number`, `user_id`, `trip_type` [ONE_WAY, ROUND_TRIP], `total_amount`, `payment_status` [PENDING, PAID, EXPIRED, REFUNDED], `locked_until`, `created_at`)
- `booking_segments` (`id`, `booking_id`, `pnr_code` [6 char unik], `segment_type` [DEPARTURE, RETURN], `schedule_id`, `origin_station_id`, `destination_station_id`)
- `booking_passengers` (`id`, `booking_segment_id`, `full_name`, `identity_number`, `pax_type` [ADULT, INFANT], `wagon_id`, `seat_number`, `boarding_status` [BOOKED, CHECKED_IN, BOARDED], `qr_signature`, `checked_in_at`, `boarded_at`)
- `tour_packages` (`id`, `slug`, `title`, `destination`, `duration_days`, `min_pax`, `price_per_pax`, `costing_json`, `status`)
- `tour_itineraries` (`id`, `tour_package_id`, `day_number`, `start_time`, `activity_title`, `description`, `location`)
- `tour_manifests` (`id`, `tour_package_id`, `bus_name`, `seat_number`, `room_number`, `user_id`, `checkpoint_1_status`, `checkpoint_2_status`, `checkpoint_3_status`)
- `audit_logs` (`id`, `user_id`, `action`, `target_id`, `ip_address`, `created_at`)

---

## 5. Checklist Fase Pengerjaan
- [x] Fase 1: Inisialisasi Project, Design System (UI/UX Pro Max), Skema Database, Auth & 6-Role RBAC. (SELESAI)
- [x] Fase 2: Modul Master Data, Rute Berarah Multi-Stasiun, Gerbong, & Harga per Segmen (`SUPER_ADMIN` & `REVENUE_CONTROLLER`). (SELESAI)
- [x] Fase 3: Mesin Pencarian Tiket, State Machine Pulang-Pergi (Round-Trip), & Interactive Wagon Seat Map. (SELESAI)
- [x] Fase 4: Engine Seat Locking 15 Menit (Anti Double-Book), Checkout, Simulasi Kasir/VA, PNR & PDF E-Ticket. (SELESAI)
- [x] Fase 5: Online Check-in, HMAC Signed QR Boarding Pass, Mobile Camera QR Scanner, & Layar TV FIDS Stasiun. (SELESAI)
- [x] Fase 6: Modul Khas ULP: Kalkulator HPP Tour Costing, Itinerary Builder, & Manajemen Bus/Kamar Kunjungan Industri. (SELESAI - 100% LENGKAP)