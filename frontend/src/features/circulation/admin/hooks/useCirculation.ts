import { useAdminUrlState } from "@/features/admin";
import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { invalidateServerState } from "@/app/server-state";
import { circulationKeys } from "../circulation.keys";
import {
  lookupUser as apiLookupUser,
  lookupCopy as apiLookupCopy,
  lookupReturnPreview as apiLookupReturnPreview,
  processBorrow,
  processReturn,
  undoDeskTransaction,
} from "../circulation.api";
import type { TransactionType, UserInfo, BookInfo, ActiveBorrow, ClearanceStatus, ReturnPreview, ReturnReceipt } from "../circulation.types";

interface ReservationCheckout {
  id: number;
  book_id: number;
  book_title: string;
  student_employee_id: string;
  user_name: string;
  reserved_copy_barcode?: string | null;
}

export const useCirculation = (reservationCheckout: ReservationCheckout | null = null, onTransactionCompleted?: () => void) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const borrowMutation = useMutation({
    mutationFn: ({ studentId, barcode, reservationId }: { studentId: string; barcode: string; reservationId?: number }) => processBorrow(studentId, barcode, reservationId),
    onSuccess: () => invalidateServerState(queryClient, "circulation"),
  });
  const returnMutation = useMutation({ mutationFn: processReturn, onSuccess: () => invalidateServerState(queryClient, "circulation") });
  const [params, patchParams] = useAdminUrlState();
  const type: TransactionType = reservationCheckout ? "borrow" : (params.get("mode") ?? params.get("transaction")) === "return" ? "return" : "borrow";
  const setType = (transaction: TransactionType) => patchParams({ tab: "transaction", mode: transaction, transaction: null });
  const [completed, setCompleted] = useState("");
  const [sessionTransactions, setSessionTransactions] = useState<{ type: TransactionType; title: string; patron: string; occurredAt: string; borrowingId: number; undoToken?: string; undoExpiresAt?: string; undone?: boolean }[]>([]);
  const [submissionError, setSubmissionError] = useState("");
  const [userLookupError, setUserLookupError] = useState("");
  const [copyLookupError, setCopyLookupError] = useState("");
  const submissionLock = useRef(false);
  const userSequence = useRef(0);
  const copySequence = useRef(0);
  const [studentId, setStudentId]         = useState("");
  const [copyBarcode, setCopyBarcode]     = useState("");

  const [lookingUpUser, setLookingUpUser] = useState(false);
  const [lookingUpCopy, setLookingUpCopy] = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  const [foundUser, setFoundUser]         = useState<UserInfo | null>(null);
  const [foundCopy, setFoundCopy]         = useState<BookInfo | null>(null);
  const [activeBorrows, setActiveBorrows] = useState<ActiveBorrow[]>([]);
  const [matchedBorrow, setMatchedBorrow] = useState<ActiveBorrow | null>(null);
  const [clearance, setClearance] = useState<ClearanceStatus | null>(null);
  const [returnPreview, setReturnPreview] = useState<ReturnPreview | null>(null);
  const [returnReceipt, setReturnReceipt] = useState<ReturnReceipt | null>(null);
  const [returnLookupError, setReturnLookupError] = useState("");
  const returnLookupSequence = useRef(0);
  const lastReturnLookup = useRef("");

  // Reset copy state when type changes
  useEffect(() => {
    copySequence.current += 1;
    setSubmissionError("");
    setCopyLookupError("");
    setFoundCopy(null);
    setCompleted("");
    setMatchedBorrow(null);
    setCopyBarcode("");
    setReturnPreview(null);
    setReturnReceipt(null);
    setReturnLookupError("");
    setLookingUpCopy(false);
    returnLookupSequence.current += 1;
    lastReturnLookup.current = "";
  }, [type]);

  // Reset everything below user when student ID is cleared
  useEffect(() => {
    if (!studentId.trim()) {
      setFoundUser(null);
      setActiveBorrows([]);
      setMatchedBorrow(null);
      setClearance(null);
    }
  }, [studentId]);

  const handleLookupUser = async (studentIdOverride?: string) => {
    const lookupId = (studentIdOverride ?? studentId).trim();
    if (!lookupId) return;
    const sequence = ++userSequence.current;
    setUserLookupError("");
    setLookingUpUser(true);
    try {
      const { user, activeBorrows, clearance } = await queryClient.fetchQuery({ queryKey: circulationKeys.user(lookupId), queryFn: ({ signal }) => apiLookupUser(lookupId, signal), staleTime: 0 });
      if (sequence !== userSequence.current) return;
      setStudentId(lookupId);
      setFoundUser(user);
      setActiveBorrows(activeBorrows);
      setClearance(clearance);
      setMatchedBorrow(type === "return" && foundCopy
        ? activeBorrows.find((borrow) => borrow.copy_id === foundCopy.id) ?? null
        : null);
    } catch (err: any) {
      if (sequence !== userSequence.current) return;
      setUserLookupError(err.response?.data?.message ?? "Could not find the patron. Check the ID and retry.");
      toast.error(err.response?.data?.message ?? "User not found");
      setFoundUser(null);
      setActiveBorrows([]);
      setClearance(null);
    } finally {
      if (sequence === userSequence.current) setLookingUpUser(false);
    }
  };

  useEffect(() => {
    const lookupId = reservationCheckout?.student_employee_id;
    if (!reservationCheckout?.id || !lookupId) return;
    setStudentId(lookupId);
    setLookingUpUser(true);
    void queryClient.fetchQuery({ queryKey: circulationKeys.user(lookupId), queryFn: ({ signal }) => apiLookupUser(lookupId, signal), staleTime: 0 })
      .then(({ user, activeBorrows, clearance }) => {
        setFoundUser(user);
        setActiveBorrows(activeBorrows);
        setClearance(clearance);
        setMatchedBorrow(null);
      })
      .catch((err: any) => {
        toast.error(err.response?.data?.message ?? "User not found");
        setFoundUser(null);
        setActiveBorrows([]);
        setClearance(null);
      })
      .finally(() => setLookingUpUser(false));
  }, [reservationCheckout?.id, reservationCheckout?.student_employee_id, queryClient]);

  const handleLookupCopy = async (copyBarcodeOverride?: string) => {
  const lookupBarcode = (copyBarcodeOverride ?? copyBarcode).trim();
  if (!lookupBarcode) return;
  const sequence = ++copySequence.current;
  setCopyLookupError("");
  setLookingUpCopy(true);
  try {
    const copy = await queryClient.fetchQuery({ queryKey: circulationKeys.copy(lookupBarcode), queryFn: ({ signal }) => apiLookupCopy(lookupBarcode, signal), staleTime: 0 });
    if (sequence !== copySequence.current) return;
    setCopyBarcode(lookupBarcode);
    setFoundCopy(copy);

    if (type === "borrow" && copy.is_reserved && !reservationCheckout) {
      toast.info("This copy is prepared for a reservation and cannot be checked out to another patron");
    }

    if (type === "return" && foundUser) {
      const match = activeBorrows.find((b) => b.copy_id === copy.id) ?? null;
      setMatchedBorrow(match);
      if (!match) toast.error("No active borrow found for this copy and user");
    }
  } catch (err: any) {
    if (sequence !== copySequence.current) return;
    setCopyLookupError(err.response?.data?.message ?? "Could not find the copy. Check its identifier and retry.");
    toast.error(err.response?.data?.message ?? "Copy not found");
    setFoundCopy(null);
    setMatchedBorrow(null);
  } finally {
    if (sequence === copySequence.current) setLookingUpCopy(false);
  }
};

  useEffect(() => {
    const barcode = reservationCheckout?.reserved_copy_barcode;
    if (!reservationCheckout?.id || !barcode) return;
    setCopyBarcode(barcode);
    void handleLookupCopy(barcode);
  }, [reservationCheckout?.id, reservationCheckout?.reserved_copy_barcode]);

  const handleReturnIdentifierChange = (value: string) => {
    setSubmissionError("");
    if (lastReturnLookup.current) void queryClient.cancelQueries({ queryKey: circulationKeys.returnPreview(lastReturnLookup.current) });
    returnLookupSequence.current += 1;
    lastReturnLookup.current = "";
    setCopyBarcode(value);
    setReturnPreview(null);
    setReturnReceipt(null);
    setReturnLookupError("");
    setLookingUpCopy(false);
  };

  const handleLookupReturn = useCallback(async (identifier: string, force = false) => {
    const lookupIdentifier = identifier.trim();
    if (!lookupIdentifier || (lastReturnLookup.current === lookupIdentifier && !force)) return;

    const sequence = ++returnLookupSequence.current;
    lastReturnLookup.current = lookupIdentifier;
    setLookingUpCopy(true);
    setReturnLookupError("");
    setReturnPreview(null);
    try {
      const preview = await queryClient.fetchQuery({ queryKey: circulationKeys.returnPreview(lookupIdentifier), queryFn: ({ signal }) => apiLookupReturnPreview(lookupIdentifier, signal), staleTime: 0 });
      if (sequence === returnLookupSequence.current) setReturnPreview(preview);
    } catch (err: any) {
      if (sequence !== returnLookupSequence.current) return;
      setReturnPreview(null);
      setReturnLookupError(err.response?.data?.message ?? "No active loan found for this accession number or copy QR code");
    } finally {
      if (sequence === returnLookupSequence.current) setLookingUpCopy(false);
    }
  }, [queryClient]);

  useEffect(() => {
    const identifier = copyBarcode.trim();
    if (type !== "return" || !identifier) return;
    const timer = window.setTimeout(() => { void handleLookupReturn(identifier); }, 300);
    return () => window.clearTimeout(timer);
  }, [copyBarcode, handleLookupReturn, type]);

  const returnIdentifier = params.get("copy");
  useEffect(() => {
    if (type === "return" && returnIdentifier) {
      handleReturnIdentifierChange(returnIdentifier);
      patchParams({ copy: null }, true);
    }
  }, [returnIdentifier, type, patchParams]);

  const resetForm = () => {
    userSequence.current += 1;
    copySequence.current += 1;
    setClearance(null);
    setUserLookupError("");
    setCopyLookupError("");
    setSubmissionError("");
    setStudentId("");
    setCopyBarcode("");
    setFoundUser(null);
    setFoundCopy(null);
    setActiveBorrows([]);
    setMatchedBorrow(null);
    setReturnPreview(null);
    setReturnReceipt(null);
    setReturnLookupError("");
    returnLookupSequence.current += 1;
    lastReturnLookup.current = "";
  };

  const handleSubmit = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    if (submissionLock.current) return;
    if (lookingUpCopy || lookingUpUser) return;
    setSubmissionError("");
    if (type === "return") {
      if (!returnPreview || !copyBarcode.trim()) {
        toast.error("Look up an active loan before recording the return");
        return;
      }
      setSubmitting(true);
      submissionLock.current = true;
      try {
        const result = await returnMutation.mutateAsync(copyBarcode.trim());
        setReturnReceipt({ ...returnPreview, returned_at: result.returnedAt });
        setReturnPreview(null);
        setCopyBarcode("");
        setReturnLookupError("");
        returnLookupSequence.current += 1;
        lastReturnLookup.current = "";
        toast.success(`"${returnPreview.title}" returned by ${returnPreview.user_name}`);
        setCompleted(`Return completed: ${returnPreview.title} - ${returnPreview.user_name}`);
        setSessionTransactions(previous => [{ type: "return" as const, title: returnPreview.title, patron: returnPreview.user_name, occurredAt: result.returnedAt, borrowingId: result.borrowingId, undoToken: result.undoToken, undoExpiresAt: result.undoExpiresAt }, ...previous]);
        onTransactionCompleted?.();
      } catch (err: any) {
        setSubmissionError(err.response?.data?.message ?? "Could not record the return. Your selection is retained; retry when ready.");
        if (err.response?.status === 404 || err.response?.status === 409) {
          setReturnPreview(null);
          setReturnLookupError(err.response?.data?.message ?? "This loan is no longer active. Look it up again.");
          lastReturnLookup.current = "";
        }
        toast.error(err.response?.data?.message ?? "Transaction failed");
      } finally {
        submissionLock.current = false;
        setSubmitting(false);
      }
      return;
    }
    if (!foundUser || !foundCopy) {
      toast.error("Look up both the user and the copy first");
      return;
    }
    if (clearance?.status !== "eligible" || (foundCopy.is_reserved && !reservationCheckout)) {
      toast.error("Resolve the patron’s clearance or reservation blockers before borrowing");
      return;
    }
    if (type === "borrow" && !foundCopy.accession_number) {
      toast.error("This copy has no accession number and cannot be borrowed. Add its holding first.");
      return;
    }
    if (type === "borrow" && (!foundCopy.is_active || foundCopy.borrow_eligible === false || foundCopy.borrow_eligible === 0)) {
      toast.error("This copy is not eligible for checkout");
      return;
    }
    if (foundCopy.accession_voided || foundCopy.needs_policy || (reservationCheckout && foundCopy.book_id !== reservationCheckout.book_id)) {
      toast.error("Check the copy’s accession, loan policy and reservation before borrowing");
      return;
    }
    if (type === "borrow" && foundCopy.has_active_loan) {
      toast.error("This copy is already borrowed");
      return;
    }
    if (type === "borrow" && foundCopy.condition === "lost") {
      toast.error("Lost copies cannot be borrowed");
      return;
    }
    if (type === "borrow" && foundCopy.condition === "damaged" && !window.confirm("This copy is marked damaged. Confirm that you inspected it and want to continue checkout.")) {
      return;
    }

    setSubmitting(true);
    submissionLock.current = true;
    try {
      if (type === "borrow") {
        // Backend expects a barcode OR student_employee_id as userBarcode
        const result = await borrowMutation.mutateAsync({ studentId: studentId.trim(), barcode: copyBarcode.trim(), reservationId: reservationCheckout?.id });
        toast.success(
          reservationCheckout
            ? `Reservation fulfilled and "${foundCopy.title}" borrowed by ${foundUser.name}`
            : `"${foundCopy.title}" borrowed by ${foundUser.name}`
        );
        setSessionTransactions(previous => [{ type: "borrow" as const, title: foundCopy.title, patron: foundUser.name, occurredAt: new Date().toISOString(), borrowingId: result.borrowingId, undoToken: result.undoToken, undoExpiresAt: result.undoExpiresAt }, ...previous]);
        if (reservationCheckout) {
          navigate("/admin/reservations");
          return;
        }
      }
      setCompleted(`${type === "borrow" ? "Borrow" : "Return"} completed: ${foundCopy.title} - ${foundUser.name}`);
      resetForm();
      onTransactionCompleted?.();
    } catch (err: any) {
      setSubmissionError(err.response?.data?.message ?? "Could not record the loan. Your selection is retained; retry when ready.");
      toast.error(err.response?.data?.message ?? "Transaction failed");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const [undoing, setUndoing] = useState(false);
  const handleUndo = async (borrowingId: number) => {
    const item = sessionTransactions.find(entry => entry.borrowingId === borrowingId);
    if (submissionLock.current || !item?.undoToken || item.undone) return;
    submissionLock.current = true;
    setUndoing(true);
    try {
      await undoDeskTransaction(item.undoToken);
      setSessionTransactions(previous => previous.map(entry => entry.borrowingId === borrowingId ? { ...entry, undone: true } : entry));
      resetForm();
      await invalidateServerState(queryClient, "circulation");
      onTransactionCompleted?.();
      toast.success("Transaction undone");
    } catch (error: any) { toast.error(error.response?.data?.message ?? "Could not undo. The transaction remains recorded."); }
    finally { submissionLock.current = false; setUndoing(false); }
  };
  const canSubmit = type === "return"
    ? !submitting && !!returnPreview && !!copyBarcode.trim()
    : !submitting && !lookingUpUser && !lookingUpCopy && !!foundUser && !!foundCopy && foundCopy.is_active && Boolean(foundCopy.accession_number) && !foundCopy.accession_voided && !foundCopy.needs_policy && foundCopy.borrow_eligible !== false && foundCopy.borrow_eligible !== 0 && foundCopy.condition !== "lost" && !foundCopy.has_active_loan && (!foundCopy.is_reserved || Boolean(reservationCheckout)) && (!reservationCheckout || foundCopy.book_id === reservationCheckout.book_id);
  const clearanceAllowsBorrow = type === "return" || clearance?.status === "eligible";

  return {
    sessionTransactions, handleUndo, undoing, submissionError, userLookupError, copyLookupError,
    type, studentId, copyBarcode,
    completed,
    startNextTransaction: () => { setCompleted(""); resetForm(); },
    lookingUpUser, lookingUpCopy, submitting,
    foundUser, foundCopy, activeBorrows, matchedBorrow, clearance,
    returnPreview, returnReceipt, returnLookupError,
    canSubmit: canSubmit && clearanceAllowsBorrow && !undoing,
    setStudentId: (value: string) => { userSequence.current += 1; setStudentId(value); setFoundUser(null); setClearance(null); setActiveBorrows([]); setLookingUpUser(false); setUserLookupError(""); setSubmissionError(""); },
    setCopyBarcode: (value: string) => { copySequence.current += 1; setCopyBarcode(value); setFoundCopy(null); setLookingUpCopy(false); setCopyLookupError(""); setSubmissionError(""); },
    handleReturnIdentifierChange,
    handleTypeChange: setType,
    handleLookupUser,
    handleLookupCopy,
    handleLookupReturn,
    handleSubmit,
    reservationCheckout,
  };
};
