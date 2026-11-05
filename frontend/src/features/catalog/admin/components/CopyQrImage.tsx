import { useEffect, useState } from "react";
import { fetchCatalogBarcode } from "../catalog.api";

type Props = { code: string; size?: number; label?: string; className?: string };

export default function CopyQrImage({ code, size = 40, label = "QR code for this copy", className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let created: string | null = null;
    setUrl(null);
    setFailed(false);
    fetchCatalogBarcode(code)
      .then((next) => {
        created = next;
        if (active) setUrl(next);
        else URL.revokeObjectURL?.(next);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL?.(created);
    };
  }, [code]);

  const box = { width: size, height: size } as const;
  if (url) return <img src={url} alt={label} className={className ? `catalog-qr ${className}` : "catalog-qr"} style={box} />;
  return <span role={failed ? "img" : undefined} aria-label={failed ? "QR code unavailable" : undefined} className="catalog-qr catalog-qr-placeholder" style={box}>{failed ? "QR?" : ""}</span>;
}
