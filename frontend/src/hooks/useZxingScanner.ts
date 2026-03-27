import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface Options {
  onResult: (text: string) => void;
  active: boolean;
}

export const useZxingScanner = ({ onResult, active }: Options) => {
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

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          onResult(result.getText());
          reader.reset(); // stop after first scan
        }
        if (err && !(err instanceof NotFoundException)) {
          setError("Camera error — check permissions");
        }
      })
      .catch(() => setError("Could not start camera"));

    return () => {
      reader.reset();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return { videoRef, error };
};