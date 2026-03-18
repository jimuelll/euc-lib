import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookOpen, RotateCcw, Clock, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const borrowedBooks = [
  {
    id: 1,
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen",
    borrowDate: "Feb 25, 2026",
    dueDate: "Mar 11, 2026",
    status: "active" as const,
  },
  {
    id: 2,
    title: "Database System Concepts",
    author: "Abraham Silberschatz",
    borrowDate: "Feb 20, 2026",
    dueDate: "Mar 6, 2026",
    status: "overdue" as const,
  },
  {
    id: 3,
    title: "Clean Code",
    author: "Robert C. Martin",
    borrowDate: "Jan 15, 2026",
    dueDate: "Jan 29, 2026",
    status: "returned" as const,
    returnDate: "Jan 28, 2026",
  },
  {
    id: 4,
    title: "Design Patterns",
    author: "Gang of Four",
    borrowDate: "Jan 5, 2026",
    dueDate: "Jan 19, 2026",
    status: "returned" as const,
    returnDate: "Jan 18, 2026",
  },
];

const statusConfig = {
  active: { label: "Active", className: "bg-info/10 text-info border-info/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  returned: { label: "Returned", className: "bg-success/10 text-success border-success/20" },
};

const BorrowingReturning = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Borrowing & Returning</h1>
              <p className="text-sm text-muted-foreground">Manage your borrowed books and view history</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Currently Borrowed</span>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-heading text-2xl font-bold text-foreground">2</p>
              <p className="text-xs text-muted-foreground">of 5 max allowed</p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <p className="mt-2 font-heading text-2xl font-bold text-destructive">1</p>
              <p className="text-xs text-muted-foreground">Return ASAP to avoid penalties</p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Borrowed</span>
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-heading text-2xl font-bold text-foreground">4</p>
              <p className="text-xs text-muted-foreground">This semester</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="active" className="mt-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="active">Active Borrows</TabsTrigger>
                <TabsTrigger value="history">Return History</TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search books..." className="pl-9 h-9" />
              </div>
            </div>

            <TabsContent value="active" className="mt-4 space-y-3">
              {borrowedBooks
                .filter((b) => b.status !== "returned")
                .map((book) => (
                  <div key={book.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                    <div className="hidden sm:flex h-12 w-9 shrink-0 items-center justify-center rounded bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Due</p>
                      <p className="text-sm font-medium text-foreground">{book.dueDate}</p>
                    </div>
                    <Badge variant="outline" className={statusConfig[book.status].className}>
                      {statusConfig[book.status].label}
                    </Badge>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              {borrowedBooks
                .filter((b) => b.status === "returned")
                .map((book) => (
                  <div key={book.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                    <div className="hidden sm:flex h-12 w-9 shrink-0 items-center justify-center rounded bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Returned</p>
                      <p className="text-sm font-medium text-foreground">{book.returnDate}</p>
                    </div>
                    <Badge variant="outline" className={statusConfig.returned.className}>
                      Returned
                    </Badge>
                  </div>
                ))}
            </TabsContent>
          </Tabs>

          {/* Policies */}
          <div className="mt-10 rounded-lg border bg-card p-6">
            <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Borrowing Policies
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Maximum of <strong className="text-foreground">5 books</strong> at a time
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Lending period: <strong className="text-foreground">14 days</strong> for students
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Returns accepted at the front desk or the <strong className="text-foreground">24-hour drop-off box</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Overdue penalties may apply. Check with the librarian for details.
              </li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BorrowingReturning;
