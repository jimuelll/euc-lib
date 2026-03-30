import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const AdminReport = () => (
  <AdminPage
    eyebrow="Reports"
    title="Circulation Reports"
    description="Generate operational reports from a compact form that keeps the date range and report type easy to review before submission."
    contentWidth="wide"
  >
    <AdminPanel
      title="Generate report"
      description="Select the report type and reporting window, then run the export."
      className="max-w-3xl"
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="report-type">Report Type</Label>
          <Select>
            <SelectTrigger id="report-type">
              <SelectValue placeholder="Select report" />
            </SelectTrigger>
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
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/70 pt-4">
          <Button type="submit">Generate Report</Button>
        </div>
      </form>
    </AdminPanel>
  </AdminPage>
);

export default AdminReport;
