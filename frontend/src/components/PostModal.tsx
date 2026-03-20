import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import type { BulletinPost } from "@/pages/homepage/Bulletin";

interface PostModalProps {
  post: BulletinPost | null;
  onClose: () => void;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const PostModal = ({ post, onClose }: PostModalProps) => {
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(false);

  if (!post) return null;

  return (
    <Dialog open={!!post} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">{post.title}</DialogTitle>
        </DialogHeader>

        {post.image && (
          <img
            src={post.image}
            alt={post.title}
            className="w-full rounded-md object-cover max-h-56"
          />
        )}

        <p className="text-xs text-muted-foreground">{post.date}</p>
        <p className="text-sm text-foreground leading-relaxed">{post.content}</p>

        <div className="flex items-center gap-4 border-t pt-3">
          <button
            onClick={() => setLiked(!liked)}
            className={`flex items-center gap-1 text-sm transition-colors ${liked ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-primary" : ""}`} />
            {post.likes + (liked ? 1 : 0)}
          </button>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" /> {post.comments.length}
          </span>
        </div>

        {/* Comments */}
        {post.comments.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            <h4 className="font-heading text-sm font-medium text-foreground">Comments</h4>
            {post.comments.map((c, i) => (
              <div key={i} className="flex gap-3">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {getInitials(c.author)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-md bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{c.author}</span>
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="border-t pt-3">
          <p className="text-xs text-warning mb-2">
            ⚠️ Comment responsibly. School rules apply.
          </p>
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                ME
              </AvatarFallback>
            </Avatar>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="h-10 flex-1 rounded-md border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <Button size="sm" disabled={!commentText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostModal;
