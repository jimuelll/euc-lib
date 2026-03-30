import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const AdminPayment = () => (
  <AdminPage
    eyebrow="System"
    title="Payment"
    description="Record fines and fee payments in a layout that keeps the most important fields easy to scan."
    contentWidth="wide"
  >
    <AdminPanel
      title="Record payment"
      description="Capture the student ID, payment type, amount, and transaction date before saving."
      className="max-w-3xl"
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="payment-student-id">Student ID</Label>
          <Input id="payment-student-id" placeholder="2024-00001" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-type">Payment Type</Label>
          <Select>
            <SelectTrigger id="payment-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overdue">Overdue Fine</SelectItem>
              <SelectItem value="lost">Lost Book</SelectItem>
              <SelectItem value="damage">Damage Fee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (PHP)</Label>
            <Input id="payment-amount" type="number" placeholder="50.00" min={0} step={0.01} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">Date</Label>
            <Input id="payment-date" type="date" />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/70 pt-4">
          <Button type="submit">Record Payment</Button>
        </div>
      </form>
    </AdminPanel>
  </AdminPage>
);

export default AdminPayment;
