export const SCHEMA_SQL = `
-- =========================================================================
-- SISTEM ENTERPRISE OTA & CRS SMK (15 TABEL INTI)
-- Lengkap dengan Foreign Keys, Check Constraints, dan Indexes
-- =========================================================================

PRAGMA foreign_keys = ON;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'REVENUE_CONTROLLER', 'TICKETING_OFFICER', 'TOUR_PLANNER', 'BOARDING_OFFICER', 'CUSTOMER')),
  phone TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. STATIONS
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('TRAIN_STATION', 'BUS_TERMINAL', 'MEETING_POINT')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_code ON stations(code);
CREATE INDEX IF NOT EXISTS idx_stations_type ON stations(type);
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);

-- 3. FLEETS
CREATE TABLE IF NOT EXISTS fleets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('TRAIN', 'BUS')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fleets_code ON fleets(code);
CREATE INDEX IF NOT EXISTS idx_fleets_type ON fleets(type);

-- 4. WAGONS
CREATE TABLE IF NOT EXISTS wagons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  wagon_code TEXT NOT NULL,
  class TEXT NOT NULL CHECK(class IN ('EXECUTIVE', 'BUSINESS', 'ECONOMY')),
  rows INTEGER NOT NULL CHECK(rows > 0),
  cols_layout TEXT NOT NULL, -- "2-2", "3-2", "2-1"
  direction_indicator TEXT NOT NULL DEFAULT 'FORWARD' CHECK(direction_indicator IN ('FORWARD', 'BACKWARD', 'FACING')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fleet_id, wagon_code)
);
CREATE INDEX IF NOT EXISTS idx_wagons_fleet_id ON wagons(fleet_id);

-- 5. ROUTES
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE RESTRICT,
  route_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('OUTBOUND', 'INBOUND')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_routes_fleet_id ON routes(fleet_id);

-- 6. ROUTE STOPS
CREATE TABLE IF NOT EXISTS route_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  stop_order INTEGER NOT NULL CHECK(stop_order >= 0),
  arrival_offset_minutes INTEGER NOT NULL DEFAULT 0,
  departure_offset_minutes INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(route_id, stop_order)
);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_station_id ON route_stops(station_id);

-- 7. SCHEDULES
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  departure_date TEXT NOT NULL, -- YYYY-MM-DD
  base_departure_time TEXT NOT NULL, -- HH:MM
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'DEPARTED', 'DELAYED')),
  gate_info TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedules_route_date ON schedules(route_id, departure_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- 8. SCHEDULE FARES
CREATE TABLE IF NOT EXISTS schedule_fares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  origin_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  destination_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  wagon_class TEXT NOT NULL CHECK(wagon_class IN ('EXECUTIVE', 'BUSINESS', 'ECONOMY')),
  subclass TEXT NOT NULL, -- 'A', 'H', 'C', 'P'
  price INTEGER NOT NULL CHECK(price >= 0),
  quota INTEGER NOT NULL DEFAULT 0 CHECK(quota >= 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(schedule_id, origin_station_id, destination_station_id, wagon_class, subclass)
);
CREATE INDEX IF NOT EXISTS idx_schedule_fares_lookup ON schedule_fares(schedule_id, origin_station_id, destination_station_id);

-- 9. BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trip_type TEXT NOT NULL CHECK(trip_type IN ('ONE_WAY', 'ROUND_TRIP')),
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'PAID', 'EXPIRED', 'REFUNDED')),
  locked_until DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_invoice ON bookings(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- 10. BOOKING SEGMENTS
CREATE TABLE IF NOT EXISTS booking_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pnr_code TEXT NOT NULL UNIQUE,
  segment_type TEXT NOT NULL CHECK(segment_type IN ('DEPARTURE', 'RETURN')),
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  origin_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  destination_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_segments_pnr ON booking_segments(pnr_code);
CREATE INDEX IF NOT EXISTS idx_booking_segments_booking_id ON booking_segments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_segments_schedule_id ON booking_segments(schedule_id);

-- 11. BOOKING PASSENGERS
CREATE TABLE IF NOT EXISTS booking_passengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_segment_id INTEGER NOT NULL REFERENCES booking_segments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  pax_type TEXT NOT NULL CHECK(pax_type IN ('ADULT', 'INFANT')),
  wagon_id INTEGER REFERENCES wagons(id) ON DELETE RESTRICT,
  seat_number TEXT,
  boarding_status TEXT NOT NULL DEFAULT 'BOOKED' CHECK(boarding_status IN ('BOOKED', 'CHECKED_IN', 'BOARDED')),
  qr_signature TEXT,
  checked_in_at DATETIME,
  boarded_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_segment ON booking_passengers(booking_segment_id);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_seat ON booking_passengers(wagon_id, seat_number);

-- 12. TOUR PACKAGES
CREATE TABLE IF NOT EXISTS tour_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  min_pax INTEGER NOT NULL DEFAULT 10,
  price_per_pax INTEGER NOT NULL DEFAULT 0,
  costing_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('DRAFT', 'ACTIVE', 'PUBLISHED', 'ARCHIVED')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_packages_slug ON tour_packages(slug);
CREATE INDEX IF NOT EXISTS idx_tour_packages_status ON tour_packages(status);

-- 13. TOUR ITINERARIES
CREATE TABLE IF NOT EXISTS tour_itineraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_package_id INTEGER NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  start_time TEXT NOT NULL, -- HH:MM
  activity_title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tour_itineraries_package ON tour_itineraries(tour_package_id, day_number);

-- 14. TOUR MANIFESTS
CREATE TABLE IF NOT EXISTS tour_manifests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_package_id INTEGER NOT NULL REFERENCES tour_packages(id) ON DELETE RESTRICT,
  bus_name TEXT NOT NULL,
  seat_number TEXT NOT NULL,
  room_number TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checkpoint_1_status INTEGER NOT NULL DEFAULT 0,
  checkpoint_2_status INTEGER NOT NULL DEFAULT 0,
  checkpoint_3_status INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tour_manifests_package ON tour_manifests(tour_package_id);
CREATE INDEX IF NOT EXISTS idx_tour_manifests_user ON tour_manifests(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_manifests_bus_seat ON tour_manifests(tour_package_id, bus_name, seat_number);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  ip_address TEXT,
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`;
