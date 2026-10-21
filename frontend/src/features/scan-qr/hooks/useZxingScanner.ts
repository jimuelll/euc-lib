import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException, ChecksumException, FormatException } from "@zxing/library";
import type { Exception, Result } from "@zxing/library";

interface Options {
  onResult: (text: string) => void;
  active: boolean;
  facingMode?: "environment" | "user";
}

export const useZxingScanner = ({ onResult, active, facingMode }: Options) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    let cancelled = false, handled = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setError(null);

    const handleDecode = (result: Result, err?: Exception) => {
      if (cancelled || handled) return;
      if (result) {
        handled = true;
        reader.reset();
        onResultRef.current(result.getText());
        return;
      }
      if (err && !(err instanceof NotFoundException) && !(err instanceof ChecksumException) && !(err instanceof FormatException)) {
        setError("Camera error — check permissions");
      }
    };

    const startCamera = facingMode
      ? reader.decodeFromConstraints({ video: { facingMode: { ideal: facingMode } } }, videoRef.current!, handleDecode)
      : reader.decodeFromVideoDevice(undefined, videoRef.current!, handleDecode);

    startCamera.then(() => { if (cancelled) reader.reset(); }).catch(() => { if (!cancelled) setError("Could not start camera"); });

    return () => {
      cancelled = true;
      reader.reset();
    };
  }, [active, facingMode]);

  return { videoRef, error };
};
