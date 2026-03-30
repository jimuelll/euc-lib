import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const students = [
  { id: "2024-00012", name: "Maria Santos", status: "cleared" },
  { id: "2024-00034", name: "Juan Reyes", status: "pending" },
  { id: "2024-00056", name: "Ana Garcia", status: "pending" },
];

const AdminClearance = () => (
  <AdminPage
    eyebrow="Administration"
    title="Clearance"
    description="Review student clearance status in a simple list with clear labels and direct actions."
    contentWidth="wide"
  >
    <AdminPanel
      title="Search students"
      description="Look up a student by ID or name before processing a clearance request."
      className="max-w-4xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Search student ID or name" className="sm:max-w-sm" />
        <Button variant="outline" className="sm:w-auto">
          Search
        </Button>
      </div>
    </AdminPanel>

    <AdminPanel
      title="Student statuses"
      description="Pending records stay visible so staff can resolve them without leaving the page."
      className="max-w-4xl"
    >
      <div className="space-y-3">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex flex-col gap-3 rounded-md border border-border/70 bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{student.name}</p>
              <p className="text-xs leading-5 text-muted-foreground">{student.id}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  student.status === "cleared"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                }
              >
                {student.status === "cleared" ? "Cleared" : "Pending"}
              </Badge>
              {student.status === "pending" ? <Button size="sm">Clear</Button> : null}
            </div>
          </div>
        ))}
      </div>
    </AdminPanel>
  </AdminPage>
);

export default AdminClearance;
