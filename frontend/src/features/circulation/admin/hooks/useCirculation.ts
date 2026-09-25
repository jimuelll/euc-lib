import { useAdminUrlState } from "@/features/admin";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  lookupUser as apiLookupUser,
  lookupCopy as apiLookupCopy,
  lookupReturnPreview as apiLookupReturnPreview,
  processBorrow,
  processReturn,
} from "../circulation.api";
import type { TransactionType, UserInfo, BookInfo, ActiveBorrow, ClearanceStatus, ReturnPreview, ReturnReceipt } from "../circulation.types";

interface ReservationCheckout {
  id: number;
  book_id: number;
  book_title: string;
  student_employee_id: string;
  user_name: string;
}

export const useCirculation = (reservationCheckout: ReservationCheckout | null = null, onTransactionCompleted?: () => void) => {
  const navigate = useNavigate();
  const [params, patchParams] = useAdminUrlState();
  const type: TransactionType = reservationCheckout ? "borrow" : params.get("transaction") === "return" ? "return" : "borrow";
  const setType = (transaction: TransactionType) => patchParams({ transaction });
  const [completed, setCompleted] = useState("");
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
    setLookingUpUser(true);
    try {
      const { user, activeBorrows, clearance } = await apiLookupUser(lookupId);
      setStudentId(lookupId);
      setFoundUser(user);
      setActiveBorrows(activeBorrows);
      setClearance(clearance);
      setMatchedBorrow(type === "return" && foundCopy
        ? activeBorrows.find((borrow) => borrow.copy_id === foundCopy.id) ?? null
        : null);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "User not found");
      setFoundUser(null);
      setActiveBorrows([]);
      setClearance(null);
    } finally {
      setLookingUpUser(false);
    }
  };

  useEffect(() => {
    const lookupId = reservationCheckout?.student_employee_id;
    if (!reservationCheckout?.id || !lookupId) return;
    setStudentId(lookupId);
    setLookingUpUser(true);
    void apiLookupUser(lookupId)
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
  }, [reservationCheckout?.id, reservationCheckout?.student_employee_id]);

  const handleLookupCopy = async (copyBarcodeOverride?: string) => {
  const lookupBarcode = (copyBarcodeOverride ?? copyBarcode).trim();
  if (!lookupBarcode) return;
  setLookingUpCopy(true);
  try {
    const copy = await apiLookupCopy(lookupBarcode);
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
    toast.error(err.response?.data?.message ?? "Copy not found");
    setFoundCopy(null);
    setMatchedBorrow(null);
    setClearance(null);
  } finally {
    setLookingUpCopy(false);
  }
};

  const handleReturnIdentifierChange = (value: string) => {
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
      const preview = await apiLookupReturnPreview(lookupIdentifier);
      if (sequence === returnLookupSequence.current) setReturnPreview(preview);
    } catch (err: any) {
      if (sequence !== returnLookupSequence.current) return;
      setReturnPreview(null);
      setReturnLookupError(err.response?.data?.message ?? "No active loan found for this accession number or copy QR code");
    } finally {
      if (sequence === returnLookupSequence.current) setLookingUpCopy(false);
    }
  }, []);

  useEffect(() => {
    const identifier = copyBarcode.trim();
    if (type !== "return" || !identifier) return;
    const timer = window.setTimeout(() => { void handleLookupReturn(identifier); }, 300);
    return () => window.clearTimeout(timer);
  }, [copyBarcode, handleLookupReturn, type]);

  const resetForm = () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "return") {
      if (!returnPreview || !copyBarcode.trim()) {
        toast.error("Look up an active loan before recording the return");
        return;
      }
      setSubmitting(true);
      try {
        const result = await processReturn(copyBarcode.trim());
        setReturnReceipt({ ...returnPreview, returned_at: result.returnedAt });
        setReturnPreview(null);
        setCopyBarcode("");
        setReturnLookupError("");
        returnLookupSequence.current += 1;
        lastReturnLookup.current = "";
        toast.success(`"${returnPreview.title}" returned by ${returnPreview.user_name}`);
        setCompleted(`Return completed: ${returnPreview.title} - ${returnPreview.user_name}`);
        onTransactionCompleted?.();
      } catch (err: any) {
        if (err.response?.status === 404 || err.response?.status === 409) {
          setReturnPreview(null);
          setReturnLookupError(err.response?.data?.message ?? "This loan is no longer active. Look it up again.");
          lastReturnLookup.current = "";
        }
        toast.error(err.response?.data?.message ?? "Transaction failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!foundUser || !foundCopy) {
      toast.error("Look up both the user and the copy first");
      return;
    }
    if (type === "return" && !matchedBorrow) {
      toast.error("No matching active borrow found");
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
    try {
      if (type === "borrow") {
        // Backend expects a barcode OR student_employee_id as userBarcode
        await processBorrow(studentId.trim(), copyBarcode.trim(), reservationCheckout?.id);
        toast.success(
          reservationCheckout
            ? `Reservation fulfilled and "${foundCopy.title}" borrowed by ${foundUser.name}`
            : `"${foundCopy.title}" borrowed by ${foundUser.name}`
        );
        if (reservationCheckout) {
          navigate("/admin/reservations");
          return;
        }
      }
      setCompleted(`${type === "borrow" ? "Borrow" : "Return"} completed: ${foundCopy.title} - ${foundUser.name}`);
      resetForm();
      onTransactionCompleted?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = type === "return"
    ? !submitting && !!returnPreview && !!copyBarcode.trim()
    : !submitting && !!foundUser && !!foundCopy && foundCopy.is_active && Boolean(foundCopy.accession_number) && foundCopy.borrow_eligible !== false && foundCopy.borrow_eligible !== 0 && foundCopy.condition !== "lost" && !foundCopy.has_active_loan && (!foundCopy.is_reserved || Boolean(reservationCheckout));
  const clearanceAllowsBorrow = type === "return" || clearance?.status === "eligible";

  return {
    type, studentId, copyBarcode,
    completed,
    startNextTransaction: () => { setCompleted(""); resetForm(); },
    lookingUpUser, lookingUpCopy, submitting,
    foundUser, foundCopy, activeBorrows, matchedBorrow, clearance,
    returnPreview, returnReceipt, returnLookupError,
    canSubmit: canSubmit && clearanceAllowsBorrow,
    setStudentId, setCopyBarcode,
    handleReturnIdentifierChange,
    handleTypeChange: setType,
    handleLookupUser,
    handleLookupCopy,
    handleLookupReturn,
    handleSubmit,
    reservationCheckout,
  };
};
