import { Archive, Loader2, Pin, PinOff, X } from "lucide-react";

type Props = {
  canPin: boolean;
  pinned: boolean;
  pinBusy: boolean;
  handlePin: () => void;
  canArchive: boolean;
  archiveBusy: boolean;
  archiveConfirm: boolean;
  handleArchive: () => void;
  onClose: () => void;
};

const PostModalActions = ({ canPin, pinned, pinBusy, handlePin, canArchive, archiveBusy, archiveConfirm, handleArchive, onClose }: Props) => (
              <div className="flex flex-wrap items-center justify-end gap-1 shrink-0 sm:flex-nowrap">
                {canPin && (
                  <button
                    onClick={handlePin}
                    disabled={pinBusy}
                    title={pinned ? "Unpin post" : "Pin post"}
                    className="flex h-8 w-8 items-center justify-center text-primary-foreground/40 hover:text-warning hover:bg-primary-foreground/10 transition-colors disabled:opacity-40"
                  >
                    {pinBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : pinned ? (
                      <PinOff className="h-3.5 w-3.5" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}

                {canArchive && (
                  <button
                    onClick={handleArchive}
                    disabled={archiveBusy}
                    title={archiveConfirm ? "Click again to confirm archive" : "Archive post"}
                    className={`flex h-8 items-center justify-center gap-1.5 px-2 transition-colors disabled:opacity-40 ${
                      archiveConfirm
                        ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                        : "text-primary-foreground/40 hover:text-destructive hover:bg-primary-foreground/10"
                    }`}
                  >
                    {archiveBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    {archiveConfirm && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.15em]"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Confirm?
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center text-primary-foreground/40 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
);

export default PostModalActions;

