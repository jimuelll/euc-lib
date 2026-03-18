import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminInternet = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Internet Access</h2>
    <p className="mt-1 text-sm text-muted-foreground">Manage student internet usage sessions.</p>

    <form className="mt-6 space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Student ID</Label>
        <Input placeholder="2024-00001" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>PC Number</Label>
          <Input placeholder="PC-01" />
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit">Start Session</Button>
    </form>
  </div>
);

export default AdminInternet;
