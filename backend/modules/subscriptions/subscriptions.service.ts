import repository = require("./subscriptions.repository");
import type { PaginationOptions, SubscriptionPage, SubscriptionRecord } from "./subscriptions.types";

function getActiveSubscriptions(): Promise<SubscriptionRecord[]>;
function getActiveSubscriptions(options: PaginationOptions): Promise<SubscriptionRecord[] | SubscriptionPage>;
function getActiveSubscriptions(options: PaginationOptions = {}): Promise<SubscriptionRecord[] | SubscriptionPage> {
  return repository.getActiveSubscriptions(options);
}

export = { getActiveSubscriptions };
