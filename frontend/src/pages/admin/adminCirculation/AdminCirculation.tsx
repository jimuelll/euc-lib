import { Loader2 } from "lucide-react";
import { useCirculation } from "./hooks/useCirculation";
import { TRANSACTION_CONFIG } from "./circulation.types";
import TransactionTypePicker from "./components/TransactionTypePicker";
import UserLookup from "./components/UserLookup";
import BookLookup from "./components/BookLookup";
import CirculationLog from "./components/CirculationLog";

const AdminCirculation = () => {
  const {
    type, studentId, copyBarcode, daysAllowed,
    lookingUpUser, lookingUpCopy, submitting,
    foundUser, foundCopy, activeBorrows, matchedBorrow,
    canSubmit,
    setStudentId, setCopyBarcode, setDaysAllowed,
    handleTypeChange, handleLookupUser, handleLookupCopy, handleSubmit,
  } = useCirculation();

  const cfg  = TRANSACTION_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <div className="max-w-2xl">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-4 bg-warning shrink-0" />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Library Management
          </span>
        </div>
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
        >
          Circulation
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Process book borrowing and returns.
        </p>
      </div>

      {/* ── Transaction form ─────────────────────────────────────────── */}
      <div className="border border-border bg-card">

        {/* Form header band */}
        <div className="bg-primary relative overflow-hidden">
          <div className="h-[3px] w-full bg-warning" />
          <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-px bg-black/20" />
          <div className="relative z-10 px-6 py-4">
            <p
              className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary-foreground/45 mb-0.5"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              New Transaction
            </p>
            <p
              className="text-sm font-bold text-primary-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {cfg.label} — {foundUser ? foundUser.name : "No user selected"}
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="p-6 space-y-5 divide-y divide-border">

          <div className="space-y-5 pb-5">
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
          </div>

          {/* Loan duration — borrow only */}
          {type === "borrow" && (
            <div className="pt-5 space-y-2">
              <label
                className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Loan Duration (days)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={daysAllowed}
                  onChange={(e) => setDaysAllowed(Number(e.target.value))}
                  className="w-24 h-9 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary transition-colors text-center font-mono"
                />
                <span className="text-[11px] text-muted-foreground/60">
                  Due {new Date(Date.now() + daysAllowed * 86400000).toLocaleDateString([], {
                    weekday: "short", month: "short", day: "numeric",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full h-11 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                type === "return"
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {submitting ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 border-2 border-current/30 border-t-current animate-spin" />
                  Processing…
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
      </div>

      {/* ── Log ─────────────────────────────────────────────────────── */}
      <CirculationLog />
    </div>
  );
};

export default AdminCirculation;