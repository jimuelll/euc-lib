import { SubscriptionCard } from "./SubscriptionCard";
import type { Subscription } from "../types";

interface SubscriptionGridProps {
  subscriptions: Subscription[];
}

export const SubscriptionGrid = ({ subscriptions }: SubscriptionGridProps) => (
  <div className="border border-border border-t-0 grid sm:grid-cols-2 divide-y divide-border sm:divide-x sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-border">
    {subscriptions.map((sub, index) => (
      <SubscriptionCard key={sub.id} subscription={sub} index={index} />
    ))}
  </div>
);