import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmTone = "default" | "danger";

interface ConfirmOptions {
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

const INITIAL_OPTIONS: Required<ConfirmOptions> = {
  title: "",
  description: "",
  actionLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "default",
};

export const useAdminConfirmDialog = () => {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(INITIAL_OPTIONS);

  const closeWith = useCallback((value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    setOptions({
      ...INITIAL_OPTIONS,
      ...nextOptions,
    });
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const dialog = useMemo(
    () => (
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeWith(false);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-none border-border bg-card p-0 shadow-2xl">
          <div className="bg-primary relative overflow-hidden px-6 py-5">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-warning" />
            <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
              }}
            />
            <AlertDialogHeader className="relative z-10 text-left space-y-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Confirm Action
                </span>
              </div>
              <AlertDialogTitle
                className="text-xl font-bold tracking-tight text-primary-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {options.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-primary-foreground/70">
                {options.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div className="px-6 py-5">
            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
              <AlertDialogCancel
                className="mt-0 rounded-none border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:bg-muted hover:text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {options.cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => closeWith(true)}
                className={`rounded-none px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] ${
                  options.tone === "danger"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {options.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    ),
    [closeWith, open, options]
  );

  return { confirm, confirmDialog: dialog };
};
