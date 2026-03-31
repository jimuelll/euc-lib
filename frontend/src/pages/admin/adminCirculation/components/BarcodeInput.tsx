import { useState } from "react";
import { Loader2, Search, QrCode, X, CheckCircle2 } from "lucide-react";
import { useZxingScanner } from "@/hooks/useZxingScanner";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const BarcodeInput = ({
  value, onChange, onSubmit,
  loading, disabled, placeholder = "Type or scan QR code",
}: Props) => {
  const [scanning, setScanning] = useState(false);
  const [success,  setSuccess]  = useState(false);

  const handleResult = (text: string) => {
    onChange(text);
    setScanning(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
    setTimeout(onSubmit, 100);
  };

  const { videoRef, error } = useZxingScanner({ onResult: handleResult, active: scanning });

  return (
    <div className="space-y-3">

      {/* ── Input row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-0 border border-border overflow-hidden focus-within:border-primary transition-colors sm:flex-nowrap">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSubmit())}
          placeholder={placeholder}
          disabled={disabled || scanning}
          className={`h-9 min-w-0 basis-full px-3.5 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none disabled:opacity-50 transition-colors sm:basis-auto sm:flex-1 ${
            success ? "bg-success/5" : ""
          }`}
        />

        {/* Scan toggle */}
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setScanning((s) => !s)}
          title={scanning ? "Stop scanning" : "Scan QR code"}
          className={`flex h-9 flex-1 items-center justify-center border-t border-border transition-colors sm:w-9 sm:flex-none sm:border-l sm:border-t-0 ${
            scanning
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/40"
          } disabled:opacity-40`}
        >
          {scanning ? <X className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
        </button>

        {/* Submit */}
        <button
          type="button"
          disabled={disabled || loading || !value.trim() || scanning}
          onClick={onSubmit}
          className="flex h-9 flex-1 items-center justify-center border-l border-t border-border bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:w-9 sm:flex-none sm:border-t-0"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Search className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* ── Success indicator ──────────────────────────────────────── */}
      {success && (
        <div className="flex items-start gap-2 text-success">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span
            className="break-words text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            QR code scanned successfully
          </span>
        </div>
      )}

      {/* ── Scanner viewport ───────────────────────────────────────── */}
      {scanning && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative aspect-square w-full max-w-[16rem] bg-black overflow-hidden border border-border">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Dark vignette */}
            <div className="absolute inset-0 bg-black/35" />

            {/* Sharp corner brackets — no border-radius */}
            {[
              "top-3 left-3 border-t-2 border-l-2",
              "top-3 right-3 border-t-2 border-r-2",
              "bottom-3 left-3 border-b-2 border-l-2",
              "bottom-3 right-3 border-b-2 border-r-2",
            ].map((cls, i) => (
              <div key={i} className={`absolute w-5 h-5 border-warning ${cls}`} />
            ))}

            {/* Animated scan line */}
            <div
              className="absolute left-4 right-4 h-px bg-warning opacity-70"
              style={{ animation: "qr-scan 2s ease-in-out infinite" }}
            />

            {/* Label */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center">
              <span
                className="text-[9px] text-white/50 tracking-[0.25em] uppercase"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Align QR code
              </span>
            </div>
          </div>

          <style>{`
            @keyframes qr-scan {
              0%   { top: 20%; }
              50%  { top: 75%; }
              100% { top: 20%; }
            }
          `}</style>
        </div>
      )}

      {error && (
        <p
          className="text-[11px] text-destructive"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default BarcodeInput;
