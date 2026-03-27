import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
      <h2 className="font-heading text-lg font-bold text-foreground">Circulation</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Process book borrowing and returns.
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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

        {type === "borrow" && (
          <div className="space-y-2">
            <Label>Loan Duration (days)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={daysAllowed}
              onChange={(e) => setDaysAllowed(Number(e.target.value))}
              className="w-32"
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className={`w-full gap-2 ${
            type === "return" ? "bg-success hover:bg-success/90 text-white" : ""
          }`}
        >
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
            : <><Icon className="h-4 w-4" /> Process {cfg.label}</>
          }
        </Button>
      </form>

      <CirculationLog />
    </div>
  );
};

export default AdminCirculation;