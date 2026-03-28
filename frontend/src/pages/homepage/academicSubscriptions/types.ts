export interface Subscription {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  sort_order: number;
}

export type FetchStatus = "idle" | "loading" | "success" | "error";

export interface SubscriptionsState {
  data: Subscription[];
  status: FetchStatus;
  error: string | null;
}