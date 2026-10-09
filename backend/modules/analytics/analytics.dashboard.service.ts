import { calendarDate } from './analytics.calendar';
import { reportMetadata } from './analytics.report-metadata.repository';
const repository = require("./analytics.repository");
const { syncOverdueBorrowings, listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const { buildDateLabels, buildMonthLabels, normalizeSeries, resolveDashboardRange } = require("./analytics.helpers");

async function getDashboardOverview({ range,dateFrom,dateTo,allTime,actorId }: { range?: string;dateFrom?:string;dateTo?:string;allTime?:boolean;actorId?:number } = {}): Promise<Record<string, any>> {
  await syncOverdueBorrowings();
  const rangeDays = resolveDashboardRange(range);
  const daysAgo = rangeDays - 1;
  const dayLabels = buildDateLabels(rangeDays);
  const monthLabels = buildMonthLabels(6);
  const [data, unsettledOverview]: [any, any] = await Promise.all([
    repository.getDashboardOverviewData(daysAgo),
    listUnsettledBorrowings({ limit: null }),
  ]);
  const {
    stats,
    visitTrend,
    circulationTrend,
    attendanceTrend,
    reservationTrend,
    borrowingStatus,
    reservationStatus,
    userRoles,
    popularBooks,
    catalogByCategory,
    copyCondition,
    borrowingByRole,
    fineCollectionTrend,
    recentActivity,
  } = data;
  const overdueFinePerHour = Number(stats.overdue_fine_per_hour || 0);
  const outstandingFines = Number(unsettledOverview.summary.total_unsettled_amount || 0);

  const result:Record<string,any> = {
    ...await reportMetadata(actorId),
    stats: {
      total_books: Number(stats.total_books || 0),
      total_book_copies: Number(stats.total_book_copies || 0),
      available_book_copies: Number(stats.available_book_copies || 0),
      active_accessioned_copies: Number(stats.active_accessioned_copies || 0),
      needs_accession_copies: Number(stats.needs_accession_copies || 0),
      borrowed_book_copies: Number(stats.borrowed_book_copies || 0),
      damaged_book_copies: Number(stats.damaged_book_copies || 0),
      lost_book_copies: Number(stats.lost_book_copies || 0),
      active_users: Number(stats.active_users || 0),
      total_users: Number(stats.total_users || 0),
      active_borrowings: Number(stats.active_borrowings || 0),
      overdue_borrowings: Number(stats.overdue_borrowings || 0),
      borrowings_today: Number(stats.borrowings_today || 0),
      returns_today: Number(stats.returns_today || 0),
      active_reservations: Number(stats.active_reservations || 0),
      ready_reservations: Number(stats.ready_reservations || 0),
      reservations_today: Number(stats.reservations_today || 0),
      fulfilled_reservations_today: Number(stats.fulfilled_reservations_today || 0),
      attendance_today: Number(stats.attendance_today || 0),
      borrowing_attendance_today: Number(stats.borrowing_attendance_today || 0),
      entry_exit_attendance_today: Number(stats.entry_exit_attendance_today || 0),
      unique_visitors_today: Number(stats.unique_visitors_today || 0),
      visit_hits_today: Number(stats.visit_hits_today || 0),
      total_unique_visitors: Number(stats.total_unique_visitors || 0),
      total_visit_hits: Number(stats.total_visit_hits || 0),
      active_notifications: Number(stats.active_notifications || 0),
      active_subscriptions: Number(stats.active_subscriptions || 0),
      upcoming_holidays: Number(stats.upcoming_holidays || 0),
      settled_fines_total: Number(stats.settled_fines_total || 0),
      overdue_fine_per_hour: overdueFinePerHour,
      outstanding_fines: outstandingFines,
    },
    charts: {
      visitTrend: normalizeSeries(visitTrend, dayLabels, ["unique_visitors", "visit_hits"]),
      circulationTrend: normalizeSeries(circulationTrend, dayLabels, ["borrowed_count", "returned_count"]),
      attendanceTrend: normalizeSeries(attendanceTrend, dayLabels, ["entry_exit_count", "borrowing_count"]),
      reservationTrend: normalizeSeries(reservationTrend, dayLabels, ["created_count", "fulfilled_count", "cancelled_count"]),
      borrowingStatus: borrowingStatus.map((row: Record<string, any>) => ({ name: row.name, value: Number(row.value || 0) })),
      reservationStatus: reservationStatus.map((row: Record<string, any>) => ({ name: row.name, value: Number(row.value || 0) })),
      userRoles: userRoles.map((row: Record<string, any>) => ({ name: row.name, value: Number(row.value || 0) })),
      popularBooks: popularBooks.map((row: Record<string, any>) => ({ name: row.name, total: Number(row.total || 0) })),
      catalogByCategory: catalogByCategory.map((row: Record<string, any>) => ({ name: row.name, titles: Number(row.titles || 0), copies: Number(row.copies || 0) })),
      copyCondition: copyCondition.map((row: Record<string, any>) => ({ name: row.name, value: Number(row.value || 0) })),
      borrowingByRole: borrowingByRole.map((row: Record<string, any>) => ({ name: row.name, value: Number(row.value || 0) })),
      fineCollectionTrend: normalizeSeries(fineCollectionTrend, monthLabels, ["settled_amount"]),
    },
    needsAttention: (unsettledOverview.rows||[]).filter((row:any)=>row.status==='overdue').sort((a:any,b:any)=>new Date(a.due_date).getTime()-new Date(b.due_date).getTime()).slice(0,5).map((row:any)=>({borrowingId:row.id,title:row.book_title,dueDate:calendarDate(row.due_date),outstanding:Number(row.unsettled_amount||0)})),
    recentActivity: recentActivity.map((row: Record<string, any>) => ({ occurred_at: row.occurred_at, activity_type: row.activity_type, description: row.description })),
  };
  {
    const {buildAiReportEvidence}=require('./aiReport.evidence.service');
    const {periodCharts}=require('./analytics.period.repository');
    const evidence=await buildAiReportEvidence(allTime?{allTime:true}:{dateFrom:dateFrom||dayLabels[0],dateTo:dateTo||dayLabels[dayLabels.length-1]});
    const extra=await periodCharts(evidence.range.dateFrom,evidence.range.dateTo);
    const daily=evidence.activity.daily_activity,labels=daily.map((row:any)=>row.date);
    result.period=evidence.range;result.comparison=evidence.comparison;result.previousActivity=evidence.previous_activity;result.activity=evidence.activity;
    result.charts.circulationTrend=daily.map((row:any)=>({label:row.date,borrowed_count:row.borrowed,returned_count:row.returned}));
    result.charts.attendanceTrend=daily.map((row:any)=>({label:row.date,entry_exit_count:row.entry_exit_scans,borrowing_count:row.borrowing_scans,library_entries:row.library_entries,unique_library_visitors:row.unique_library_visitors}));
    result.charts.visitTrend=daily.map((row:any)=>({label:row.date,unique_visitors:row.unique_visitors,visit_hits:row.page_hits}));
    result.charts.reservationTrend=normalizeSeries(extra.reservations,labels,['created_count','fulfilled_count','cancelled_count']);
    result.charts.fineCollectionTrend=normalizeSeries(extra.fines,labels,['settled_amount']);
    result.charts.borrowingByRole=extra.roles.map((row:any)=>({name:row.name,value:Number(row.value)}));result.charts.popularBooks=extra.books.map((row:any)=>({name:row.name,total:Number(row.total)}));
  }
  return result;
}

export = { getDashboardOverview };
