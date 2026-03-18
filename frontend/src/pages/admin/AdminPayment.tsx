import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminPayment = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Payment</h2>
    <p className="mt-1 text-sm text-muted-foreground">Record fines and payments.</p>

    <form className="mt-6 space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Student ID</Label>
        <Input placeholder="2024-00001" />
      </div>
      <div className="space-y-2">
        <Label>Payment Type</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="overdue">Overdue Fine</SelectItem>
            <SelectItem value="lost">Lost Book</SelectItem>
            <SelectItem value="damage">Damage Fee</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Amount (₱)</Label>
          <Input type="number" placeholder="50.00" min={0} step={0.01} />
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" />
        </div>
      </div>
      <Button type="submit">Record Payment</Button>
    </form>
  </div>
);

export default AdminPayment;
