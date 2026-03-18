import { useState } from "react";
import { Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const sampleBooks = [
  { id: 1, title: "Introduction to Algorithms", author: "Thomas H. Cormen", subject: "Computer Science", available: true },
  { id: 2, title: "Calculus: Early Transcendentals", author: "James Stewart", subject: "Mathematics", available: true },
  { id: 3, title: "Principles of Economics", author: "N. Gregory Mankiw", subject: "Economics", available: false },
  { id: 4, title: "Organic Chemistry", author: "Paula Yurkanis Bruice", subject: "Chemistry", available: true },
  { id: 5, title: "Physics for Scientists and Engineers", author: "Raymond A. Serway", subject: "Physics", available: false },
  { id: 6, title: "Database System Concepts", author: "Abraham Silberschatz", subject: "Computer Science", available: true },
];

const Catalogue = () => {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });

  const filtered = sampleBooks.filter(
    (b) =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.author.toLowerCase().includes(query.toLowerCase()) ||
      b.subject.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-24">
        <div className="container">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Book Catalogue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search and browse the library's collection.
          </p>

          <div className="mt-8 flex justify-center">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, author, or subject..."
                className="h-11 w-full rounded-md border bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No books found matching your search.</p>
            )}
            {filtered.map((book) => (
              <div key={book.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                <div>
                  <h3 className="font-heading text-sm font-medium text-foreground">{book.title}</h3>
                  <p className="text-xs text-muted-foreground">{book.author} · {book.subject}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${book.available ? "text-success" : "text-destructive"}`}>
                    {book.available ? "Available" : "Checked Out"}
                  </span>
                  <Button size="sm" variant="outline" disabled={!book.available}>
                    Reserve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Catalogue;
