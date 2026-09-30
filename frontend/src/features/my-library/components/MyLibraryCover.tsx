import { useState } from "react";

type Props = {
  title: string;
  image_url?: string | null;
  material_type?: "book" | "thesis";
};

export default function MyLibraryCover({
  title,
  image_url,
  material_type,
}: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const fallback =
    material_type === "thesis"
      ? "/thesis-cover-fallback.svg"
      : "/book-cover-fallback.svg";
  const hasCover = Boolean(image_url && image_url !== failedUrl);

  return (
    <img
      src={hasCover ? image_url! : fallback}
      alt={
        hasCover
          ? `Cover of ${title}`
          : `Generic ${material_type === "thesis" ? "thesis" : "book"} cover`
      }
      width={64}
      height={96}
      loading="lazy"
      decoding="async"
      onError={hasCover ? () => setFailedUrl(image_url!) : undefined}
      className="h-[84px] w-14 shrink-0 border border-border bg-muted/20 object-contain sm:h-24 sm:w-16"
    />
  );
}
