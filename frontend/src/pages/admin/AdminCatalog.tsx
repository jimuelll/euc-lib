import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminCatalog = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Catalog Management</h2>
    <p className="mt-1 text-sm text-muted-foreground">Add, edit, or remove books from the catalog.</p>

    <form className="mt-6 space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Book Title</Label>
        <Input placeholder="Introduction to Algorithms" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Author</Label>
          <Input placeholder="Thomas H. Cormen" />
        </div>
        <div className="space-y-2">
          <Label>ISBN</Label>
          <Input placeholder="978-0-262-03384-8" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cs">Computer Science</SelectItem>
              <SelectItem value="eng">Engineering</SelectItem>
              <SelectItem value="math">Mathematics</SelectItem>
              <SelectItem value="sci">Science</SelectItem>
              <SelectItem value="lit">Literature</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Copies</Label>
          <Input type="number" placeholder="5" min={0} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea placeholder="Brief description of the book..." rows={3} />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Add Book</Button>
        <Button type="button" variant="outline">Clear</Button>
      </div>
    </form>
  </div>
);

export default AdminCatalog;
