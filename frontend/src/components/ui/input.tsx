import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, ...props }, ref) => {
    const isDateLike = type === "date" || type === "datetime-local";

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isDateLike && "pr-10 [color-scheme:light] dark:[color-scheme:dark] dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-200 dark:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          className,
        )}
        ref={ref}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || !isDateLike || props.disabled || props.readOnly) return;
          // Browsers that support showPicker() open the native calendar for a
          // click anywhere in the input, not only on its small icon. Browsers
          // without it retain their ordinary focus/native-picker behavior.
          try { event.currentTarget.showPicker?.(); } catch { /* native picker unavailable */ }
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
