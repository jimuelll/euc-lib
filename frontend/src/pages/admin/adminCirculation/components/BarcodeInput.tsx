import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ScanLine, X } from "lucide-react";
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
  loading, disabled, placeholder = "Type or scan barcode",
}: Props) => {
  const [scanning, setScanning] = useState(false);

  const handleResult = (text: string) => {
    onChange(text);
    setScanning(false);
    setTimeout(onSubmit, 100);
  };

  const { videoRef, error } = useZxingScanner({ onResult: handleResult, active: scanning });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSubmit())}
          placeholder={placeholder}
          disabled={disabled || scanning}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled || loading}
          onClick={() => setScanning((s) => !s)}
          title={scanning ? "Stop scanning" : "Scan barcode"}
        >
          {scanning ? <X className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
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

      {scanning && (
        <div className="relative overflow-hidden rounded-lg border bg-black aspect-video max-h-48">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-2/3 h-1/3 border-2 border-primary rounded opacity-70" />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default BarcodeInput;