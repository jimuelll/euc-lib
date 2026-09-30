import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  Clock3,
} from "lucide-react";
import { Surface, EmptyPanel, PanelList } from "./MyLibraryPrimitives";
import {
  deadlineLabel,
  dueLabel,
  formatCurrency,
  formatDate,
  isDueSoon,
  sortBorrows,
  sortReservations,
} from "./MyLibrary.formatters";
import type { MyLibraryDashboard } from "../types";
import MyLibraryCover from "./MyLibraryCover";

export default function MyLibraryCurrentPanel({
  data,
}: {
  data: MyLibraryDashboard;
}) {
  const borrows = sortBorrows(data.active_borrows);
  const reservations = sortReservations(data.active_reservations);
  const attention = [
    {
      count: borrows.filter((book) => book.status === "overdue").length,
      label: "overdue",
      href: "#borrowed-books",
      Icon: AlertCircle,
      color: "text-destructive",
    },
    {
      count: reservations.filter((item) => item.status === "ready").length,
      label: "ready for pickup",
      href: "#reservations",
      Icon: CheckCircle2,
      color: "text-success",
    },
    {
      count: borrows.filter((book) => isDueSoon(book)).length,
      label: "due soon",
      href: "#borrowed-books",
      Icon: Clock3,
      color: "text-warning",
    },
  ].filter((item) => item.count > 0);
  return (
    <div className="min-w-0 space-y-6">
      {attention.length > 0 && (
        <section
          aria-label="Needs attention"
          className="rounded-xl border border-border bg-card px-5 py-4 sm:px-6"
        >
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {attention.map(({ count, label, href, Icon, color }) => (
              <a
                key={label}
                href={href}
                className={`inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline ${color}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {count} {label}
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      )}
      <Surface
        id="borrowed-books"
        title="Borrowed books"
        count={borrows.length}
      >
        {borrows.length ? (
          <PanelList>
            {borrows.map((book) => (
              <article key={book.id} className="min-w-0 px-5 py-5 sm:px-6">
                <div className="flex items-start gap-4">
                  <MyLibraryCover {...book} />
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <h3 className="break-words text-base font-semibold leading-6">
                        {book.title}
                      </h3>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {book.author || "Unknown author"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${book.status === "overdue" ? "bg-destructive/10 text-destructive" : isDueSoon(book) ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}
                    >
                      {book.status === "overdue"
                        ? "Overdue"
                        : isDueSoon(book)
                          ? "Due soon"
                          : "Borrowed"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {deadlineLabel(
                        book.due_date,
                        "Due",
                        "Due date unavailable",
                      )}
                    </p>
                    <p
                      className={`mt-1 ${book.status === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {dueLabel(book.due_date)}
                    </p>
                  </div>
                  {book.status === "overdue" && (
                    <p className="font-medium tabular-nums text-destructive">
                      Fine {formatCurrency(book.fine_amount)}
                    </p>
                  )}
                </div>
                <details className="group mt-3 text-sm">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-action underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                    Loan details
                  </summary>
                  <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Borrowed</dt>
                      <dd className="mt-1">
                        {formatDate(book.borrowed_at, "MMM d, yyyy · h:mm a")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Location</dt>
                      <dd className="mt-1 break-words">
                        {book.location || "Library circulation desk"}
                      </dd>
                    </div>
                    {book.copy_barcode && (
                      <div>
                        <dt className="text-muted-foreground">Copy barcode</dt>
                        <dd className="mt-1 break-all">{book.copy_barcode}</dd>
                      </div>
                    )}
                    {book.notes && (
                      <div>
                        <dt className="text-muted-foreground">Notes</dt>
                        <dd className="mt-1 break-words">{book.notes}</dd>
                      </div>
                    )}
                  </dl>
                </details>
              </article>
            ))}
          </PanelList>
        ) : (
          <EmptyPanel
            message="Books you borrow will appear here with their return deadlines. Find your next book in the catalogue."
            to="/catalogue"
            action="Browse catalogue"
          />
        )}
      </Surface>
      <Surface
        id="reservations"
        title="Reservations"
        count={reservations.length}
      >
        {reservations.length ? (
          <PanelList>
            {reservations.map((item) => (
              <article key={item.id} className="min-w-0 px-5 py-5 sm:px-6">
                <div className="flex items-start gap-4">
                  <MyLibraryCover {...item} />
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <h3 className="break-words text-base font-semibold leading-6">
                        {item.title}
                      </h3>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {item.author || "Unknown author"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${item.status === "ready" ? "bg-success/10 text-success" : "bg-info/10 text-info"}`}
                    >
                      {item.status === "ready" ? "Ready for pickup" : "Pending"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  {item.status === "ready" && (
                    <p className="font-medium">
                      {deadlineLabel(
                        item.expires_at,
                        "Pick up by",
                        "Pickup deadline unavailable",
                      )}
                    </p>
                  )}
                  <p className="break-words text-muted-foreground">
                    {item.status === "ready" ? "Pickup: " : "Location: "}
                    {item.location || "Main circulation desk"}
                  </p>
                  <p className="text-muted-foreground">
                    Reserved {formatDate(item.reserved_at)}
                  </p>
                  {item.notes && (
                    <p className="break-words text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </PanelList>
        ) : (
          <EmptyPanel
            message="Your pending and ready reservations will appear here. Visit borrowing services to explore reservation options."
            to="/services/borrowing"
            action="Explore reservations"
          />
        )}
      </Surface>
    </div>
  );
}
