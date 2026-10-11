import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, onFocus, ...props }, ref) => {
  const list = React.useRef<HTMLDivElement | null>(null);
  const reveal = React.useCallback((target?: HTMLElement) => {
    const row = list.current;
    if (!row?.closest("[data-library-design]")) return;
    const selected = target || row.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!selected) return;
    const bounds = row.getBoundingClientRect(), item = selected.getBoundingClientRect();
    if (item.left < bounds.left) row.scrollLeft -= bounds.left - item.left + 16;
    else if (item.right > bounds.right) row.scrollLeft += item.right - bounds.right + 16;
  }, []);
  React.useEffect(() => {
    const row = list.current;
    if (!row) return;
    reveal();
    const mutation = new MutationObserver(() => reveal());
    mutation.observe(row, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => reveal());
    resize?.observe(row);
    return () => { mutation.disconnect(); resize?.disconnect(); };
  }, [reveal]);
  return (
  <TabsPrimitive.List
    ref={(node) => {
      list.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }}
    onFocus={(event) => {
      onFocus?.(event);
      if (event.target instanceof HTMLElement) reveal(event.target);
    }}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
