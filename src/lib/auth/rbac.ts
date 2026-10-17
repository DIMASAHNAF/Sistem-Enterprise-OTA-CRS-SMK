import { UserRole } from '@/lib/db/types';

export interface RoleConfig {
  code: UserRole;
  title: string;
  badgeLabel: string;
  description: string;
  defaultDashboard: string;
  allowedPrefixes: string[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    title: 'Super Administrator',
    badgeLabel: 'IT & Guru Kabeng ULP',
    description: 'Akses penuh seluruh master data, armada, stasiun, manajemen akun, dan audit log.',
    defaultDashboard: '/backoffice',
    allowedPrefixes: ['/backoffice'],
  },
  REVENUE_CONTROLLER: {
    code: 'REVENUE_CONTROLLER',
    title: 'Revenue Controller',
    badgeLabel: 'Divisi Jadwal & Tarif ULP',
    description: 'Manajemen rute multi-stasiun, jadwal dinas, harga per segmen & subclass, serta kuota kursi.',
    defaultDashboard: '/backoffice/revenue/schedules',
    allowedPrefixes: [
      '/backoffice',
      '/backoffice/revenue',
      '/backoffice/master/stations',
      '/backoffice/master/fleets',
    ],
  },
  TICKETING_OFFICER: {
    code: 'TICKETING_OFFICER',
    title: 'Ticketing Officer',
    badgeLabel: 'Kasir & Loket Praktik ULP',
    description: 'Layanan penjualan tiket Go-Show langsung di loket praktik, verifikasi bayar, refund, & reschedule.',
    defaultDashboard: '/backoffice/ticketing/pos',
    allowedPrefixes: ['/backoffice', '/backoffice/ticketing'],
  },
  TOUR_PLANNER: {
    code: 'TOUR_PLANNER',
    title: 'Tour Planner',
    badgeLabel: 'Divisi Tour & KI ULP',
    description: 'Perancang paket wisata, itinerary builder, kalkulator HPP tour costing, serta rooming & seat manifest.',
    defaultDashboard: '/backoffice/tour/planner',
    allowedPrefixes: ['/backoffice', '/backoffice/tour'],
  },
  BOARDING_OFFICER: {
    code: 'BOARDING_OFFICER',
    title: 'Boarding Officer',
    badgeLabel: 'Konduktor / Tour Leader',
    description: 'Petugas gerbang stasiun & tour leader bus untuk validasi QR Boarding Pass dan checklist manifest.',
    defaultDashboard: '/backoffice/boarding/scanner',
    allowedPrefixes: ['/backoffice', '/backoffice/boarding', '/backoffice/tour/manifests'],
  },
  CUSTOMER: {
    code: 'CUSTOMER',
    title: 'Customer / Siswa',
    badgeLabel: 'Penumpang & Wisatawan',
    description: 'Pelanggan umum / siswa untuk pencarian tiket, pemesanan kursi, dan online check-in.',
    defaultDashboard: '/',
    allowedPrefixes: ['/my-bookings', '/check-in'],
  },
};

export interface NavigationItem {
  name: string;
  href: string;
  iconName: string;
  roles: UserRole[];
  description?: string;
}

export const BACKOFFICE_NAVIGATION: NavigationItem[] = [
  {
    name: 'Ringkasan Sistem',
    href: '/backoffice',
    iconName: 'LayoutDashboard',
    roles: ['SUPER_ADMIN', 'REVENUE_CONTROLLER', 'TICKETING_OFFICER', 'TOUR_PLANNER', 'BOARDING_OFFICER'],
    description: 'Status umum operasional armada dan ringkasan aktivitas',
  },
  {
    name: 'Data Stasiun & Terminal',
    href: '/backoffice/master/stations',
    iconName: 'Building2',
    roles: ['SUPER_ADMIN', 'REVENUE_CONTROLLER'],
    description: 'Master data stasiun kereta, terminal bus, & titik kumpul',
  },
  {
    name: 'Armada & Susunan Gerbong',
    href: '/backoffice/master/fleets',
    iconName: 'Train',
    roles: ['SUPER_ADMIN', 'REVENUE_CONTROLLER'],
    description: 'Spesifikasi kereta & bus pariwisata beserta denah gerbong',
  },
  {
    name: 'Rute Berarah & Stops',
    href: '/backoffice/revenue/routes',
    iconName: 'Route',
    roles: ['SUPER_ADMIN', 'REVENUE_CONTROLLER'],
    description: 'Manajemen rute multi-stasiun, urutan transit, dan generator rute pulang',
  },
  {
    name: 'Jadwal & Tarif Segmen',
    href: '/backoffice/revenue/schedules',
    iconName: 'CalendarClock',
    roles: ['SUPER_ADMIN', 'REVENUE_CONTROLLER'],
    description: 'Kontrol rute, subclass tarif (A/H/C/P), dan alokasi kuota',
  },
  {
    name: 'Loket Tiket (Go-Show POS)',
    href: '/backoffice/ticketing/pos',
    iconName: 'ReceiptText',
    roles: ['SUPER_ADMIN', 'TICKETING_OFFICER'],
    description: 'Pemesanan langsung loket stasiun & verifikasi pembayaran',
  },
  {
    name: 'Tour Planner & HPP Costing',
    href: '/backoffice/tour/planner',
    iconName: 'MapPin',
    roles: ['SUPER_ADMIN', 'TOUR_PLANNER'],
    description: 'Itinerary builder, kalkulator HPP, & cetak quotation',
  },
  {
    name: 'Manifest & Checkpoint Bus KI',
    href: '/backoffice/tour/manifests',
    iconName: 'Bus',
    roles: ['SUPER_ADMIN', 'TOUR_PLANNER', 'BOARDING_OFFICER'],
    description: 'Rooming list, alokasi kursi bus, & absensi checkpoint tour leader',
  },
  {
    name: 'QR Scanner & Manifest',
    href: '/backoffice/boarding/scanner',
    iconName: 'QrCode',
    roles: ['SUPER_ADMIN', 'BOARDING_OFFICER'],
    description: 'Pemindaian boarding pass & absensi checkpoint bus KI',
  },
  {
    name: 'Layar TV FIDS Stasiun',
    href: '/fids',
    iconName: 'Tv',
    roles: ['SUPER_ADMIN', 'REVENUE_CONTROLLER', 'TICKETING_OFFICER', 'BOARDING_OFFICER'],
    description: 'Papan informasi keberangkatan Smart TV stasiun real-time',
  },
  {
    name: 'Audit Log Keamanan',
    href: '/backoffice/audit-logs',
    iconName: 'ShieldAlert',
    roles: ['SUPER_ADMIN'],
    description: 'Catatan aktivitas transaksi, otentikasi, dan perubahan data',
  },
];

/**
 * Check whether a user role is permitted to access a given URL path
 */
export function isRouteAllowed(role: UserRole, pathname: string): boolean {
  if (role === 'SUPER_ADMIN') return true;

  // Backoffice root overview is allowed for all staff
  if (pathname === '/backoffice') {
    return role !== 'CUSTOMER';
  }

  const config = ROLE_CONFIGS[role];
  if (!config) return false;

  // Customers are redirected away from backoffice
  if (role === 'CUSTOMER' && pathname.startsWith('/backoffice')) {
    return false;
  }

  return config.allowedPrefixes.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
