import { Loader2, Trash2 } from "@/components/ui/library-glyphs";
import { getInitials } from "../utils";
import type { BulletinComment } from "../types";

type Props = {
  comments: BulletinComment[];
  commentsLoading: boolean;
  canDeleteComment: (comment: BulletinComment) => boolean;
  handleDeleteComment: (commentId: number) => void;
};

const PostComments = ({ comments, commentsLoading, canDeleteComment, handleDeleteComment }: Props) => (
  <section className="post-drawer-comments" aria-label="Comments">
    {commentsLoading && <p className="post-drawer-comment-status" role="status"><Loader2 aria-hidden="true" className="animate-spin" />Loading comments…</p>}
    {!commentsLoading && !comments.length && <p className="post-drawer-comment-status">No comments yet. Be the first to leave one.</p>}
    {!commentsLoading && comments.map((comment) => <div key={comment.id} className="post-drawer-comment">
      <span className="post-drawer-avatar" aria-hidden="true">{getInitials(comment.author)}</span>
      <div className="post-drawer-comment-copy">
        <div className="post-drawer-byline"><b>{comment.author}</b><span>{comment.date}</span></div>
        <p>{comment.text}</p>
      </div>
      {canDeleteComment(comment) && <button type="button" className="post-drawer-delete-comment" aria-label={`Delete comment by ${comment.author}`} onClick={() => void handleDeleteComment(comment.id)}><Trash2 aria-hidden="true" /></button>}
    </div>)}
  </section>
);

export default PostComments;