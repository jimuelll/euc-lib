export interface DashboardProfile {
  id: number;
  name: string;
  role: string;
  student_employee_id: string;
  email: string | null;
  profile_picture: string | null;
  address: string;
  contact: string;
}

export interface DashboardSummary {
  active_borrows: number;
  overdue_borrows: number;
  due_soon_borrows: number;
  total_fines_due: number;
  active_reservations: number;
  ready_reservations: number;
  attendance_logs: number;
}

export interface ActiveBorrow {
  id: number;
  title: string;
  author: string | null;
  category: string | null;
  location: string | null;
  borrowed_at: string;
  due_date: string;
  status: "borrowed" | "overdue";
  notes: string | null;
  copy_barcode: string | null;
  fine_amount: number;
  fine_per_hour: number;
  hours_overdue: number;
}

export interface BorrowHistoryItem {
  id: number;
  title: string;
  author: string | null;
  borrowed_at: string;
  returned_at: string | null;
  due_date: string;
  status: "returned";
  copy_barcode: string | null;
}

export interface ActiveReservation {
  id: number;
  title: string;
  author: string | null;
  location: string | null;
  status: "pending" | "ready";
  reserved_at: string;
  expires_at: string | null;
  notes: string | null;
}

export interface ReservationHistoryItem {
  id: number;
  title: string;
  author: string | null;
  status: "cancelled" | "expired" | "fulfilled";
  reserved_at: string;
  expires_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
}

export interface AttendanceSession {
  date: string | null;
  time_in: string | null;
  time_out: string | null;
}

export interface DashboardSubscription {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface DashboardNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
  is_read: boolean;
}

export interface MyLibraryDashboard {
  profile: DashboardProfile | null;
  summary: DashboardSummary;
  active_borrows: ActiveBorrow[];
  borrow_history: BorrowHistoryItem[];
  active_reservations: ActiveReservation[];
  reservation_history: ReservationHistoryItem[];
  attendance_sessions: AttendanceSession[];
  subscriptions: DashboardSubscription[];
  notifications: DashboardNotification[];
}
