import { ExternalLink } from "lucide-react";
import { CardThumbnail } from "./CardThumbnail";
import type { Subscription } from "../types";

interface SubscriptionCardProps {
  subscription: Subscription;
  index: number;
}

export const SubscriptionCard = ({ subscription: sub, index }: SubscriptionCardProps) => (
  <a
    href={sub.url}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative bg-card hover:bg-muted/20 transition-colors flex flex-col overflow-hidden"
  >
    {/* Gold left accent on hover */}
    <div className="absolute left-0 inset-y-0 w-[3px] bg-transparent group-hover:bg-warning transition-colors z-10" />

    <CardThumbnail imageUrl={sub.image_url} title={sub.title} index={index} />

    <div className="flex-1 px-5 pt-4 pb-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h2
            className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors truncate leading-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {sub.title}
          </h2>
          {sub.category && (
            <span
              className="mt-1.5 inline-block border border-border bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {sub.category}
            </span>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors mt-0.5" />
      </div>

      {sub.description && (
        <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-3">
          {sub.description}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-px w-3 bg-warning" />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Visit Platform
        </span>
        <ExternalLink className="h-2.5 w-2.5 text-primary" />
      </div>
    </div>
  </a>
);