const repository = require("./user-guide.repository");
const defaults = require("./user-guide.defaults");

const parseJson = (value, fallback) => {
  try {
    if (value === null || value === undefined) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const normalizeContent = (value = {}) => ({
  slug: String(value.slug || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  title: String(value.title || "").trim(),
  category: String(value.category || "General").trim(),
  summary: String(value.summary || "").trim(),
  overview: String(value.overview || "").trim(),
  target_path: String(value.target_path || "").trim(),
  audience_roles: Array.isArray(value.audience_roles) ? [...new Set(value.audience_roles.map(String))] : [],
  before_you_begin: Array.isArray(value.before_you_begin)
    ? value.before_you_begin.map((item) => String(item).trim()).filter(Boolean)
    : [],
  steps: Array.isArray(value.steps)
    ? value.steps
      .map((step) => ({ title: String(step?.title || "").trim(), body: String(step?.body || "").trim() }))
      .filter((step) => step.title && step.body)
    : [],
  warnings: Array.isArray(value.warnings) ? value.warnings.map((item) => String(item).trim()).filter(Boolean) : [],
  troubleshooting: Array.isArray(value.troubleshooting)
    ? value.troubleshooting
      .map((item) => ({ problem: String(item?.problem || "").trim(), solution: String(item?.solution || "").trim() }))
      .filter((item) => item.problem && item.solution)
    : [],
  image_url: value.image_url ? String(value.image_url).trim() : null,
  image_public_id: value.image_public_id ? String(value.image_public_id).trim() : null,
});

const validateContent = (content) => {
  if (!content.title || !content.summary || !content.overview) {
    throw Object.assign(new Error("Add a title, summary, and overview."), { status: 400 });
  }
  if (!content.slug) {
    throw Object.assign(new Error("Add a title that can be used as the guide address."), { status: 400 });
  }
  if (!content.steps.length) {
    throw Object.assign(new Error("Add at least one complete step."), { status: 400 });
  }
  const allowedRoles = new Set(["staff", "admin", "super_admin"]);
  if (!content.audience_roles.length || content.audience_roles.some((role) => !allowedRoles.has(role))) {
    throw Object.assign(new Error("Choose at least one valid audience role."), { status: 400 });
  }
  if (content.target_path && !content.target_path.startsWith("/admin")) {
    throw Object.assign(new Error("The module link must point to an admin page."), { status: 400 });
  }
};

const ensureDefaults = () => repository.ensureDefaults(defaults.map((item) => normalizeContent(item)));

const serializeAdminRow = (row) => {
  const draft = normalizeContent(parseJson(row.draft_content, {}));
  const published = row.published_content ? normalizeContent(parseJson(row.published_content, {})) : null;
  return {
    id: Number(row.id),
    sort_order: Number(row.sort_order),
    ...draft,
    is_published: Boolean(row.is_published),
    has_unpublished_changes: Boolean(row.is_published) && JSON.stringify(draft) !== JSON.stringify(published),
    published_at: row.published_at,
    updated_at: row.updated_at,
  };
};

const getRow = async (id) => {
  const row = await repository.getById(id);
  if (!row) throw Object.assign(new Error("Guide module not found."), { status: 404 });
  return row;
};

const listPublished = async (role) => {
  await ensureDefaults();
  const rows = await repository.listPublished();
  return rows
    .map((row) => ({ id: Number(row.id), sort_order: Number(row.sort_order), ...normalizeContent(parseJson(row.published_content, {})) }))
    .filter((item) => item.audience_roles.includes(role));
};

const listForAdmin = async () => {
  await ensureDefaults();
  const rows = await repository.listForAdmin();
  return rows.map(serializeAdminRow);
};

const createDraft = async (payload, userId) => {
  await ensureDefaults();
  const content = normalizeContent(payload);
  validateContent(content);
  const sortOrder = await repository.getNextOrder();
  try {
    const id = await repository.createDraft({ slug: content.slug, sortOrder, content, userId });
    return serializeAdminRow(await getRow(id));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("Another guide module already uses this title or address."), { status: 409 });
    }
    throw error;
  }
};

const updateDraft = async (id, payload, userId) => {
  await getRow(id);
  const content = normalizeContent(payload);
  validateContent(content);
  try {
    await repository.updateDraft(id, { slug: content.slug, content, userId });
    return serializeAdminRow(await getRow(id));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("Another guide module already uses this title or address."), { status: 409 });
    }
    throw error;
  }
};

const publish = async (id, userId) => {
  const row = await getRow(id);
  const content = normalizeContent(parseJson(row.draft_content, {}));
  validateContent(content);
  await repository.publish(id, userId);
  return serializeAdminRow(await getRow(id));
};

const unpublish = async (id, userId) => {
  await getRow(id);
  await repository.unpublish(id, userId);
  return serializeAdminRow(await getRow(id));
};

const archive = async (id, userId) => {
  await getRow(id);
  await repository.archive(id, userId);
};

const reorder = async (ids, userId) => {
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => !Number.isInteger(id))) {
    throw Object.assign(new Error("Provide the complete module order."), { status: 400 });
  }
  if (new Set(ids).size !== ids.length) {
    throw Object.assign(new Error("The module order contains duplicates."), { status: 400 });
  }

  const existing = (await repository.listActiveIds()).sort((a, b) => a - b);
  const requested = [...ids].sort((a, b) => a - b);
  if (existing.length !== requested.length || existing.some((id, index) => id !== requested[index])) {
    throw Object.assign(new Error("The module list changed. Refresh and try reordering again."), { status: 409 });
  }
  await repository.reorder(ids, userId);
};

module.exports = { listPublished, listForAdmin, createDraft, updateDraft, publish, unpublish, archive, reorder };
