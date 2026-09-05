import { Skeleton } from "@/components/ui/skeleton";

export function ContentRowsSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return <div className={`space-y-3 ${className}`} aria-label="Loading content" aria-busy="true">{Array.from({ length: rows }, (_, index) => <div className="flex items-center gap-4 border-b border-border/60 pb-3 last:border-b-0" key={index}><Skeleton className="h-9 w-9 shrink-0 rounded-sm" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-4/5" /></div><Skeleton className="hidden h-8 w-16 sm:block" /></div>)}</div>;
}

export function ContentCardsSkeleton({ cards = 3, className = "" }: { cards?: number; className?: string }) {
  return <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${className}`} aria-label="Loading content" aria-busy="true">{Array.from({ length: cards }, (_, index) => <div className="border border-border bg-card p-5" key={index}><Skeleton className="h-4 w-3/5" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /><Skeleton className="mt-6 h-8 w-24" /></div>)}</div>;
}

export function BulletinListSkeleton({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`border-x border-border ${className}`} aria-label="Loading bulletin posts" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => {
        const hasMedia = index % 3 !== 2;

        return (
          <div className="flex min-h-[152px] border-b border-border bg-card" key={index}>
            {hasMedia ? (
              <Skeleton className="h-auto w-36 shrink-0 rounded-none sm:w-48 md:w-56" />
            ) : (
              <div className="w-2 shrink-0 bg-primary/[0.035]" />
            )}
            <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <Skeleton className="h-6 w-6 shrink-0 rounded-none" />
                <div className="min-w-0 space-y-1.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-20" /></div>
              </div>
              <Skeleton className="h-4 w-3/5 max-w-xs" />
              <Skeleton className="mt-3 h-3 w-full max-w-md" />
              <Skeleton className="mt-2 h-3 w-4/5 max-w-sm" />
              <div className="mt-auto flex gap-4 border-t border-border/70 pt-3"><Skeleton className="h-3 w-8" /><Skeleton className="h-3 w-8" /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
