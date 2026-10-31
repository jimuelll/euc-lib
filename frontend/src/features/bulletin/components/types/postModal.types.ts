import type { BulletinPost } from "../../types";

export interface PostModalProps {
  post: BulletinPost | null;
  onClose: () => void;
  onLikeToggle: (postId: number, liked: boolean, total: number) => void;
  onCommentAdded: (postId: number) => void;
  onPinToggle?: (postId: number, pinned: boolean) => void;
  onRequireLogin?: () => void;
  onArchived?: (postId: number) => void;
}
