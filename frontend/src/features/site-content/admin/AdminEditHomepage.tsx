import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const AdminEditHomepage = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Edit Homepage Info</h2>
    <p className="mt-1 text-sm text-muted-foreground">Update the public-facing homepage content.</p>

    <form className="mt-6 space-y-5 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Library Name</Label>
        <Input placeholder="College Library" />
      </div>
      <div className="space-y-2">
        <Label>Tagline</Label>
        <Input placeholder="Your Gateway to Knowledge" />
      </div>
      <div className="space-y-2">
        <Label>Hero Description</Label>
        <Textarea placeholder="Brief 1-2 sentence description shown on the homepage hero…" rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Hero Banner Image URL</Label>
        <Input placeholder="https://example.com/banner.jpg" />
      </div>

      <hr className="border-border" />

      <div className="space-y-2">
        <Label>Operating Hours</Label>
        <Input placeholder="Mon–Fri: 7:00 AM – 7:00 PM" />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input placeholder="123 Campus Drive, College Town" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Contact Email</Label>
          <Input type="email" placeholder="library@college.edu" />
        </div>
        <div className="space-y-2">
          <Label>Phone Number</Label>
          <Input placeholder="(02) 1234-5678" />
        </div>
      </div>
      <Button type="submit">Save Changes</Button>
    </form>
  </div>
);

export default AdminEditHomepage;
