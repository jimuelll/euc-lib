import type { Pool } from "mysql2/promise";
import type { SiteContent, SiteContentRow } from "./site-content.types";

const db = require("../../db") as Pool;

const ensureDefaults = async (defaults: SiteContent): Promise<void> => {
  await db.query(
    "INSERT INTO site_content_settings (id,hero_kicker,hero_title,hero_highlight,hero_description,hours,hero_stats,address,contact_email,contact_phone) VALUES (1,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
    [defaults.hero_kicker, defaults.hero_title, defaults.hero_highlight, defaults.hero_description, JSON.stringify(defaults.hours), JSON.stringify(defaults.hero_stats), defaults.address, defaults.contact_email, defaults.contact_phone],
  );
};

const getSiteContent = async (defaults: SiteContent): Promise<SiteContentRow | null> => {
  await ensureDefaults(defaults);
  const [rows] = await db.query<SiteContentRow[]>("SELECT * FROM site_content_settings WHERE id=1");
  return rows[0] ?? null;
};

const updateSiteContent = async (value: SiteContent, userId?: number): Promise<void> => {
  await db.query(
    "UPDATE site_content_settings SET hero_kicker=?,hero_title=?,hero_highlight=?,hero_description=?,hero_image_url=?,hours=?,hero_stats=?,address=?,contact_email=?,contact_phone=?,updated_by=? WHERE id=1",
    [value.hero_kicker, value.hero_title, value.hero_highlight, value.hero_description, value.hero_image_url, JSON.stringify(value.hours), JSON.stringify(value.hero_stats), value.address, value.contact_email, value.contact_phone, userId || null],
  );
};

export = { ensureDefaults, getSiteContent, updateSiteContent };
