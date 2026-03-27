import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import {
  lookupUser as apiLookupUser,
  lookupCopy as apiLookupCopy,
  processBorrow,
  processReturn,
} from "../circulation.api";
import { DEFAULT_LOAN_DAYS } from "../circulation.types";
import type { TransactionType, UserInfo, BookInfo, ActiveBorrow } from "../circulation.types";

export const useCirculation = () => {
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
      setFoundCopy(null);
      setCopyBarcode("");
    }
  }, [studentId]);

  const handleLookupUser = async () => {
    if (!studentId.trim()) return;
    setLookingUpUser(true);
    try {
      const { user, activeBorrows } = await apiLookupUser(studentId.trim());
      setFoundUser(user);
      setActiveBorrows(activeBorrows);
      setMatchedBorrow(null);
      setFoundCopy(null);
      setCopyBarcode("");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "User not found");
      setFoundUser(null);
      setActiveBorrows([]);
    } finally {
      setLookingUpUser(false);
    }
  };

  const handleLookupCopy = async () => {
    if (!copyBarcode.trim() || !foundUser) return;
    setLookingUpCopy(true);
    try {
      const copy = await apiLookupCopy(copyBarcode.trim());
      setFoundCopy(copy);

      if (type === "return") {
        const match = activeBorrows.find((b) => b.book_id === copy.book_id) ?? null;
        setMatchedBorrow(match);
        if (!match) toast.error("No active borrow found for this copy and user");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Copy not found");
      setFoundCopy(null);
      setMatchedBorrow(null);
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

    setSubmitting(true);
    try {
      if (type === "borrow") {
        // Backend expects a barcode OR student_employee_id as userBarcode
        await processBorrow(studentId.trim(), copyBarcode.trim(), daysAllowed);
        toast.success(`"${foundCopy.title}" borrowed by ${foundUser.name}`);
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
    !(type === "return" && !matchedBorrow);

  return {
    type, studentId, copyBarcode, daysAllowed,
    lookingUpUser, lookingUpCopy, submitting,
    foundUser, foundCopy, activeBorrows, matchedBorrow,
    canSubmit,
    setStudentId, setCopyBarcode, setDaysAllowed,
    handleTypeChange: setType,
    handleLookupUser,
    handleLookupCopy,
    handleSubmit,
  };
};