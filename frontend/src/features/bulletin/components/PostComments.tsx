import { Loader2, Trash2 } from "lucide-react";
import { getInitials } from "../utils";
import type { BulletinComment } from "../types";

type Props = {
  comments: BulletinComment[];
  commentsLoading: boolean;
  canDeleteComment: (comment: BulletinComment) => boolean;
  handleDeleteComment: (commentId: number) => void;
};

const PostComments = ({ comments, commentsLoading, canDeleteComment, handleDeleteComment }: Props) => (
            <div className="px-5 sm:px-6 pt-5 pb-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-4 bg-border shrink-0" />
                <span
                  className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Comments
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {commentsLoading && (
                <div className="flex items-center gap-2 py-3 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span
                    className="text-xs font-bold uppercase tracking-[0.15em]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Loading...
                  </span>
                </div>
              )}

              {!commentsLoading && comments.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground/60">
                  No comments yet. Be the first to leave one.
                </p>
              )}

              <div className="space-y-0 divide-y divide-border border border-border">
                {!commentsLoading && comments.map((c) => (
                  <div key={c.id} className="flex gap-0 group/comment hover:bg-secondary/30 transition-colors">
                    <div className="w-10 shrink-0 flex flex-col items-center pt-3 border-r border-border gap-2">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center bg-primary text-primary-foreground text-[8px] font-bold"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {getInitials(c.author)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-xs font-bold uppercase tracking-[0.08em] text-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {c.author}
                          </span>
                          <span className="text-xs text-muted-foreground">{c.date}</span>
                        </div>
                        {canDeleteComment(c) && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="hidden group-hover/comment:flex shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

);

export default PostComments;

