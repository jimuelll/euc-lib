import { AdminPage, AdminPanel } from "../components/AdminPage";
import { useLocation } from "react-router-dom";
import { useCirculation } from "./hooks/useCirculation";
import { TRANSACTION_CONFIG } from "./circulation.types";
import BookLookup from "./components/BookLookup";
import CirculationLog from "./components/CirculationLog";
import TransactionTypePicker from "./components/TransactionTypePicker";
import UserLookup from "./components/UserLookup";

const AdminCirculation = () => {
  const location = useLocation();
  const checkoutReservation = (location.state as { checkoutReservation?: Parameters<typeof useCirculation>[0] } | null)?.checkoutReservation ?? null;
  const {
    type,
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
  } = useCirculation(checkoutReservation);

  const cfg = TRANSACTION_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <AdminPage
      eyebrow="Service Desk"
      title="Circulation"
      contentWidth="wide"
    >
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

      <CirculationLog />
    </AdminPage>
  );
};

export default AdminCirculation;
