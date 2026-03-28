import type { Subscription } from "./types";

const ENDPOINT = "/api/subscriptions";

export async function fetchSubscriptions(
  signal?: AbortSignal
): Promise<Subscription[]> {
  const res = await fetch(ENDPOINT, { signal });

  if (!res.ok) {
    throw new Error(`Server error ${res.status}`);
  }

  const json = await res.json();
  return json.data ?? [];
}