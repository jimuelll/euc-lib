import { ExternalLink } from "@/components/ui/library-glyphs";
import { CardThumbnail } from "./CardThumbnail";
import type { Subscription } from "../types";
export const SubscriptionCard = ({ subscription: sub, index }: { subscription: Subscription; index: number }) => (
  <article className="subscription-row">
    <CardThumbnail imageUrl={sub.image_url} alt={sub.image_alt} title={sub.title} index={index} />
    <div className="subscription-copy"><h2>{sub.title}{sub.category && <span className="service-chip">{sub.category}</span>}</h2>{sub.description && <p>{sub.description}</p>}</div>
    <div className="subscription-action"><a className="service-button" href={sub.url} target="_blank" rel="noopener noreferrer">Open {sub.title}<ExternalLink aria-hidden="true" /></a><small>Opens in a new tab</small></div>
  </article>
);
