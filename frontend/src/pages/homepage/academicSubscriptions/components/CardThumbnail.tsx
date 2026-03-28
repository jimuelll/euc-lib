import { BookOpen } from "lucide-react";

interface CardThumbnailProps {
  imageUrl: string | null;
  title: string;
  index: number;
}

export const CardThumbnail = ({ imageUrl, title, index }: CardThumbnailProps) => (
  <div className="relative flex items-center justify-center h-24 bg-muted/40 border-b border-border overflow-hidden">
    {/* Ghost index number */}
    <span
      className="absolute right-3 bottom-1 text-[48px] font-bold text-foreground/[0.04] select-none leading-none"
      style={{ fontFamily: "var(--font-heading)" }}
      aria-hidden="true"
    >
      {String(index + 1).padStart(2, "0")}
    </span>

    {imageUrl ? (
      <img
        src={imageUrl}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    ) : (
      <BookOpen className="h-7 w-7 text-muted-foreground/20 relative z-10" />
    )}
  </div>
);