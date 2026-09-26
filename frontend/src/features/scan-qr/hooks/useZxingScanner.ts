import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import type { Exception, Result } from "@zxing/library";

interface Options {
  onResult: (text: string) => void;
  active: boolean;
  facingMode?: "environment" | "user";
}

export const useZxingScanner = ({ onResult, active, facingMode }: Options) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setError(null);

    const handleDecode = (result: Result, err?: Exception) => {
      if (result) {
        onResult(result.getText());
        reader.reset(); // stop after first scan
      }
      if (err && !(err instanceof NotFoundException)) {
        setError("Camera error — check permissions");
      }
    };

    const startCamera = facingMode
      ? reader.decodeFromConstraints({ video: { facingMode: { exact: facingMode } } }, videoRef.current!, handleDecode)
      : reader.decodeFromVideoDevice(undefined, videoRef.current!, handleDecode);

    startCamera.catch(() => setError("Could not start camera"));

    return () => {
      reader.reset();
    };
  }, [active, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return { videoRef, error };
};
