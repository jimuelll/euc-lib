import { Archive, Loader2, Pin, PinOff, X } from "@/components/ui/library-glyphs";

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
  <div className="post-drawer-actions">
    {canPin && <button type="button" onClick={handlePin} disabled={pinBusy} aria-label={pinned ? "Unpin post" : "Pin post"}>
      {pinBusy ? <Loader2 aria-hidden="true" className="animate-spin" /> : pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}{pinned ? "Unpin" : "Pin"}
    </button>}
    {canArchive && <button type="button" onClick={handleArchive} disabled={archiveBusy} className={archiveConfirm ? "is-danger" : undefined} aria-label={archiveConfirm ? "Confirm archive post" : "Archive post"}>
      {archiveBusy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Archive aria-hidden="true" />}{archiveConfirm ? "Confirm archive?" : "Archive"}
    </button>}
    <button type="button" onClick={onClose} aria-label="Close post"><X aria-hidden="true" />Close</button>
  </div>
);

export default PostModalActions;