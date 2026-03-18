import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminCirculation = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Circulation</h2>
    <p className="mt-1 text-sm text-muted-foreground">Process book borrowing and returning.</p>

    <form className="mt-6 space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label>Transaction Type</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="borrow">Borrow</SelectItem>
            <SelectItem value="return">Return</SelectItem>
            <SelectItem value="renew">Renew</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Student ID</Label>
        <Input placeholder="2024-00001" />
      </div>
      <div className="space-y-2">
        <Label>Book ISBN / Barcode</Label>
        <Input placeholder="Scan or enter ISBN" />
      </div>
      <div className="space-y-2">
        <Label>Due Date</Label>
        <Input type="date" />
      </div>
      <Button type="submit">Process Transaction</Button>
    </form>
  </div>
);

export default AdminCirculation;
