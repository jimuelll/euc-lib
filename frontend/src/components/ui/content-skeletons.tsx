import { Skeleton } from "@/components/ui/skeleton";

export function ContentRowsSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return <div className={`space-y-3 ${className}`} aria-label="Loading content" aria-busy="true">{Array.from({ length: rows }, (_, index) => <div className="flex items-center gap-4 border-b border-border/60 pb-3 last:border-b-0" key={index}><Skeleton className="h-9 w-9 shrink-0 rounded-sm" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-4/5" /></div><Skeleton className="hidden h-8 w-16 sm:block" /></div>)}</div>;
}

export function ContentCardsSkeleton({ cards = 3, className = "" }: { cards?: number; className?: string }) {
  return <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${className}`} aria-label="Loading content" aria-busy="true">{Array.from({ length: cards }, (_, index) => <div className="border border-border bg-card p-5" key={index}><Skeleton className="h-4 w-3/5" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /><Skeleton className="mt-6 h-8 w-24" /></div>)}</div>;
}
