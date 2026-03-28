import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface UseZxingScannerOptions {
  onResult: (text: string) => void;
  active: boolean;
}

export const useZxingScanner = ({ onResult, active }: UseZxingScannerOptions) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setCameraError(null);

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          onResult(result.getText());
          reader.reset();
        }
        if (err && !(err instanceof NotFoundException)) {
          setCameraError("Camera error — check permissions");
        }
      })
      .catch(() => setCameraError("Could not start camera"));

    return () => {
      reader.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { videoRef, cameraError };
};