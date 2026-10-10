export interface DashboardStats {
  total_books: number; total_book_copies: number; active_accessioned_copies: number; needs_accession_copies: number; available_book_copies: number; borrowed_book_copies: number;
  damaged_book_copies: number; lost_book_copies: number; active_users: number; total_users: number;
  active_borrowings: number; overdue_borrowings: number; borrowings_today: number; returns_today: number;
  active_reservations: number; ready_reservations: number; reservations_today: number; fulfilled_reservations_today: number;
  attendance_today: number; borrowing_attendance_today: number; entry_exit_attendance_today: number;
  unique_visitors_today: number; visit_hits_today: number; total_unique_visitors: number; total_visit_hits: number;
  active_notifications: number; active_subscriptions: number; upcoming_holidays: number; settled_fines_total: number;
  overdue_fine_per_hour: number; outstanding_fines: number;
}
export interface NamedValue { name: string; value: number }
export interface TrendPoint {
  library_entries?:number;unique_library_visitors?:number;
  label: string; unique_visitors?: number; visit_hits?: number; borrowed_count?: number; returned_count?: number;
  entry_exit_count?: number; borrowing_count?: number; created_count?: number; fulfilled_count?: number;
  cancelled_count?: number; settled_amount?: number;
}
export interface PopularBookPoint { name: string; total: number }
export interface CategoryPoint { name: string; titles: number; copies: number }
export interface DashboardResponse {
  libraryName?:string;generatedBy?:string|null;
  needsAttention?:{borrowingId:number;title:string;dueDate:string;outstanding:number}[];
  period?:{dateFrom:string;dateTo:string;days:number};comparison?:{available:boolean;recordedFrom:string};previousActivity?:{circulation:{borrowed:number;returned:number};attendance:{entry_exit_scans:number;borrowing_scans:number};site_activity:{unique_visitors:number}};
  stats: DashboardStats;
  charts: {
    visitTrend: TrendPoint[]; circulationTrend: TrendPoint[]; attendanceTrend: TrendPoint[]; reservationTrend: TrendPoint[];
    borrowingStatus: NamedValue[]; reservationStatus: NamedValue[]; userRoles: NamedValue[]; popularBooks: PopularBookPoint[];
    catalogByCategory: CategoryPoint[]; copyCondition: NamedValue[]; borrowingByRole: NamedValue[]; fineCollectionTrend: TrendPoint[];
  };
}


export type AnalyticsRange = '7d'|'30d'|'month'|'year';
