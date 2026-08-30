import { AdminPage, AdminPanel } from "../components/AdminPage";
import { useCirculation } from "./hooks/useCirculation";
import { TRANSACTION_CONFIG } from "./circulation.types";
import BookLookup from "./components/BookLookup";
import CirculationLog from "./components/CirculationLog";
import TransactionTypePicker from "./components/TransactionTypePicker";
import UserLookup from "./components/UserLookup";

const AdminCirculation = () => {
  const {
    type,
    studentId,
    copyBarcode,
    daysAllowed,
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
    setDaysAllowed,
    handleTypeChange,
    handleLookupUser,
    handleLookupCopy,
    handleSubmit,
  } = useCirculation();

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
