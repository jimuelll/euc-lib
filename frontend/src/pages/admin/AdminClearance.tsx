import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const students = [
  { id: "2024-00012", name: "Maria Santos", status: "cleared" },
  { id: "2024-00034", name: "Juan Reyes", status: "pending" },
  { id: "2024-00056", name: "Ana Garcia", status: "pending" },
];

const AdminClearance = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Clearance</h2>
    <p className="mt-1 text-sm text-muted-foreground">Process student library clearance.</p>

    <div className="mt-6 flex gap-2">
      <Input placeholder="Search student ID or name…" className="max-w-xs" />
      <Button variant="outline">Search</Button>
    </div>

    <div className="mt-6 space-y-3">
      {students.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                s.status === "cleared"
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-warning/10 text-warning border-warning/20"
              }
            >
              {s.status === "cleared" ? "Cleared" : "Pending"}
            </Badge>
            {s.status === "pending" && <Button size="sm">Clear</Button>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default AdminClearance;
