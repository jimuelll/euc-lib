import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const AdminInternet = () => (
  <AdminPage
    eyebrow="System"
    title="Internet Access"
    description="Start and monitor internet usage sessions with a straightforward form that keeps the task focused and easy to validate."
    contentWidth="wide"
  >
    <AdminPanel
      title="Start session"
      description="Assign a student to a workstation and define the permitted session length."
      className="max-w-3xl"
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="internet-student-id">Student ID</Label>
          <Input id="internet-student-id" placeholder="2024-00001" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="internet-pc-number">PC Number</Label>
            <Input id="internet-pc-number" placeholder="PC-01" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internet-duration">Duration</Label>
            <Select>
              <SelectTrigger id="internet-duration">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end border-t border-border/70 pt-4">
          <Button type="submit">Start Session</Button>
        </div>
      </form>
    </AdminPanel>
  </AdminPage>
);

export default AdminInternet;
