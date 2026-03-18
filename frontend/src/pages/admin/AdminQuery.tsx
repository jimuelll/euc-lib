import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const AdminQuery = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Query</h2>
    <p className="mt-1 text-sm text-muted-foreground">Search students, books, or transactions.</p>

    <form className="mt-6 space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Search Term</Label>
        <Input placeholder="Student ID, book title, or ISBN…" />
      </div>
      <Button type="submit">Search</Button>
    </form>

    <div className="mt-6 rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground text-center">Results will appear here.</p>
    </div>
  </div>
);

export default AdminQuery;
