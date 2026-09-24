import { useAdminUrlState } from "@/features/admin";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, AdminPanel } from "@/features/admin";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { useCirculation } from "./hooks/useCirculation";
import { TRANSACTION_CONFIG } from "./circulation.types";
import BookLookup from "./components/BookLookup";
import CirculationLog from "./components/CirculationLog";
import TransactionTypePicker from "./components/TransactionTypePicker";
import UserLookup from "./components/UserLookup";

const AdminCirculation = () => {
  const location = useLocation();
  const [params, patchParams] = useAdminUrlState();
  const history = params.get("tab") === "history";
  const [logRevision, setLogRevision] = useState(0);
  const checkoutReservation = (location.state as { checkoutReservation?: Parameters<typeof useCirculation>[0] } | null)?.checkoutReservation ?? null;
  const {
    type,
    completed,
    startNextTransaction,
    studentId,
    copyBarcode,
    lookingUpUser,
    lookingUpCopy,
    submitting,
    foundUser,
    foundCopy,
    activeBorrows,
    clearance,
    matchedBorrow,
    canSubmit,
    setStudentId,
    setCopyBarcode,
    handleTypeChange,
    handleLookupUser,
    handleLookupCopy,
    handleSubmit,
    reservationCheckout,
  } = useCirculation(checkoutReservation, () => setLogRevision((revision) => revision + 1));

  const cfg = TRANSACTION_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <AdminPage
      eyebrow="Service Desk"
      title="Borrow & Return"
      description="Find a patron, scan a copy, and review the transaction before recording it."
      contentWidth="wide"
    >
      <Tabs value={history ? "history" : "transaction"} onValueChange={tab => patchParams({ tab })}><TabsList><TabsTrigger value="transaction">Desk transaction</TabsTrigger><TabsTrigger value="history">Transaction history</TabsTrigger></TabsList></Tabs>
      {history ? <CirculationLog refreshKey={logRevision} /> : <>
      {completed && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/5 p-4"><span className="text-sm font-medium">{completed}</span><Button onClick={() => { startNextTransaction(); document.getElementById("circulation-patron")?.focus(); }}>Next transaction</Button></div>}
      <AdminPanel
        title={type === "borrow" ? "Borrow a library copy" : "Return a library copy"}
      >
        <div className="space-y-5">
          {reservationCheckout ? (
            <div className="border border-info/30 bg-info/5 px-4 py-3 text-sm text-foreground">
              Complete checkout for <strong>{reservationCheckout.user_name}</strong> by scanning an available copy of <strong>{reservationCheckout.book_title}</strong>. The reservation will be fulfilled only after the borrow succeeds.
            </div>
          ) : null}
          <TransactionTypePicker value={type} onChange={handleTypeChange} />

          <section aria-labelledby="patron-step"><h2 id="patron-step" className="mb-3 text-base font-semibold">1. Find the patron</h2>
          <UserLookup
            studentId={studentId}
            onStudentIdChange={setStudentId}
            onLookup={handleLookupUser}
            lookingUp={lookingUpUser}
            foundUser={foundUser}
            activeBorrows={activeBorrows}
            clearance={clearance}
            type={type}
          />

          </section>
          <section aria-labelledby="copy-step"><h2 id="copy-step" className="mb-3 text-base font-semibold">2. Scan or find the copy</h2>
          <BookLookup
            copyBarcode={copyBarcode}
            onCopyBarcodeChange={setCopyBarcode}
            onLookup={handleLookupCopy}
            onSelectCopy={(barcode) => { setCopyBarcode(barcode); void handleLookupCopy(barcode); }}
            lookingUp={lookingUpCopy}
            disabled={false}
            foundCopy={foundCopy}
            matchedBorrow={matchedBorrow}
            type={type}
          />

          </section>
          <h2 className="text-base font-semibold">3. Review and confirm</h2>
          {foundUser && foundCopy && <p className="rounded-md bg-muted p-3 text-sm"><strong>{foundUser.name}</strong> · {foundCopy.title} · {foundCopy.accession_number ? `Acc. ${foundCopy.accession_number}` : "No accession"} · QR ${foundCopy.barcode}{matchedBorrow ? ` · Due ${new Date(matchedBorrow.due_date).toLocaleString()}` : ""}</p>}
          {!canSubmit && <p className="text-sm text-muted-foreground">{!foundUser ? "Find a patron to continue." : !foundCopy ? "Scan or select a copy to continue." : clearance?.status === "blocked" && type === "borrow" ? "Resolve the patron’s clearance issues before borrowing." : "Review the copy and patron details above before continuing."}</p>}
          {type === "borrow" ? <p className="border-t border-border/70 pt-5 text-sm text-muted-foreground">The due date and hourly fine are applied automatically from this book’s configured type.</p> : null}

          <div className="border-t border-border/70 pt-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                type === "return"
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {submitting ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  Processing...
                </>
              ) : (
                <>
                  <Icon className="h-4 w-4" />
                  Process {cfg.label}
                </>
              )}
            </button>
          </div>
        </div>
      </AdminPanel>

      </>}
    </AdminPage>
  );
};

export default AdminCirculation;
