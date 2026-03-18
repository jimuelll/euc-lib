import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminReport = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Reports</h2>
    <p className="mt-1 text-sm text-muted-foreground">Generate library reports.</p>

    <form className="mt-6 space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Report Type</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="Select report" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="circulation">Circulation Summary</SelectItem>
            <SelectItem value="overdue">Overdue Books</SelectItem>
            <SelectItem value="inventory">Inventory Report</SelectItem>
            <SelectItem value="attendance">Attendance Log</SelectItem>
            <SelectItem value="popular">Most Borrowed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>From</Label>
          <Input type="date" />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="date" />
        </div>
      </div>
      <Button type="submit">Generate Report</Button>
    </form>
  </div>
);

export default AdminReport;
