import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PostLiker } from "./types/postModal.types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  likers: PostLiker[];
};

const PostLikersDialog = ({ open, onOpenChange, loading, likers }: Props) => (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Liked by</DialogTitle>
          </DialogHeader>
          {loading ? <p className="text-sm text-muted-foreground">Loading likes…</p> : likers.length ? (
            <div className="max-h-[55dvh] divide-y divide-border overflow-y-auto border-y border-border">
              {likers.map((liker) => <div key={liker.id} className="flex items-center justify-between gap-3 px-1 py-3"><span className="text-sm font-medium text-foreground">{liker.name}</span><span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{liker.role.replace("_", " ")}</span></div>)}
            </div>
          ) : <p className="text-sm text-muted-foreground">No likes yet.</p>}
        </DialogContent>
      </Dialog>
);

export default PostLikersDialog;
