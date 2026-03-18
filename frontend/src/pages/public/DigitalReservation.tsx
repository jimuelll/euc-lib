import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CalendarDays, BookMarked, Clock, Search, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const reservations = [
  {
    id: 1,
    title: "Data Structures and Algorithms in Java",
    author: "Robert Lafore",
    reservedDate: "Mar 9, 2026",
    expiresAt: "Mar 11, 2026",
    status: "active" as const,
  },
  {
    id: 2,
    title: "Operating System Concepts",
    author: "Abraham Silberschatz",
    reservedDate: "Mar 8, 2026",
    expiresAt: "Mar 10, 2026",
    status: "expired" as const,
  },
  {
    id: 3,
    title: "Computer Networking: A Top-Down Approach",
    author: "James Kurose",
    reservedDate: "Feb 28, 2026",
    expiresAt: "Mar 2, 2026",
    status: "claimed" as const,
    claimedDate: "Mar 1, 2026",
  },
];

const availableBooks = [
  { id: 101, title: "Discrete Mathematics and Its Applications", author: "Kenneth Rosen", copies: 3 },
  { id: 102, title: "Linear Algebra and Its Applications", author: "David C. Lay", copies: 1 },
  { id: 103, title: "Fundamentals of Database Systems", author: "Ramez Elmasri", copies: 2 },
  { id: 104, title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell", copies: 0 },
];

const statusConfig = {
  active: { label: "Active", className: "bg-info/10 text-info border-info/20" },
  expired: { label: "Expired", className: "bg-warning/10 text-warning border-warning/20" },
  claimed: { label: "Claimed", className: "bg-success/10 text-success border-success/20" },
};

const DigitalReservation = () => {
  const [search, setSearch] = useState("");

  const filtered = availableBooks.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Digital Reservation</h1>
              <p className="text-sm text-muted-foreground">Reserve books online before visiting the library</p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-6 rounded-lg border border-info/20 bg-info/5 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">How it works</p>
              <p className="text-muted-foreground mt-1">
                Reserved books are held for <strong className="text-foreground">48 hours</strong>. Pick them up at the front desk with your student ID. Unclaimed reservations expire automatically.
              </p>
            </div>
          </div>

          <Tabs defaultValue="reserve" className="mt-8">
            <TabsList>
              <TabsTrigger value="reserve">Reserve a Book</TabsTrigger>
              <TabsTrigger value="my">My Reservations</TabsTrigger>
            </TabsList>

            {/* Reserve Tab */}
            <TabsContent value="reserve" className="mt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title or author..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                {filtered.map((book) => (
                  <div key={book.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                    <div className="hidden sm:flex h-12 w-9 shrink-0 items-center justify-center rounded bg-muted">
                      <BookMarked className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Copies</p>
                        <p className={`text-sm font-medium ${book.copies > 0 ? "text-success" : "text-destructive"}`}>
                          {book.copies}
                        </p>
                      </div>
                      <Button size="sm" disabled={book.copies === 0} className="shrink-0">
                        {book.copies > 0 ? "Reserve" : "Unavailable"}
                      </Button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No books found matching your search.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* My Reservations Tab */}
            <TabsContent value="my" className="mt-4 space-y-3">
              {reservations.map((res) => (
                <div key={res.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                  <div className="hidden sm:flex h-12 w-9 shrink-0 items-center justify-center rounded bg-muted">
                    <BookMarked className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{res.title}</p>
                    <p className="text-xs text-muted-foreground">{res.author}</p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {res.status === "claimed" ? "Claimed" : "Expires"}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {res.status === "claimed" ? res.claimedDate : res.expiresAt}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusConfig[res.status].className}>
                    {res.status === "active" && <Clock className="mr-1 h-3 w-3" />}
                    {res.status === "claimed" && <Check className="mr-1 h-3 w-3" />}
                    {res.status === "expired" && <X className="mr-1 h-3 w-3" />}
                    {statusConfig[res.status].label}
                  </Badge>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DigitalReservation;
