import { SubscriptionCard } from "./SubscriptionCard";
import type { Subscription } from "../types";

interface SubscriptionGridProps {
  subscriptions: Subscription[];
}

export const SubscriptionGrid = ({ subscriptions }: SubscriptionGridProps) => (
  <div className="subscription-list">
    {subscriptions.map((sub, index) => (
      <SubscriptionCard key={sub.id} subscription={sub} index={index} />
    ))}
  </div>
);
