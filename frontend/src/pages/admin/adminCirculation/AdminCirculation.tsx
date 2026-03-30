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
      eyebrow="Library Management"
      title="Circulation"
      description="Process borrowing and return transactions with a simpler layout that keeps the active task, user, and copy details in view."
      contentWidth="wide"
    >
      <AdminPanel
        title={cfg.label}
        description={foundUser ? `Current user: ${foundUser.name}` : "Select a transaction type, then look up the user and book copy before submitting."}
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
            type={type}
          />

          <BookLookup
            copyBarcode={copyBarcode}
            onCopyBarcodeChange={setCopyBarcode}
            onLookup={handleLookupCopy}
            lookingUp={lookingUpCopy}
            disabled={!foundUser}
            foundCopy={foundCopy}
            matchedBorrow={matchedBorrow}
            type={type}
          />

          {type === "borrow" ? (
            <div className="space-y-2 border-t border-border/70 pt-5">
              <label
                className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Loan Duration (days)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={daysAllowed}
                  onChange={(e) => setDaysAllowed(Number(e.target.value))}
                  className="h-10 w-24 rounded-md border border-border bg-background px-3 text-center text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Due{" "}
                  {new Date(Date.now() + daysAllowed * 86400000).toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border/70 pt-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-md text-[11px] font-bold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
                  <Icon className="h-3.5 w-3.5" />
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
