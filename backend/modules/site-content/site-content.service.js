const repository = require("./site-content.repository");

const defaults = {
  hero_kicker: "Manuel S. Enverga University Foundation — Candelaria Inc.", hero_title: "Enverga-Candelaria", hero_highlight: "Library",
  hero_description: "Digitalized inventory tracking, book reservations, and seamless access to library services — built for academic excellence.", hero_image_url: null,
  hero_stats: [{ value: "12,000+", label: "Volumes" }, { value: "400+", label: "Journals" }, { value: "24/7", label: "Digital Access" }],
  hours: [{ day: "Monday – Friday", time: "7:00 AM – 9:00 PM", open: true }, { day: "Saturday", time: "8:00 AM – 5:00 PM", open: true }, { day: "Sunday", time: "Closed", open: false }],
  address: "123 University Avenue, Building C, 2nd Floor", contact_email: "library@college.edu", contact_phone: "(555) 123-4567",
};
const parseJson = (value, fallback) => { try { return typeof value === "string" ? JSON.parse(value) : (value || fallback); } catch { return fallback; } };
const normalise = (row) => ({ ...defaults, ...row, hours: parseJson(row?.hours, defaults.hours), hero_stats: parseJson(row?.hero_stats, defaults.hero_stats) });
const ensure = () => repository.ensureDefaults(defaults);
const get = async () => normalise(await repository.getSiteContent(defaults));
const update = async (payload, userId) => {
  const value = { ...defaults, ...payload };
  if (!Array.isArray(value.hours) || value.hours.some((h) => !h.day || !h.time)) throw Object.assign(new Error("Each operating-hours row needs a day and time"), { status: 400 });
  if (!Array.isArray(value.hero_stats) || value.hero_stats.length !== 3 || value.hero_stats.some((stat) => !stat.value?.trim() || !stat.label?.trim())) throw Object.assign(new Error("Provide a value and label for all three hero statistics"), { status: 400 });
  if (!value.hero_title?.trim() || !value.hero_highlight?.trim() || !value.address?.trim() || !value.contact_email?.trim()) throw Object.assign(new Error("Complete the required site content fields"), { status: 400 });
  await ensure();
  await repository.updateSiteContent({ ...value, hero_kicker: value.hero_kicker?.trim() || "", hero_title: value.hero_title.trim(), hero_highlight: value.hero_highlight.trim(), hero_description: value.hero_description?.trim() || "", hero_image_url: value.hero_image_url?.trim() || null, address: value.address.trim(), contact_email: value.contact_email.trim(), contact_phone: value.contact_phone?.trim() || "" }, userId);
  return get();
};
module.exports = { get, update };
