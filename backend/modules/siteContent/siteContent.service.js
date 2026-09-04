const db = require("../../db");

const defaults = {
  hero_kicker: "Manuel S. Enverga University Foundation — Candelaria Inc.", hero_title: "Enverga-Candelaria", hero_highlight: "Library",
  hero_description: "Digitalized inventory tracking, book reservations, and seamless access to library services — built for academic excellence.", hero_image_url: null,
  hero_stats: [{ value: "12,000+", label: "Volumes" }, { value: "400+", label: "Journals" }, { value: "24/7", label: "Digital Access" }],
  hours: [{ day: "Monday – Friday", time: "7:00 AM – 9:00 PM", open: true }, { day: "Saturday", time: "8:00 AM – 5:00 PM", open: true }, { day: "Sunday", time: "Closed", open: false }],
  address: "123 University Avenue, Building C, 2nd Floor", contact_email: "library@college.edu", contact_phone: "(555) 123-4567",
};
const parseJson = (value, fallback) => { try { return typeof value === "string" ? JSON.parse(value) : (value || fallback); } catch { return fallback; } };
const normalise = (row) => ({ ...defaults, ...row, hours: parseJson(row?.hours, defaults.hours), hero_stats: parseJson(row?.hero_stats, defaults.hero_stats) });
const ensure = () => db.query("INSERT INTO site_content_settings (id,hero_kicker,hero_title,hero_highlight,hero_description,hours,hero_stats,address,contact_email,contact_phone) VALUES (1,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id", [defaults.hero_kicker, defaults.hero_title, defaults.hero_highlight, defaults.hero_description, JSON.stringify(defaults.hours), JSON.stringify(defaults.hero_stats), defaults.address, defaults.contact_email, defaults.contact_phone]);
const get = async () => { await ensure(); const [[row]] = await db.query("SELECT * FROM site_content_settings WHERE id=1"); return normalise(row); };
const update = async (payload, userId) => {
  const value = { ...defaults, ...payload };
  if (!Array.isArray(value.hours) || value.hours.some((h) => !h.day || !h.time)) throw Object.assign(new Error("Each operating-hours row needs a day and time"), { status: 400 });
  if (!Array.isArray(value.hero_stats) || value.hero_stats.length !== 3 || value.hero_stats.some((stat) => !stat.value?.trim() || !stat.label?.trim())) throw Object.assign(new Error("Provide a value and label for all three hero statistics"), { status: 400 });
  if (!value.hero_title?.trim() || !value.hero_highlight?.trim() || !value.address?.trim() || !value.contact_email?.trim()) throw Object.assign(new Error("Complete the required site content fields"), { status: 400 });
  await ensure();
  await db.query("UPDATE site_content_settings SET hero_kicker=?,hero_title=?,hero_highlight=?,hero_description=?,hero_image_url=?,hours=?,hero_stats=?,address=?,contact_email=?,contact_phone=?,updated_by=? WHERE id=1", [value.hero_kicker.trim(),value.hero_title.trim(),value.hero_highlight.trim(),value.hero_description.trim(),value.hero_image_url?.trim() || null,JSON.stringify(value.hours),JSON.stringify(value.hero_stats),value.address.trim(),value.contact_email.trim(),value.contact_phone.trim(),userId || null]);
  return get();
};
module.exports = { get, update };
