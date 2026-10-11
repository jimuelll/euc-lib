export default function ReservationPagination({ pagination, onPageChange }: { pagination: { page: number; totalPages: number }; onPageChange: (page: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  return <nav className="reservation-pagination" aria-label="Reservation pages"><button className="service-link" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="service-link" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Next</button></nav>;
}
