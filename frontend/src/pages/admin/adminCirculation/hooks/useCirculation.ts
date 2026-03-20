import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import {
  lookupUser as apiLookupUser,
  lookupBook as apiLookupBook,
  processBorrow,
  processReturn,
  processRenew,
} from "../circulation.api";
import { DEFAULT_LOAN_DAYS } from "../circulation.types";
import type { TransactionType, UserInfo, BookInfo, ActiveBorrow } from "../circulation.types";

const defaultDueDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_LOAN_DAYS);
  return d.toISOString().slice(0, 10);
};

export const useCirculation = () => {
  const [type, setType]                   = useState<TransactionType>("borrow");
  const [studentId, setStudentId]         = useState("");
  const [isbn, setIsbn]                   = useState("");
  const [dueDate, setDueDate]             = useState(defaultDueDate);
  const [lookingUp, setLookingUp]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [foundUser, setFoundUser]         = useState<UserInfo | null>(null);
  const [foundBook, setFoundBook]         = useState<BookInfo | null>(null);
  const [activeBorrows, setActiveBorrows] = useState<ActiveBorrow[]>([]);
  const [matchedBorrow, setMatchedBorrow] = useState<ActiveBorrow | null>(null);

  // Reset book state when transaction type changes
  useEffect(() => {
    setFoundBook(null);
    setMatchedBorrow(null);
    setIsbn("");
  }, [type]);

  // Reset user state when student ID is cleared
  useEffect(() => {
    if (!studentId.trim()) {
      setFoundUser(null);
      setActiveBorrows([]);
      setMatchedBorrow(null);
    }
  }, [studentId]);

  const handleTypeChange = (t: TransactionType) => {
    setType(t);
  };

  const handleLookupUser = async () => {
    if (!studentId.trim()) return;
    setLookingUp(true);
    try {
      const { user, activeBorrows } = await apiLookupUser(studentId.trim());
      setFoundUser(user);
      setActiveBorrows(activeBorrows);
      setMatchedBorrow(null);
      setFoundBook(null);
      setIsbn("");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "User not found");
      setFoundUser(null);
      setActiveBorrows([]);
    } finally {
      setLookingUp(false);
    }
  };

  const handleLookupBook = async () => {
    if (!isbn.trim() || !foundUser) return;
    setLookingUp(true);
    try {
      const book = await apiLookupBook(isbn.trim());
      setFoundBook(book);

      if (type === "return" || type === "renew") {
        const match = activeBorrows.find((b) => b.title === book.title) ?? null;
        setMatchedBorrow(match);
        if (!match) toast.error("No active borrow found for this book and user");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Book not found");
      setFoundBook(null);
      setMatchedBorrow(null);
    } finally {
      setLookingUp(false);
    }
  };

  const resetForm = () => {
    setStudentId("");
    setIsbn("");
    setFoundUser(null);
    setFoundBook(null);
    setActiveBorrows([]);
    setMatchedBorrow(null);
    setDueDate(defaultDueDate());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser || !foundBook) {
      toast.error("Look up both the user and book first");
      return;
    }
    if ((type === "return" || type === "renew") && !matchedBorrow) {
      toast.error("No matching active borrow found");
      return;
    }

    setSubmitting(true);
    try {
      if (type === "borrow") {
        if (!dueDate) { toast.error("Due date is required"); return; }
        await processBorrow(foundUser.id, foundBook.id, dueDate);
        toast.success(`"${foundBook.title}" borrowed by ${foundUser.name}`);

      } else if (type === "return") {
        await processReturn(matchedBorrow!.id);
        toast.success(`"${foundBook.title}" returned by ${foundUser.name}`);

      } else if (type === "renew") {
        if (!dueDate) { toast.error("New due date is required"); return; }
        await processRenew(matchedBorrow!.id, dueDate);
        toast.success(`"${foundBook.title}" renewed — new due date: ${dueDate}`);
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
    !!foundBook &&
    !((type === "return" || type === "renew") && !matchedBorrow) &&
    !(type === "borrow" && foundBook?.available === 0);

  return {
    // state
    type, studentId, isbn, dueDate,
    lookingUp, submitting,
    foundUser, foundBook, activeBorrows, matchedBorrow,
    canSubmit,
    // setters
    setStudentId, setIsbn, setDueDate,
    // handlers
    handleTypeChange,
    handleLookupUser,
    handleLookupBook,
    handleSubmit,
  };
};