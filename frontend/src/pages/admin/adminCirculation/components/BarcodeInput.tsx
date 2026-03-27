import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [success, setSuccess] = useState(false);

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
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSubmit())}
          placeholder={placeholder}
          disabled={disabled || scanning}
          className={success ? "border-green-500 transition-colors duration-300" : ""}
        />
        <Button
          type="button"
          variant={scanning ? "destructive" : "outline"}
          className="shrink-0"
          disabled={disabled || loading}
          onClick={() => setScanning((s) => !s)}
          title={scanning ? "Stop scanning" : "Scan QR code"}
        >
          {scanning ? <X className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled || loading || !value.trim() || scanning}
          onClick={onSubmit}
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Success indicator */}
      {success && (
        <div className="flex items-center gap-2 text-green-500 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>QR code scanned successfully</span>
        </div>
      )}

      {scanning && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-64 h-64 bg-black rounded-xl overflow-hidden">
            {/* Mirrored video */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Corner brackets */}
            {[
              "top-3 left-3 border-t-2 border-l-2 rounded-tl",
              "top-3 right-3 border-t-2 border-r-2 rounded-tr",
              "bottom-3 left-3 border-b-2 border-l-2 rounded-bl",
              "bottom-3 right-3 border-b-2 border-r-2 rounded-br",
            ].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 border-primary ${cls}`} />
            ))}

            {/* Animated scan line */}
            <div
              className="absolute left-4 right-4 h-0.5 bg-primary opacity-80 rounded-full"
              style={{ animation: "qr-scan 2s ease-in-out infinite" }}
            />

            {/* Label */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <span className="text-[10px] text-white/60 tracking-widest uppercase">
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

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default BarcodeInput;