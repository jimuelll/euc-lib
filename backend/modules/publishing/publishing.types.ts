export const sections = ["homepage", "about", "bulletin", "events", "subscriptions", "guide"] as const;
export type Section = typeof sections[number];
export type Payload = Record<string, any>;
export interface DraftRow {
    item_meta_json?: string | null;
    section: Section;
    draft_json: string | null;
    base_json: string | null;
    revision: number;
    saved_at: string | Date | null;
    published_at: string | Date | null;
}
