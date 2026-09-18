import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";
import type { RefObject } from "react";
import type { BulletinPost } from "../types";

type Props = {
  post: BulletinPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgRef: RefObject<HTMLImageElement>;
  zoom: number;
  origin: { x: number; y: number };
  handleImageClick: (event: React.MouseEvent<HTMLImageElement>) => void;
  toggleZoom: () => void;
  handleDownload: () => void;
  downloadError: string | null;
};

const PostImageLightbox = ({ post, open, onOpenChange, imgRef, zoom, origin, handleImageClick, toggleZoom, handleDownload, downloadError }: Props) => (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            hideClose
            className="fixed inset-0 left-0 top-0 z-[200] flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center border-0 bg-black/95 p-0 shadow-none sm:rounded-none"
          >
            <DialogTitle className="sr-only">{post.title} image viewer</DialogTitle>
          <img
            ref={imgRef}
            src={post.image_url}
            alt={post.title}
            onClick={handleImageClick}
            className="max-h-[90dvh] max-w-[92vw] object-contain select-none"
            style={{
              cursor: zoom > 1 ? "zoom-out" : "zoom-in",
              transform: `scale(${zoom})`,
              transformOrigin: `${origin.x}% ${origin.y}%`,
              transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            draggable={false}
          />
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleZoom();
              }}
              className="flex min-h-10 items-center gap-2 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              aria-label={zoom > 1 ? "Zoom out" : "Zoom in"}
            >
              {zoom > 1 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              {zoom > 1 ? "Zoom out" : "Zoom in"}
            </button>
            <span
              className="hidden bg-black/45 px-3 py-2 text-[10px] text-white/75 sm:block"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
            >
              Click image to {zoom > 1 ? "reset" : "zoom"}
            </span>
          </div>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenChange(false);
            }}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleDownload();
            }}
            className="absolute right-4 top-14 flex h-8 w-8 items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            title="Download original image"
            aria-label="Download original image"
          >
            <Download className="h-4 w-4" />
          </button>
          {downloadError && (
            <p className="absolute inset-x-4 bottom-20 z-10 mx-auto max-w-md bg-destructive px-4 py-3 text-center text-sm text-destructive-foreground" role="alert">
              {downloadError}
            </p>
          )}
          </DialogContent>
        </Dialog>
);

export default PostImageLightbox;
