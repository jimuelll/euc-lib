import { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMyLibraryBarcode } from "../api";

export default function MyLibraryBarcode() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    setImageUrl(null);
    setFailed(false);
    setLoading(true);

    fetchMyLibraryBarcode(controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt]);

  const download = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "my-library-qr.png";
    link.click();
  };

  return (
    <section aria-labelledby="library-qr-heading" className="mt-8 border border-border/80 bg-card">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="max-w-lg">
          <div className="flex items-center gap-2 text-foreground">
            <QrCode aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 id="library-qr-heading" className="text-base font-semibold">Your library QR code</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Show this code to library staff to look up your account. You can save it to your phone for quick access.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          {loading ? (
            <div role="status" aria-label="Loading your QR code" className="h-40 w-40 animate-pulse border border-border bg-muted" />
          ) : imageUrl ? (
            <img src={imageUrl} alt="Your library account QR code" className="h-40 w-40 border border-border bg-white p-1" />
          ) : (
            <div role="alert" className="flex min-h-40 w-52 flex-col items-center justify-center gap-3 border border-destructive/30 px-3 text-center">
              <p className="text-sm text-destructive">Your QR code couldn’t be loaded.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </Button>
            </div>
          )}
          {imageUrl ? (
            <Button type="button" variant="outline" onClick={download}>
              <Download aria-hidden="true" />
              Download PNG
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
