import { useEffect, useState, type FormEvent } from "react";
import { Coins, Loader2, ReceiptText, Search, Wallet } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";
import { fetchLibrarySettings, updateLibrarySettings } from "./adminLibrarySettings/api";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

interface PaymentRow {
  id: number;
  user_id: number;
  user_name: string;
  student_employee_id: string;
  book_title: string;
  copy_barcode: string | null;
  due_date: string | null;
  returned_at: string | null;
  status: "borrowed" | "overdue" | "returned";
  fine_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  hours_overdue: number;
}

interface PaymentOverviewResponse {
  rows: PaymentRow[];
  summary: {
    total_records: number;
    affected_users: number;
    total_unsettled_amount: number;
  };
}

interface UserPaymentOverviewResponse extends PaymentOverviewResponse {
  user: {
    id: number;
    name: string;
    role: string;
    student_employee_id: string;
    is_active: number;
  };
}

const emptyOverview: PaymentOverviewResponse = {
  rows: [],
  summary: {
    total_records: 0,
    affected_users: 0,
    total_unsettled_amount: 0,
  },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const statusTone: Record<PaymentRow["status"], string> = {
  borrowed: "border-sky-500/20 bg-sky-500/10 text-sky-700",
  overdue: "border-destructive/20 bg-destructive/10 text-destructive",
  returned: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
};

const AdminPayment = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [hourlyFine, setHourlyFine] = useState("1");
  const [pageLoading, setPageLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [overview, setOverview] = useState<PaymentOverviewResponse>(emptyOverview);
  const [lookupId, setLookupId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [userOverview, setUserOverview] = useState<UserPaymentOverviewResponse | null>(null);

  const loadOverview = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setPageLoading(true);
    if (mode === "refresh") setOverviewRefreshing(true);

    try {
      const [settingsPayload, overviewPayload] = await Promise.all([
        fetchLibrarySettings(),
        axiosInstance.get<PaymentOverviewResponse>("/api/borrowing/admin/payments", {
          params: { limit: 50 },
        }),
      ]);

      setHourlyFine(String(settingsPayload.settings.overdue_fine_per_hour ?? 0));
      setOverview(overviewPayload.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to load payment overview");
    } finally {
      if (mode === "initial") setPageLoading(false);
      if (mode === "refresh") setOverviewRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSettings(true);

    try {
      await updateLibrarySettings(Number(hourlyFine));
      toast.success("Hourly overdue fine updated");
      await loadOverview("refresh");
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to save fine settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLookupUser = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const trimmedId = lookupId.trim();
    if (!trimmedId) {
      toast.error("Enter a student or employee ID");
      return;
    }

    setLookupLoading(true);

    try {
      const res = await axiosInstance.get<UserPaymentOverviewResponse>("/api/borrowing/admin/payments/user", {
        params: { student_employee_id: trimmedId },
      });

      setUserOverview(res.data);
      setSettlementAmount(res.data.summary.total_unsettled_amount ? String(res.data.summary.total_unsettled_amount) : "");

      if (!res.data.rows.length) {
        toast.info("This user has no unsettled payments");
      }
    } catch (error: any) {
      setUserOverview(null);
      toast.error(error.response?.data?.message ?? "Failed to look up user");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSettlePayments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userOverview) {
      toast.error("Look up a user first");
      return;
    }

    const numericAmount = Number(settlementAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setSettling(true);

    try {
      const res = await axiosInstance.post("/api/borrowing/admin/payments/settle", {
        student_employee_id: userOverview.user.student_employee_id,
        amount: numericAmount,
      });

      toast.success(res.data.message ?? "Payment recorded successfully");
      await Promise.all([loadOverview("refresh"), handleLookupUser()]);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to settle payment");
    } finally {
      setSettling(false);
    }
  };

  return (
    <AdminPage
      eyebrow="System"
      title="Payments"
      description="Review live overdue fine exposure, rename the old payment overview into a clearer fine overview, and settle unsettled balances at the desk."
      contentWidth="wide"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto rounded-none border border-border bg-muted/30 p-1">
          <TabsTrigger value="overview" className="rounded-none px-4 py-2 text-xs uppercase tracking-[0.16em]">
            Fine Overview
          </TabsTrigger>
          <TabsTrigger value="settle" className="rounded-none px-4 py-2 text-xs uppercase tracking-[0.16em]">
            Settle Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <AdminStatGrid>
            <AdminStatCard
              label="Hourly overdue rate"
              value={currencyFormatter.format(Number(hourlyFine || 0))}
              icon={<Coins className="h-4 w-4" />}
              helperText="Applied automatically to overdue borrowings every hour."
            />
            <AdminStatCard
              label="Borrowers with unsettled payments"
              value={String(overview.summary.affected_users)}
              icon={<Wallet className="h-4 w-4" />}
              helperText="Unique users who still have an unsettled library balance."
            />
            <AdminStatCard
              label="Total unsettled payments"
              value={currencyFormatter.format(overview.summary.total_unsettled_amount)}
              icon={<ReceiptText className="h-4 w-4" />}
              helperText="Live total across overdue and already-returned but still unsettled borrowings."
            />
          </AdminStatGrid>

          <AdminPanel
            title="Overdue fine configuration"
            description="Update the hourly fine that gets applied automatically once a borrowing passes its due date and time."
            className="max-w-3xl"
          >
            <form className="space-y-4" onSubmit={handleSaveSettings}>
              <div className="space-y-2">
                <Label htmlFor="overdue-fine-hourly">Overdue fine per hour (PHP)</Label>
                <Input
                  id="overdue-fine-hourly"
                  type="number"
                  min={0}
                  step={0.01}
                  value={hourlyFine}
                  onChange={(event) => setHourlyFine(event.target.value)}
                  disabled={pageLoading || savingSettings}
                />
              </div>

              <div className="flex justify-end border-t border-border/70 pt-4">
                <Button type="submit" disabled={pageLoading || savingSettings}>
                  {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save fine settings
                </Button>
              </div>
            </form>
          </AdminPanel>

          <AdminPanel
            title="Current unsettled payments"
            description="This table stays tied to the live borrowing balances, including returned books that still have an unsettled amount."
            actions={
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={() => void loadOverview("refresh")}
                disabled={pageLoading || overviewRefreshing}
              >
                {overviewRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh balances
              </Button>
            }
          >
            {pageLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading payment overview...
              </div>
            ) : overview.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Student", "Book", "Status", "Due at", "Hours overdue", "Settled", "Unsettled"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overview.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.user_name}</div>
                          <div className="text-xs text-muted-foreground">{row.student_employee_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.book_title}</div>
                          <div className="text-xs text-muted-foreground">{row.copy_barcode ?? "-"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone[row.status]}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.returned_at ?? row.due_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.hours_overdue}</td>
                        <td className="px-4 py-3 text-muted-foreground">{currencyFormatter.format(Number(row.settled_amount || 0))}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{currencyFormatter.format(Number(row.unsettled_amount || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No unsettled payments are open right now.
              </div>
            )}
          </AdminPanel>
        </TabsContent>

        <TabsContent value="settle" className="space-y-5">
          <AdminPanel
            title="Find borrower"
            description="Enter the student's or employee's ID to load their unsettled payment records before recording a settlement."
          >
            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleLookupUser}>
              <div className="space-y-2">
                <Label htmlFor="payment-student-id">Student or employee ID</Label>
                <Input
                  id="payment-student-id"
                  value={lookupId}
                  onChange={(event) => setLookupId(event.target.value)}
                  placeholder="Enter student or employee ID"
                  disabled={lookupLoading || settling}
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" disabled={lookupLoading || settling}>
                  {lookupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Look up borrower
                </Button>
              </div>
            </form>
          </AdminPanel>

          {userOverview ? (
            <>
              <AdminStatGrid>
                <AdminStatCard
                  label="Borrower"
                  value={userOverview.user.name}
                  helperText={userOverview.user.student_employee_id}
                />
                <AdminStatCard
                  label="Unsettled records"
                  value={String(userOverview.summary.total_records)}
                  helperText="Borrowings that still have a remaining payment balance."
                />
                <AdminStatCard
                  label="Total unsettled payments"
                  value={currencyFormatter.format(userOverview.summary.total_unsettled_amount)}
                  helperText="Current remaining balance for this borrower."
                />
              </AdminStatGrid>

              <AdminPanel
                title="Settle payment"
                description="Record a payment against the user's unsettled balances. The system applies it from the oldest unsettled borrowing forward and notifies the user right away."
              >
                <form className="grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleSettlePayments}>
                  <div className="space-y-2">
                    <Label htmlFor="settlement-amount">Amount received (PHP)</Label>
                    <Input
                      id="settlement-amount"
                      type="number"
                      min={0.01}
                      max={userOverview.summary.total_unsettled_amount}
                      step={0.01}
                      value={settlementAmount}
                      onChange={(event) => setSettlementAmount(event.target.value)}
                      disabled={settling || lookupLoading || userOverview.summary.total_unsettled_amount <= 0}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={settling || lookupLoading || userOverview.summary.total_unsettled_amount <= 0}
                    >
                      {settling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Record payment
                    </Button>
                  </div>
                </form>
              </AdminPanel>

              <AdminPanel
                title="Borrower unsettled records"
                description="These are the rows that will receive the payment allocation."
              >
                {userOverview.rows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          {["Book", "Status", "Due at", "Hours overdue", "Settled", "Unsettled"].map((heading) => (
                            <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {userOverview.rows.map((row) => (
                          <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{row.book_title}</div>
                              <div className="text-xs text-muted-foreground">{row.copy_barcode ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone[row.status]}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.returned_at ?? row.due_date)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.hours_overdue}</td>
                            <td className="px-4 py-3 text-muted-foreground">{currencyFormatter.format(Number(row.settled_amount || 0))}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{currencyFormatter.format(Number(row.unsettled_amount || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    This borrower has no unsettled payment rows.
                  </div>
                )}
              </AdminPanel>
            </>
          ) : (
            <AdminPanel
              title="Settle payments"
              description="Look up a borrower to review their balance and record a payment."
            >
              <div className="py-8 text-center text-sm text-muted-foreground">
                Enter a student or employee ID above to begin settling payments.
              </div>
            </AdminPanel>
          )}
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default AdminPayment;
