import { BookOpen, ExternalLink } from "@/components/ui/library-glyphs";
import { AdminRowMenu } from "@/features/admin";
import type { Subscription } from "../subscriptions.types";

interface SubscriptionRowProps {
  sub: Subscription;
  index: number;
  onToggleActive: (sub: Subscription) => void;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
}

export const SubscriptionRow = ({ sub, onToggleActive, onEdit, onDelete }: SubscriptionRowProps) => (
  <div className="content-subscription-row">
    <div className="content-subscription-thumb">{sub.image_url ? <img src={sub.image_url} alt="" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}</div>
    <div className="content-subscription-copy"><h3>{sub.title}</h3><a href={sub.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span>{sub.url}</span></a></div>
    <span className="content-subscription-category">{sub.category || "Uncategorized"}</span>
    <span className="content-subscription-status" data-active={Boolean(sub.is_active)}>{sub.is_active ? "Active" : "Hidden"}</span>
    <div className="content-subscription-actions"><AdminRowMenu label={`Actions for ${sub.title}`} items={[
      { label: "Edit resource", onSelect: () => onEdit(sub) },
      { label: sub.is_active ? "Hide from website" : "Show on website", onSelect: () => onToggleActive(sub) },
      { label: "Delete resource", onSelect: () => onDelete(sub), destructive: true },
    ]} /></div>
  </div>
);
