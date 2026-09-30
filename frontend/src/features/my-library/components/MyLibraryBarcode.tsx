import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useMyLibraryBarcode } from "../hooks/useMyLibraryBarcode";

export default function MyLibraryBarcode({
  qr,
  large = false,
}: {
  qr: ReturnType<typeof useMyLibraryBarcode>;
  large?: boolean;
}) {
  const size = large ? "w-64" : "w-32";
  return (
    <div className="flex min-w-0 flex-col items-center gap-4">
      {qr.imageUrl ? (
        <img
          src={qr.imageUrl}
          alt="Your library account QR code"
          className={`${size} aspect-square h-auto max-w-full rounded-lg bg-white object-contain p-2`}
        />
      ) : qr.loading ? (
        <div
          role="status"
          aria-label="Loading your QR code"
          className={`${size} aspect-square max-w-full animate-pulse rounded-lg bg-muted`}
        />
      ) : (
        <div role="alert" className="w-full space-y-3 text-center">
          <p className="text-sm text-destructive">
            Your QR code couldn’t be loaded.
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void qr.retry()}
            disabled={qr.retrying}
          >
            {qr.retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      )}
      {qr.imageUrl && large && (
        <Button variant="outline" className="min-h-11" onClick={qr.download}>
          <Download aria-hidden="true" className="size-4" />
          Download PNG
        </Button>
      )}
      {qr.imageUrl && qr.error && (
        <p role="alert" className="text-sm text-destructive">
          The QR code could not be refreshed.{" "}
          <button
            className="min-h-11 underline underline-offset-4"
            onClick={() => void qr.retry()}
            disabled={qr.retrying}
          >
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
