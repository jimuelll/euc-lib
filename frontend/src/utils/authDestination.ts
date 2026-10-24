/** Only local application destinations may survive an authentication boundary. */
export function authDestination(value?: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f]/.test(decoded) || decoded.startsWith("//")) return "/";
    const url = new URL(value, "https://library.local");
    if (url.origin !== "https://library.local" || /^\/login\/*$/i.test(decodeURIComponent(url.pathname))) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export const loginDestination = (destination: string) =>
  `/login?${new URLSearchParams({ returnTo: authDestination(destination) })}`;
