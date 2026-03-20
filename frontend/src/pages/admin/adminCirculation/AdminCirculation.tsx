import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCirculation } from "./hooks/useCirculation";
import { TRANSACTION_CONFIG } from "./circulation.types";
import TransactionTypePicker from "./components/TransactionTypePicker";
import UserLookup from "./components/UserLookup";
import BookLookup from "./components/BookLookup";
import CirculationLog from "./components/CirculationLog";

const AdminCirculation = () => {
  const {
    type, studentId, isbn, dueDate,
    lookingUp, submitting,
    foundUser, foundBook, activeBorrows, matchedBorrow,
    canSubmit,
    setStudentId, setIsbn, setDueDate,
    handleTypeChange, handleLookupUser, handleLookupBook, handleSubmit,
  } = useCirculation();

  const cfg  = TRANSACTION_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <div className="max-w-2xl">
      <h2 className="font-heading text-lg font-bold text-foreground">Circulation</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Process book borrowing, returning, and renewals.
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <TransactionTypePicker value={type} onChange={handleTypeChange} />

        <UserLookup
          studentId={studentId}
          onStudentIdChange={setStudentId}
          onLookup={handleLookupUser}
          lookingUp={lookingUp}
          foundUser={foundUser}
          activeBorrows={activeBorrows}
          type={type}
        />

        <BookLookup
          isbn={isbn}
          onIsbnChange={setIsbn}
          onLookup={handleLookupBook}
          lookingUp={lookingUp}
          disabled={!foundUser}
          foundBook={foundBook}
          matchedBorrow={matchedBorrow}
          type={type}
        />

        {(type === "borrow" || type === "renew") && (
          <div className="space-y-2">
            <Label>{type === "renew" ? "New Due Date" : "Due Date"}</Label>
            <Input
              type="date"
              value={dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className={`w-full gap-2 ${
            type === "return" ? "bg-success hover:bg-success/90 text-white" :
            type === "renew"  ? "bg-warning hover:bg-warning/90 text-white"  :
            ""
          }`}
        >
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
            : <><Icon className="h-4 w-4" /> Process {cfg.label}</>
          }
        </Button>
      </form>

      {/* ── Circulation log ── */}
      <CirculationLog />
    </div>
  );
};

export default AdminCirculation;