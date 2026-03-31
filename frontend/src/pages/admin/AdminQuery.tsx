import { useState, type FormEvent, type ReactNode } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel } from "./components/AdminPage";

interface QueryResults {
  users: Array<{
    id: number;
    student_employee_id: string;
    name: string;
    role: string;
    is_active: number;
  }>;
  books: Array<{
    id: number;
    title: string;
    author: string | null;
    isbn: string | null;
    category: string | null;
    copies: number;
    location: string | null;
  }>;
  borrowings: Array<{
    id: number;
    status: string;
    borrowed_at: string;
    due_date: string;
    returned_at: string | null;
    user_name: string;
    student_employee_id: string;
    book_title: string;
    copy_barcode: string | null;
  }>;
  reservations: Array<{
    id: number;
    status: string;
    reserved_at: string;
    expires_at: string | null;
    user_name: string;
    student_employee_id: string;
    book_title: string;
  }>;
  notifications: Array<{
    id: number;
    type: string;
    title: string;
    created_at: string;
    audience_type: string;
    audience_role: string | null;
  }>;
}

const emptyResults: QueryResults = {
  users: [],
  books: [],
  borrowings: [],
  reservations: [],
  notifications: [],
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const AdminQuery = () => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<QueryResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axiosInstance.get<QueryResults>("/api/admin/query-tools", {
        params: { q: term },
      });
      setResults(res.data);
    } catch (err: any) {
      setResults(emptyResults);
      setError(err.response?.data?.message || err.message || "Failed to search records");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPage
      eyebrow="System"
      title="Query Tools"
      description="Search across the current SQL data for users, books, borrowings, reservations, and notifications from one place."
      contentWidth="wide"
    >
      <AdminPanel
        title="Search records"
        description="Search by student ID, name, book title, ISBN, barcode, transaction ID, or notification title."
        className="max-w-4xl"
      >
        <form className="space-y-4" onSubmit={handleSearch}>
          <div className="space-y-2">
            <Label htmlFor="query-term">Search Term</Label>
            <Input
              id="query-term"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Student ID, book title, ISBN, barcode, or record ID"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </form>
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <ResultPanel title="Users" items={results.users} renderItem={(item) => (
          <>
            <div className="font-medium text-foreground">{item.name}</div>
            <div className="text-sm text-muted-foreground">{item.student_employee_id} • {item.role}</div>
          </>
        )} />

        <ResultPanel title="Books" items={results.books} renderItem={(item) => (
          <>
            <div className="font-medium text-foreground">{item.title}</div>
            <div className="text-sm text-muted-foreground">
              {[item.author, item.isbn, item.location].filter(Boolean).join(" • ") || "No extra details"}
            </div>
          </>
        )} />

        <ResultPanel title="Borrowings" items={results.borrowings} renderItem={(item) => (
          <>
            <div className="font-medium text-foreground">{item.book_title}</div>
            <div className="text-sm text-muted-foreground">
              #{item.id} • {item.user_name} ({item.student_employee_id}) • {item.status}
            </div>
            <div className="text-xs text-muted-foreground">
              Borrowed {formatDateTime(item.borrowed_at)} • Due {formatDateTime(item.due_date)}
            </div>
          </>
        )} />

        <ResultPanel title="Reservations" items={results.reservations} renderItem={(item) => (
          <>
            <div className="font-medium text-foreground">{item.book_title}</div>
            <div className="text-sm text-muted-foreground">
              #{item.id} • {item.user_name} ({item.student_employee_id}) • {item.status}
            </div>
            <div className="text-xs text-muted-foreground">
              Reserved {formatDateTime(item.reserved_at)} • Expires {formatDateTime(item.expires_at)}
            </div>
          </>
        )} />

        <ResultPanel title="Notifications" items={results.notifications} renderItem={(item) => (
          <>
            <div className="font-medium text-foreground">{item.title}</div>
            <div className="text-sm text-muted-foreground">
              #{item.id} • {item.type} • {item.audience_type === "role" ? `Role: ${item.audience_role}` : item.audience_type}
            </div>
            <div className="text-xs text-muted-foreground">
              Created {formatDateTime(item.created_at)}
            </div>
          </>
        )} />
      </div>
    </AdminPage>
  );
};

const ResultPanel = <T,>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) => (
  <AdminPanel title={title} description={`Matching ${title.toLowerCase()} will appear here.`}>
    {items.length ? (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="border border-border/80 bg-background px-4 py-3">
            {renderItem(item)}
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">No matching records in this section yet.</p>
      </div>
    )}
  </AdminPanel>
);

export default AdminQuery;
