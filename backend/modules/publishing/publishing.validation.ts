import {normalizePostContent,validateImageDescriptions} from "../bulletin/bulletin.content";
import { createHash } from "node:crypto";
import { sections, type Section, type Payload } from "./publishing.types";
import guide = require("../user-guide/user-guide.service");
export const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
export function section(value: unknown): Section { if (!sections.includes(value as Section))
    fail("Unknown publishing section", 404); return value as Section; }
export function canonical(value: any): string { return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item); }
export const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const required = (value: any, name: string) => { if (typeof value !== "string" || !value.trim())
    fail(`Complete ${name}.`); };
const safeUrl = (value: any, name: string, optional = false) => { if (optional && !value)
    return; try {
    if (!["http:", "https:"].includes(new URL(value).protocol))
        fail(`Use an http or https URL for ${name}.`);
}
catch {
    fail(`Use a valid http or https URL for ${name}.`);
} };
export function validateDraft(value: unknown): asserts value is Payload {
    if (!value || typeof value !== "object" || Array.isArray(value))
        fail("Invalid draft.");
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > 2000000)
        fail("This section exceeds the 2 MB editing limit.");
}
export function validatePublished(kind: Section, payload: Payload, base: Payload): void {
    validateDraft(payload);
    if (kind === "homepage") {
        for (const key of ["hero_title", "hero_highlight"])
            required(payload[key], key.replaceAll("_", " "));
        if (payload.contact_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email))
            fail("Enter a valid contact email.");
        safeUrl(payload.hero_image_url, "homepage image", true);
        if (!Array.isArray(payload.hero_stats) || payload.hero_stats.length !== 3)
            fail("Provide three display statistics.");
        for (const stat of payload.hero_stats) {
            required(stat.value, "statistic value");
            required(stat.label, "statistic label");
        }
        if (!Array.isArray(payload.hours))
            fail("Invalid operating hours.");
        for (const hour of payload.hours) {
            required(hour.day, "day");
            required(hour.time, "hours");
        }
        return;
    }
    if (kind === "about") {
        required(payload.library_name, "library name");
        for (const key of ["policies", "facilities", "staff", "spaces"])
            if (!Array.isArray(payload[key]))
                fail(`Invalid ${key}.`);
        for (const member of payload.staff) {
            required(member.name, "staff name");
            required(member.role, "staff role");
            safeUrl(member.image_url, "staff image", true);
        }
        for (const space of payload.spaces) {
            required(space.name, "space name");
            safeUrl(space.image_url, "space image", true);
        }
        return;
    }
    if (!Array.isArray(payload.items))
        fail("Invalid records.");
    const originalIds = new Set<number>((base.items || []).map((item: any) => Number(item.id)));
    const ids = new Set<number>();
    for (const item of payload.items) {
        if (item.id) {
            const id = Number(item.id);
            if (!originalIds.has(id) || ids.has(id))
                fail("Records changed. Reload the section before publishing.", 409);
            ids.add(id);
        }
        if (item.deleted)
            continue;
        required(item.title, kind === "guide" ? "module title" : "title");
        if (kind === "events") {
            if (!item.starts_at || !Number.isFinite(new Date(item.starts_at).getTime()))
                fail("Choose a valid event start.");
            if (item.ends_at && (!Number.isFinite(new Date(item.ends_at).getTime()) || new Date(item.ends_at) <= new Date(item.starts_at)))
                fail("Event end must be after its start.");
        }
        if (kind === "subscriptions") {
            safeUrl(item.url, "resource");
            safeUrl(item.image_url, "resource image", true);
        }
        if (kind === "bulletin") {
            validateImageDescriptions(normalizePostContent(item),(base.items||[]).find((row:any)=>Number(row.id)===Number(item.id)));
            required(item.content, "post content"); if(item.gallery&&!Array.isArray(item.gallery))fail("Invalid post gallery.");if((item.gallery||[]).length>8)fail("A gallery supports up to eight images.");for(const image of item.gallery||[]){safeUrl(image.url,"gallery image");if(typeof image.alt!=="string"||image.alt.length>500)fail("Invalid gallery image description.");}
            safeUrl(item.image_url, "post image", true);
            if (!["announcement", "event"].includes(item.post_type))
                fail("Choose a valid post type.");
            if (item.post_type === "event" && (!item.event_starts_at || !Number.isFinite(new Date(item.event_starts_at).getTime())))
                fail("Choose a valid post event start.");
            if (item.event_ends_at && (!Number.isFinite(new Date(item.event_ends_at).getTime()) || new Date(item.event_ends_at) <= new Date(item.event_starts_at)))
                fail("Post event end must be after its start.");
            safeUrl(item.event_registration_url, "registration", true);
        }
        if (kind === "guide") { const original=(base.items||[]).find((row:any)=>row.id===item.id);if(original?.published_slug&&original.published_slug!==item.slug)fail("Published guide addresses are locked to keep existing links working.");
            guide.validateContent(guide.normalizeContent(item));
            safeUrl(item.image_url, "module image", true);
        }
    }
    if ([...originalIds].some(id => !ids.has(id)))
        fail("A record is missing from the draft. Reload the section before publishing.", 409);
    if (kind === "guide") {
        const slugs = payload.items.filter((item: any) => !item.deleted).map((item: any) => guide.normalizeContent(item).slug);
        if (new Set(slugs).size !== slugs.length)
            fail("Each guide module needs a unique address.");
    }
}
