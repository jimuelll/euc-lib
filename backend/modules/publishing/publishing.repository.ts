import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { Section, Payload, DraftRow } from "./publishing.types";
import { canonical } from "./publishing.validation";
import guide = require("../user-guide/user-guide.service");
import about = require("../about/about.repository");
const db = require("../../db") as Pool;
export const getConnection = () => db.getConnection();
const parse = (value: any, fallback: any) => typeof value === "string" ? JSON.parse(value) : value ?? fallback;
const date = (value: any) => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}` : value;
export async function lockDraft(conn: PoolConnection, section: Section): Promise<DraftRow> {
    await conn.query("INSERT IGNORE INTO website_content_drafts (section) VALUES (?)", [section]);
    const [rows] = await conn.query<Array<RowDataPacket & DraftRow>>("SELECT * FROM website_content_drafts WHERE section=? FOR UPDATE", [section]);
    return rows[0];
}
export async function readLive(conn: PoolConnection, kind: Section, lock = false): Promise<Payload> {
    const suffix = lock ? " FOR UPDATE" : "";
    if (kind === "homepage") {
        const [rows] = await conn.query<RowDataPacket[]>("SELECT hero_kicker,hero_title,hero_highlight,hero_description,hero_image_url,hero_image_alt,hero_stats,hours,address,contact_email,contact_phone FROM site_content_settings WHERE id=1" + suffix);
        const row = rows[0];
        return row ? { ...row, hero_stats: parse(row.hero_stats, []), hours: parse(row.hours, []) } : {};
    }
    if (kind === "about") {
        const [rows] = await conn.query<RowDataPacket[]>("SELECT library_name,established,mission_title,mission_text,history_title,history_text,policies,facilities,staff,spaces FROM about_settings WHERE id=1" + suffix);
        const row = rows[0] || { library_name: "Enverga-Candelaria Library", established: null, mission_title: "Our mission", mission_text: "", history_title: "Our history", history_text: "" };
        return { ...row, ...Object.fromEntries(["policies", "facilities", "staff", "spaces"].map(key => [key, parse(row[key], [])])) };
    }
    const sql = {
        events: "SELECT id,title,starts_at,ends_at FROM library_events ORDER BY id",
        subscriptions: "SELECT id,title,url,description,category,image_url,image_alt,image_public_id,is_active,sort_order FROM academic_subscriptions WHERE deleted_at IS NULL ORDER BY id",
        bulletin: "SELECT id,title,content,image_url,image_alt,gallery,image_public_id,post_type,event_starts_at,event_ends_at,event_location,event_registration_url,is_pinned,created_at,deleted_at FROM bulletin_posts ORDER BY id",
        guide: "SELECT id,sort_order,draft_content,published_content,is_published,published_at FROM user_guide_modules WHERE deleted_at IS NULL ORDER BY id",
    };
    const [rows] = await conn.query<RowDataPacket[]>(sql[kind] + suffix);
    return { items: rows.map(row => kind === "guide" ? { ...guide.normalizeContent(parse(row.draft_content, {})), id: Number(row.id), sort_order: Number(row.sort_order), is_published: Boolean(row.is_published), published_at: date(row.published_at), published_slug:parse(row.published_content,{})?.slug||null, has_unpublished_changes: canonical(parse(row.draft_content, {})) !== canonical(parse(row.published_content, {})) } : { ...row, ...Object.fromEntries(Object.entries(row).filter(([key]) => key.endsWith("_at")).map(([key, value]) => [key, date(value)])), ...(kind === "subscriptions" ? { is_active: Boolean(row.is_active) } : {}), ...(kind === "bulletin" ? { is_pinned: Boolean(row.is_pinned), archived: Boolean(row.deleted_at), gallery:parse(row.gallery,[]) } : {}) }) };
}
export async function writeDraft(conn: PoolConnection, kind: Section, payload: Payload | null, base: Payload | null, userId: number): Promise<void> {
    await conn.query("UPDATE website_content_drafts SET draft_json=?,base_json=?,revision=revision+1,saved_at=?,updated_by=? WHERE section=?", [payload ? JSON.stringify(payload) : null, base ? JSON.stringify(base) : null, payload ? new Date() : null, userId, kind]);
}
export async function markPublished(conn: PoolConnection, kind: Section, userId: number): Promise<void> { await conn.query("UPDATE website_content_drafts SET draft_json=NULL,base_json=NULL,revision=revision+1,saved_at=NULL,published_at=NOW(),updated_by=? WHERE section=?", [userId, kind]); }
export async function discardLegacyGuideDraft(conn: PoolConnection, actor: number,id?:number): Promise<void> {
    await conn.query("UPDATE user_guide_modules SET draft_content=published_content,updated_by=? WHERE is_published=1 AND published_content IS NOT NULL AND deleted_at IS NULL"+(id?" AND id=?":""),id?[actor,id]:[actor]);
}
const sqlDate = (value: any) => value ? String(value).replace("T", " ").slice(0, 19) : null;
export async function writeLive(conn: PoolConnection, kind: Section, payload: Payload, base: Payload, actor: number, itemKey?:string): Promise<void> {
    if (kind === "homepage") {
        const fields = ["hero_kicker", "hero_title", "hero_highlight", "hero_description", "hero_image_url", "hero_image_alt", "hero_stats", "hours", "address", "contact_email", "contact_phone"];
        await conn.query(`UPDATE site_content_settings SET ${fields.map(field => field + "=?").join(",")},updated_by=? WHERE id=1`, [...fields.map(field => ["hours", "hero_stats"].includes(field) ? JSON.stringify(payload[field]) : payload[field] ?? null), actor]);
        return;
    }
    if (kind === "about") {
        await about.updateAboutSettings({ ...payload, policies: JSON.stringify(payload.policies), facilities: JSON.stringify(payload.facilities), staff: JSON.stringify(payload.staff), spaces: JSON.stringify(payload.spaces) } as any, actor, conn);
        return;
    }
    for (const item of payload.items) {
        if(itemKey && String(item.id||item._key)!==itemKey)continue;
        const original = base.items.find((row: any) => Number(row.id) === Number(item.id));
        if (original && canonical(original) === canonical(item) && !(kind === "guide" && item.is_published && item.has_unpublished_changes))
            continue;
        if (item.deleted) {
            if (!item.id)
                continue;
            if (kind === "events")
                await conn.query("DELETE FROM library_events WHERE id=?", [item.id]);
            if (kind === "subscriptions")
                await conn.query("UPDATE academic_subscriptions SET deleted_at=NOW(),deleted_by=? WHERE id=?", [actor, item.id]);
            if (kind === "bulletin") {
                await conn.query("UPDATE bulletin_posts SET deleted_at=NOW(),deleted_by=?,is_pinned=0 WHERE id=?", [actor, item.id]);
                await conn.query("UPDATE bulletin_comments SET deleted_at=NOW(),deleted_by=? WHERE post_id=?", [actor, item.id]);
            }
            if (kind === "guide")
                await conn.query("UPDATE user_guide_modules SET slug=CONCAT(slug,'-archived-',id),deleted_at=NOW(),updated_by=? WHERE id=?", [actor, item.id]);
            continue;
        }
        let fields: string[] = [];
        let values: any[] = [];
        let table = "";
        if (kind === "events") {
            table = "library_events";
            fields = ["title", "starts_at", "ends_at"];
            values = [item.title, sqlDate(item.starts_at), sqlDate(item.ends_at)];
        }
        if (kind === "subscriptions") {
            table = "academic_subscriptions";
            fields = ["title", "url", "description", "category", "image_url", "image_alt", "image_public_id", "is_active", "sort_order", "updated_by"];
            values = [item.title, item.url, item.description || null, item.category || null, item.image_url || null, item.image_alt||null, item.image_public_id || null, item.is_active ? 1 : 0, item.sort_order || 0, actor];
        }
        if (kind === "bulletin") {
            table = "bulletin_posts";
            fields = ["title", "excerpt", "content", "image_url", "image_alt", "gallery", "image_public_id", "post_type", "event_starts_at", "event_ends_at", "event_location", "event_registration_url", "is_pinned", "deleted_at", "deleted_by"];
            values = [item.title, item.content.slice(0, 500), item.content, item.image_url || null, item.image_alt||null, JSON.stringify(item.gallery||[]), item.image_public_id || null, item.post_type, sqlDate(item.event_starts_at), sqlDate(item.event_ends_at), item.event_location || null, item.event_registration_url || null, item.archived ? 0 : item.is_pinned ? 1 : 0, item.archived ? new Date() : null, item.archived ? actor : null];
        }
        if (kind === "guide") {
            const content = guide.normalizeContent(item);
            table = "user_guide_modules";
            fields = ["slug", "sort_order", "draft_content", "is_published", "updated_by"];
            values = [content.slug, item.sort_order || 0, JSON.stringify(content), item.is_published ? 1 : 0, actor];
            if (item.is_published) {
                fields.push("published_content", "published_at");
                values.push(JSON.stringify(content), new Date());
            }
        }
        if (item.id) {
            await conn.query(`UPDATE ${table} SET ${fields.map(field => field + "=?").join(",")} WHERE id=?`, [...values, item.id]);
            if (kind === "bulletin" && Boolean(original?.archived) !== Boolean(item.archived))
                await conn.query("UPDATE bulletin_comments SET deleted_at=?,deleted_by=? WHERE post_id=?", [item.archived ? new Date() : null, item.archived ? actor : null, item.id]);
        }
        else {
            const creator = kind === "bulletin" ? "author_id" : "created_by";
            await conn.query<ResultSetHeader>(`INSERT INTO ${table} (${[...fields, creator].join(",")}) VALUES (${[...values, actor].map(() => "?").join(",")})`, [...values, actor]);
        }
    }
}

export async function writeItemMeta(conn:PoolConnection,kind:Section,meta:any) {await conn.query("UPDATE website_content_drafts SET item_meta_json=? WHERE section=?",[JSON.stringify(meta),kind]);}
