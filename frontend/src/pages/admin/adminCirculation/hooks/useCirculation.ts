import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  lookupUser as apiLookupUser,
  lookupCopy as apiLookupCopy,
  processBorrow,
  processReturn,
} from "../circulation.api";
import { DEFAULT_LOAN_DAYS } from "../circulation.types";
import type { TransactionType, UserInfo, BookInfo, ActiveBorrow, ClearanceStatus } from "../circulation.types";

interface ReservationCheckout {
  id: number;
  book_id: number;
  book_title: string;
  student_employee_id: string;
  user_name: string;
}

export const useCirculation = (reservationCheckout: ReservationCheckout | null = null) => {
  const navigate = useNavigate();
  const [type, setType]                   = useState<TransactionType>("borrow");
  const [studentId, setStudentId]         = useState("");
  const [copyBarcode, setCopyBarcode]     = useState("");
  const [daysAllowed, setDaysAllowed]     = useState(DEFAULT_LOAN_DAYS);

  const [lookingUpUser, setLookingUpUser] = useState(false);
  const [lookingUpCopy, setLookingUpCopy] = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  const [foundUser, setFoundUser]         = useState<UserInfo | null>(null);
  const [foundCopy, setFoundCopy]         = useState<BookInfo | null>(null);
  const [activeBorrows, setActiveBorrows] = useState<ActiveBorrow[]>([]);
  const [matchedBorrow, setMatchedBorrow] = useState<ActiveBorrow | null>(null);
  const [clearance, setClearance] = useState<ClearanceStatus | null>(null);

  // Reset copy state when type changes
  useEffect(() => {
    setFoundCopy(null);
    setMatchedBorrow(null);
    setCopyBarcode("");
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
        ? activeBorrows.find((borrow) => borrow.book_id === foundCopy.book_id) ?? null
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
    if (!reservationCheckout) return;
    setType("borrow");
    setStudentId(reservationCheckout.student_employee_id);
    void handleLookupUser(reservationCheckout.student_employee_id);
  }, [reservationCheckout?.id]);

const handleLookupCopy = async (copyBarcodeOverride?: string) => {
  const lookupBarcode = (copyBarcodeOverride ?? copyBarcode).trim();
  if (!lookupBarcode) return;
  setLookingUpCopy(true);
  try {
    const copy = await apiLookupCopy(lookupBarcode);
    setCopyBarcode(lookupBarcode);
    setFoundCopy(copy);

    if (type === "return" && foundUser) {
      const match = activeBorrows.find((b) => b.book_id === copy.book_id) ?? null;
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

  const resetForm = () => {
    setStudentId("");
    setCopyBarcode("");
    setFoundUser(null);
    setFoundCopy(null);
    setActiveBorrows([]);
    setMatchedBorrow(null);
    setDaysAllowed(DEFAULT_LOAN_DAYS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser || !foundCopy) {
      toast.error("Look up both the user and the copy first");
      return;
    }
    if (type === "return" && !matchedBorrow) {
      toast.error("No matching active borrow found");
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
        await processBorrow(studentId.trim(), copyBarcode.trim(), daysAllowed, reservationCheckout?.id);
        toast.success(
          reservationCheckout
            ? `Reservation fulfilled and "${foundCopy.title}" borrowed by ${foundUser.name}`
            : `"${foundCopy.title}" borrowed by ${foundUser.name}`
        );
        if (reservationCheckout) {
          navigate("/admin/reservations");
          return;
        }
      } else if (type === "return") {
        await processReturn(copyBarcode.trim());
        toast.success(`"${foundCopy.title}" returned by ${foundUser.name}`);
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    !!foundUser &&
    !!foundCopy &&
    foundCopy.is_active &&
    foundCopy.condition !== "lost" &&
    !(type === "return" && !matchedBorrow);
  const clearanceAllowsBorrow = type === "return" || clearance?.status === "eligible";

  return {
    type, studentId, copyBarcode, daysAllowed,
    lookingUpUser, lookingUpCopy, submitting,
    foundUser, foundCopy, activeBorrows, matchedBorrow, clearance,
    canSubmit: canSubmit && clearanceAllowsBorrow,
    setStudentId, setCopyBarcode, setDaysAllowed,
    handleTypeChange: setType,
    handleLookupUser,
    handleLookupCopy,
    handleSubmit,
    reservationCheckout,
  };
};
