// ── Public API ────────────────────────────────────────────────────────────────
// Import from this file to avoid deep path coupling across the app.

export { BulletinPage }         from "./BulletinPage";
export { AnnouncementsSection } from "./AnnouncementsSection";
export { PostModal }            from "./components/PostModal";
export { CreatePostModal }      from "./components/CreatePostModal";
export { PostCard }             from "./components/PostCard";
export { BulletinSidebar }      from "./components/BulletinSidebar";
export { useBulletinPosts }     from "./hooks/useBulletinPosts";
export { useLikeToggle }        from "./hooks/useLikeToggle";
export type { BulletinPost, BulletinComment, ApiPost, ApiComment } from "./types";

// ── Default export keeps the /bulletin route working without touching App.tsx routing ──
export { BulletinPage as default } from "./BulletinPage";