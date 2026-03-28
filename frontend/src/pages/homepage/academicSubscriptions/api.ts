import type { Subscription } from "./types";

// In development, VITE_API_BASE_URL is typically empty so relative URLs work.
// In production, set this to your backend origin, e.g.:
//   VITE_API_BASE_URL=https://your-api.railway.app
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const ENDPOINT = `${BASE_URL}/api/subscriptions`;

export async function fetchSubscriptions(
  signal?: AbortSignal
): Promise<Subscription[]> {
  const res = await fetch(ENDPOINT, { signal });

  // 304 Not Modified — body is empty by spec, treat as success and return
  // whatever the browser has cached (the fetch API resolves the cached body
  // for us automatically, but guard just in case).
  if (res.status === 304) {
    return [];
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Server error ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const json = await res.json();
  return json.data ?? [];
}