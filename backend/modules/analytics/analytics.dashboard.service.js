const repository = require("./analytics.repository");
const { syncOverdueBorrowings, listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const { buildDateLabels, buildMonthLabels, normalizeSeries, resolveDashboardRange } = require("./analytics.helpers");

async function getDashboardOverview({ range } = {}) {
  await syncOverdueBorrowings();
  const rangeDays = resolveDashboardRange(range);
  const daysAgo = rangeDays - 1;
  const dayLabels = buildDateLabels(rangeDays);
  const monthLabels = buildMonthLabels(6);
  const [data, unsettledOverview] = await Promise.all([
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

  return {
    stats: {
      total_books: Number(stats.total_books || 0),
      total_book_copies: Number(stats.total_book_copies || 0),
      available_book_copies: Number(stats.available_book_copies || 0),
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
      borrowingStatus: borrowingStatus.map((row) => ({ name: row.name, value: Number(row.value || 0) })),
      reservationStatus: reservationStatus.map((row) => ({ name: row.name, value: Number(row.value || 0) })),
      userRoles: userRoles.map((row) => ({ name: row.name, value: Number(row.value || 0) })),
      popularBooks: popularBooks.map((row) => ({ name: row.name, total: Number(row.total || 0) })),
      catalogByCategory: catalogByCategory.map((row) => ({ name: row.name, titles: Number(row.titles || 0), copies: Number(row.copies || 0) })),
      copyCondition: copyCondition.map((row) => ({ name: row.name, value: Number(row.value || 0) })),
      borrowingByRole: borrowingByRole.map((row) => ({ name: row.name, value: Number(row.value || 0) })),
      fineCollectionTrend: normalizeSeries(fineCollectionTrend, monthLabels, ["settled_amount"]),
    },
    recentActivity: recentActivity.map((row) => ({ occurred_at: row.occurred_at, activity_type: row.activity_type, description: row.description })),
  };
}

module.exports = { getDashboardOverview };
