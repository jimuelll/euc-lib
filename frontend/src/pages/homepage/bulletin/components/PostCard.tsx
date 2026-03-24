import { motion } from "framer-motion";
import { Heart, MessageCircle, BookOpen, Pin } from "lucide-react";
import { getInitials } from "../utils";
import type { BulletinPost } from "../types";

interface PostCardProps {
  post: BulletinPost;
  onClick: () => void;
  variant?: "grid" | "list";
}

export const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function PostCard({ post, onClick, variant = "grid" }: PostCardProps) {
  const isList = variant === "list";

  return (
    <motion.button
      variants={cardVariants}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`group relative flex w-full text-left overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        isList
          ? "flex-row rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300"
          : "flex-col rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300"
      }`}
    >
      {post.is_pinned && (
        <span className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
          <Pin className="h-2.5 w-2.5" /> Pinned
        </span>
      )}

      <div
        className={`relative overflow-hidden bg-muted/50 shrink-0 ${
          isList ? "w-40 sm:w-52 md:w-60" : "w-full"
        }`}
        style={isList ? { minHeight: "160px" } : { aspectRatio: "16/10" }}
      >
        {post.image_url ? (
          <img
            src={post.image_url}
            alt={post.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      <div className={`flex flex-1 flex-col min-w-0 ${isList ? "p-4 sm:p-5" : "p-4"}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-primary/20">
            {getInitials(post.author_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-foreground leading-tight">{post.author_name}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{post.date}</p>
          </div>
        </div>

        <p className={`font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 ${
          isList ? "text-base sm:text-lg" : "text-[13px] sm:text-sm"
        }`}>
          {post.title}
        </p>

        {isList && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">{post.excerpt}</p>
        )}

        <div className="mt-auto pt-3">
          <div className="h-px w-full bg-border/40 mb-3" />
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors ${
              post.liked_by_me ? "text-rose-500" : "text-muted-foreground"
            }`}>
              <Heart className={`h-3.5 w-3.5 transition-all duration-200 ${post.liked_by_me ? "fill-rose-500 scale-110" : ""}`} />
              {post.likes}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}