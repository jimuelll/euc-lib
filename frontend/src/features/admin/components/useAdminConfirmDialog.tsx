import { useCallback, useMemo, useRef, useState } from "react";
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

export interface ConfirmOptions {
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** "dialog" always uses the modal, even while a drawer is open. */
  placement?: "auto" | "dialog";
}

const INITIAL_OPTIONS: Required<ConfirmOptions> = {
  title: "",
  description: "",
  actionLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "default",
  placement: "auto",
};

export type InlineConfirmTarget = (options: Required<ConfirmOptions>, resolve: (value: boolean) => void) => void;
const inlineTargets: InlineConfirmTarget[] = [];

/** An open record drawer registers here so confirmations appear in its footer instead of a dialog on top of it. */
export function registerInlineConfirm(target: InlineConfirmTarget) {
  inlineTargets.push(target);
  return () => {
    const index = inlineTargets.lastIndexOf(target);
    if (index >= 0) inlineTargets.splice(index, 1);
  };
}

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
    const drawer = nextOptions.placement === "dialog" ? undefined : inlineTargets.at(-1);
    if (drawer) return new Promise<boolean>((resolve) => drawer({ ...INITIAL_OPTIONS, ...nextOptions }, resolve));
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
        <AlertDialogContent className="max-w-md rounded-md border-border bg-card p-0 shadow-2xl">
          <div className="px-6 pt-6">
            <AlertDialogHeader className="relative z-10 text-left space-y-3">
              <AlertDialogTitle
                className="text-xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {options.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">
                {options.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div className="px-6 py-5">
            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
              <AlertDialogCancel
                className="mt-0 rounded-md border-border bg-background px-4 py-2 text-xs font-bold  text-muted-foreground hover:bg-muted hover:text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {options.cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => closeWith(true)}
                className={`rounded-md px-4 py-2 text-xs font-bold  ${
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
