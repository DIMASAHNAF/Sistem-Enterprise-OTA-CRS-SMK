export type UserRole =
  | 'SUPER_ADMIN'
  | 'REVENUE_CONTROLLER'
  | 'TICKETING_OFFICER'
  | 'TOUR_PLANNER'
  | 'BOARDING_OFFICER'
  | 'CUSTOMER';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  identity_number: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export type StationType = 'TRAIN_STATION' | 'BUS_TERMINAL' | 'MEETING_POINT';

export interface Station {
  id: number;
  code: string;
  name: string;
  city: string;
  type: StationType;
  created_at: string;
}

export type FleetType = 'TRAIN' | 'BUS';
export type FleetStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

export interface Fleet {
  id: number;
  code: string;
  name: string;
  type: FleetType;
  status: FleetStatus;
  created_at: string;
}

export type WagonClass = 'EXECUTIVE' | 'BUSINESS' | 'ECONOMY';
export type DirectionIndicator = 'FORWARD' | 'BACKWARD' | 'FACING';

export interface Wagon {
  id: number;
  fleet_id: number;
  wagon_code: string;
  class: WagonClass;
  rows: number;
  cols_layout: string; // e.g. "2-2", "3-2", "2-1"
  direction_indicator: DirectionIndicator;
  created_at: string;
}

export type RouteDirection = 'OUTBOUND' | 'INBOUND';

export interface Route {
  id: number;
  fleet_id: number;
  route_name: string;
  direction: RouteDirection;
  created_at: string;
}

export interface RouteStop {
  id: number;
  route_id: number;
  station_id: number;
  stop_order: number;
  arrival_offset_minutes: number;
  departure_offset_minutes: number;
  created_at: string;
}

export type ScheduleStatus = 'OPEN' | 'CLOSED' | 'DEPARTED' | 'DELAYED';

export interface Schedule {
  id: number;
  route_id: number;
  departure_date: string; // YYYY-MM-DD
  base_departure_time: string; // HH:MM
  status: ScheduleStatus;
  gate_info: string | null;
  created_at: string;
}

export interface ScheduleFare {
  id: number;
  schedule_id: number;
  origin_station_id: number;
  destination_station_id: number;
  wagon_class: WagonClass;
  subclass: string; // e.g. 'A', 'H', 'C', 'P'
  price: number;
  quota: number;
  created_at: string;
}

export type TripType = 'ONE_WAY' | 'ROUND_TRIP';
export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';

export interface Booking {
  id: number;
  invoice_number: string;
  user_id: number;
  trip_type: TripType;
  total_amount: number;
  payment_status: PaymentStatus;
  locked_until: string | null;
  created_at: string;
}

export type SegmentType = 'DEPARTURE' | 'RETURN';

export interface BookingSegment {
  id: number;
  booking_id: number;
  pnr_code: string; // 6-char alphanumeric
  segment_type: SegmentType;
  schedule_id: number;
  origin_station_id: number;
  destination_station_id: number;
  created_at: string;
}

export type PaxType = 'ADULT' | 'INFANT';
export type BoardingStatus = 'BOOKED' | 'CHECKED_IN' | 'BOARDED';

export interface BookingPassenger {
  id: number;
  booking_segment_id: number;
  full_name: string;
  identity_number: string;
  pax_type: PaxType;
  wagon_id: number | null;
  seat_number: string | null;
  boarding_status: BoardingStatus;
  qr_signature: string | null;
  checked_in_at: string | null;
  boarded_at: string | null;
  created_at: string;
}

export type TourStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface TourPackage {
  id: number;
  slug: string;
  title: string;
  destination: string;
  duration_days: number;
  min_pax: number;
  price_per_pax: number;
  costing_json: string;
  status: TourStatus;
  created_at: string;
}

export interface TourItinerary {
  id: number;
  tour_package_id: number;
  day_number: number;
  start_time: string;
  activity_title: string;
  description: string | null;
  location: string | null;
  created_at: string;
}

export interface TourManifest {
  id: number;
  tour_package_id: number;
  bus_name: string;
  seat_number: string;
  room_number: string | null;
  user_id: number;
  checkpoint_1_status: number;
  checkpoint_2_status: number;
  checkpoint_3_status: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  target_id: string | null;
  ip_address: string | null;
  details: string | null;
  created_at: string;
}
