import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException, ChecksumException, FormatException } from "@zxing/library";
import type { Exception, Result } from "@zxing/library";

interface Options {
  onResult: (text: string) => void;
  active: boolean;
  continuous?: boolean;
  paused?: boolean;
  restartKey?: number;
  facingMode?: "environment" | "user";
}

export const useZxingScanner = ({ onResult, active, facingMode, continuous=false, paused=false, restartKey=0 }: Options) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const pausedRef=useRef(paused);pausedRef.current=paused;
  const handledRef=useRef(false);
  useEffect(()=>{if(!paused)handledRef.current=false;},[paused]);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    let cancelled = false;handledRef.current=false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setError(null);

    const handleDecode = (result: Result, err?: Exception) => {
      if (cancelled || handledRef.current || pausedRef.current) return;
      if (result) {
        handledRef.current = true;
        if(!continuous)reader.reset();
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
  }, [active, facingMode, continuous, restartKey]);

  return { videoRef, error };
};
