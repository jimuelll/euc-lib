const db = require("../../db");

async function ensureDefaults(defaults) {
  await db.query(
    "INSERT INTO site_content_settings (id,hero_kicker,hero_title,hero_highlight,hero_description,hours,hero_stats,address,contact_email,contact_phone) VALUES (1,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
    [defaults.hero_kicker, defaults.hero_title, defaults.hero_highlight, defaults.hero_description, JSON.stringify(defaults.hours), JSON.stringify(defaults.hero_stats), defaults.address, defaults.contact_email, defaults.contact_phone]
  );
}

async function getSiteContent(defaults) {
  await ensureDefaults(defaults);
  const [[row]] = await db.query("SELECT * FROM site_content_settings WHERE id=1");
  return row;
}

async function updateSiteContent(value, userId) {
  await db.query(
    "UPDATE site_content_settings SET hero_kicker=?,hero_title=?,hero_highlight=?,hero_description=?,hero_image_url=?,hours=?,hero_stats=?,address=?,contact_email=?,contact_phone=?,updated_by=? WHERE id=1",
    [value.hero_kicker, value.hero_title, value.hero_highlight, value.hero_description, value.hero_image_url, JSON.stringify(value.hours), JSON.stringify(value.hero_stats), value.address, value.contact_email, value.contact_phone, userId || null]
  );
}

module.exports = { ensureDefaults, getSiteContent, updateSiteContent };
