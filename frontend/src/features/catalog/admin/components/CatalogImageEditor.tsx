import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { removeCatalogBookImage, uploadCatalogBookImage } from "../catalog.api";
import type { Book } from "../AdminCatalog.types";

type Props = {
  book: Book;
  onImageChange: (imageUrl: string | null, publicId: string | null) => void;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function CatalogImageEditor({ book, onImageChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(book.image_url ?? null);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setImageUrl(book.image_url ?? null);
    setImageFailed(false);
  }, [book.id, book.image_url]);

  const selectImage = async (file?: File) => {
    if (!file) return;
    if (!SUPPORTED_TYPES.has(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Images must be 5 MB or smaller.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const image = await uploadCatalogBookImage(book.id, file, setProgress);
      setImageUrl(image.image_url);
      setImageFailed(false);
      onImageChange(image.image_url, image.image_public_id);
      toast.success("Book cover saved.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not upload the book cover."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = async () => {
    setBusy(true);
    try {
      await removeCatalogBookImage(book.id);
      setImageUrl(null);
      setImageFailed(false);
      onImageChange(null, null);
      toast.success("Book cover removed.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not remove the book cover."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="catalog-image-heading" className="max-w-xl py-5">
      <h3 id="catalog-image-heading" className="text-sm font-semibold text-foreground">Book cover</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">Add one cover image for the public catalogue. JPG, PNG, or WebP up to 5 MB.</p>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-56 w-40 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/30 p-2">
          <img
            src={imageUrl && !imageFailed ? imageUrl : "/book-cover-fallback.svg"}
            alt={imageUrl && !imageFailed ? `Cover of ${book.title}` : "Generic book cover preview"}
            className="h-full w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose book cover image" disabled={busy} onChange={(event) => void selectImage(event.target.files?.[0])} />
          <Button type="button" className="min-h-11 w-full justify-start" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : imageUrl ? <Upload className="mr-2 h-4 w-4" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {busy ? `Uploading ${progress}%` : imageUrl ? "Replace cover image" : "Upload cover image"}
          </Button>
          {imageUrl ? <Button type="button" variant="outline" className="min-h-11 w-full justify-start text-destructive hover:text-destructive" disabled={busy} onClick={() => void removeImage()}><Trash2 className="mr-2 h-4 w-4" />Remove cover image</Button> : null}
          {busy ? <progress aria-label="Image upload progress" className="h-1.5 w-full accent-primary" max={100} value={progress} /> : null}
          <p className="text-xs leading-5 text-muted-foreground">The catalogue uses a generic book cover when no image is saved. Theses always display the thesis cover.</p>
        </div>
      </div>
    </section>
  );
}
