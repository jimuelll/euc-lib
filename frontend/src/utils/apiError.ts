import { isAxiosError } from "axios";

type ErrorPayload = { message?: unknown; code?: unknown };

/** Returns the server message when it is safe to show, with a stable fallback. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ErrorPayload>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
