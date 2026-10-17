---
name: ui-ux-pro-max
description: Clean Transactional OTA & Enterprise CRS Design System guidelines. Strictly prohibits AI-slop (neon purple-blue gradients, generic glassmorphism) and enforces high-density, functional, transactional UI inspired by Traveloka, KAI Access, and Stripe.
---

# UI/UX Pro Max: Clean Transactional OTA Design System

## Core Design Principles (Strict Anti-AI-Slop)
1. **Zero AI Slop**:
   - Dilarang keras gradasi ungu-biru neon (`from-indigo-500 to-purple-600`), floating glassmorphism blur berlebihan, dan ilustrasi kartun generik.
   - Gunakan border solid tegas 1px (`#E2E8F0`), surface card murni putih (`#FFFFFF`), dan background netral sejuk Slate 50 (`#F8FAFC`).
2. **Color Palette (Transactional OTA)**:
   - Primary: `#0284C7` (Sky / Ocean Blue) & `#1E3A8A` (Deep Navy / Header & Navbar).
   - Secondary / Surface: `#FFFFFF` (Card), `#F1F5F9` (Muted), `#E2E8F0` (Border).
   - Call-To-Action (CTA): `#F97316` (Vibrant Action Orange) untuk tombol bayar/pesan/checkout.
   - Status: Success `#16A34A` (Hijau KAI), Warning `#EAB308`, Danger `#DC2626`, Info `#0284C7`.
3. **Typography**:
   - UI & Content: `Plus Jakarta Sans`, `Inter`, -apple-system, sans-serif.
   - Transactional Tokens: `JetBrains Mono`, monospace (Wajib untuk PNR 6-char, nomor kursi, harga Rupiah, jam keberangkatan, dan countdown timer).
4. **Layout Architecture**:
   - **Public Storefront**: Navbar biru navy/ocean dengan menu pencarian cepat tiket kereta & bus, status booking (cek PNR), paket tour sekolah, dan auth.
   - **Operational Backoffice Workspace**: Sidebar padat, fungsional, dan adaptif untuk 6 role (SUPER_ADMIN, REVENUE_CONTROLLER, TICKETING_OFFICER, TOUR_PLANNER, BOARDING_OFFICER, CUSTOMER).
   - High information density dengan padding proporsional (bukan whitespace raksasa kosong).
5. **Zero Placeholder Policy**:
   - Semua form, tombol, dan tabel harus memiliki fungsi nyata, terhubung ke backend database, dan menyajikan status yang jelas.
