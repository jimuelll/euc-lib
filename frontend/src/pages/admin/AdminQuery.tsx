import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const AdminQuery = () => (
  <AdminPage
    eyebrow="System"
    title="Query Tools"
    description="Use a single search area for ad hoc lookups so staff can quickly search people, books, and transactions without extra noise."
    contentWidth="wide"
  >
    <AdminPanel
      title="Search records"
      description="Search by student ID, book title, ISBN, or transaction reference."
      className="max-w-4xl"
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="query-term">Search Term</Label>
          <Input id="query-term" placeholder="Student ID, book title, or ISBN" />
        </div>

        <div className="flex justify-end border-t border-border/70 pt-4">
          <Button type="submit">Search</Button>
        </div>
      </form>
    </AdminPanel>

    <AdminPanel
      title="Results"
      description="Matching records will appear here after a search is submitted."
      className="max-w-4xl"
    >
      <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">No search results yet.</p>
      </div>
    </AdminPanel>
  </AdminPage>
);

export default AdminQuery;
