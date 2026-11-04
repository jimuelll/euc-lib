// Public API of the bulletin feature. The route loads the default export (the page);
// other features only need the API helpers below.

export { BulletinPage as default } from "./BulletinPage";

export { fetchBulletinPosts, fetchSavedBulletinPosts, setPostSaved } from "./api";
export type { SavedBulletinPost } from "./api";
