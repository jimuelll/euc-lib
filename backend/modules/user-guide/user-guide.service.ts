import repository = require("./user-guide.repository");
import defaults = require("./user-guide.defaults");
import type { GuideContent, GuideModuleRow, GuideStep, GuideTroubleshootingItem } from "./user-guide.types";

interface ServiceError extends Error {
  status?: number;
}

interface DatabaseError extends Error {
  code?: string;
}

type GuideAdminRecord = GuideContent & {
  id: number;
  sort_order: number;
  is_published: boolean;
  has_unpublished_changes: boolean;
  published_at: string | Date | null;
  updated_at: string | Date | null;
};

const createServiceError = (message: string, status: number): ServiceError => Object.assign(new Error(message), { status });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const parseJson = <T>(value: unknown, fallback: T): T => {
  try {
    if (value === null || value === undefined) return fallback;
    return (typeof value === "string" ? JSON.parse(value) : value) as T;
  } catch {
    return fallback;
  }
};

const normalizeContent = (value: unknown = {}): GuideContent => {
  const input = asRecord(value);
  return {
    slug: String(input.slug || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: String(input.title || "").trim(),
    category: String(input.category || "General").trim(),
    summary: String(input.summary || "").trim(),
    overview: String(input.overview || "").trim(),
    target_path: String(input.target_path || "").trim(),
    audience_roles: Array.isArray(input.audience_roles) ? [...new Set(input.audience_roles.map(String))] : [],
    before_you_begin: Array.isArray(input.before_you_begin)
      ? input.before_you_begin.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [],
    steps: Array.isArray(input.steps)
      ? input.steps
        .map((step: unknown): GuideStep => {
          const item = asRecord(step);
          return { title: String(item.title || "").trim(), body: String(item.body || "").trim() };
        })
        .filter((step: GuideStep) => step.title && step.body)
      : [],
    warnings: Array.isArray(input.warnings) ? input.warnings.map((item: unknown) => String(item).trim()).filter(Boolean) : [],
    troubleshooting: Array.isArray(input.troubleshooting)
      ? input.troubleshooting
        .map((troubleshootingItem: unknown): GuideTroubleshootingItem => {
          const item = asRecord(troubleshootingItem);
          return { problem: String(item.problem || "").trim(), solution: String(item.solution || "").trim() };
        })
        .filter((item: GuideTroubleshootingItem) => item.problem && item.solution)
      : [],
    image_url: input.image_url ? String(input.image_url).trim() : null,
    image_public_id: input.image_public_id ? String(input.image_public_id).trim() : null,
  };
};

const validateContent = (content: GuideContent): void => {
  if (!content.title || !content.summary || !content.overview) throw createServiceError("Add a title, summary, and overview.", 400);
  if (!content.slug) throw createServiceError("Add a title that can be used as the guide address.", 400);
  if (!content.steps.length) throw createServiceError("Add at least one complete step.", 400);
  const allowedRoles = new Set(["staff", "admin", "super_admin"]);
  if (!content.audience_roles.length || content.audience_roles.some((role) => !allowedRoles.has(role))) {
    throw createServiceError("Choose at least one valid audience role.", 400);
  }
  if (content.target_path && !content.target_path.startsWith("/admin")) throw createServiceError("The module link must point to an admin page.", 400);
};

const ensureDefaults = (): Promise<void> => repository.ensureDefaults(defaults.map((item) => normalizeContent(item)));

const serializeAdminRow = (row: GuideModuleRow): GuideAdminRecord => {
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

const getRow = async (id: number): Promise<GuideModuleRow> => {
  const row = await repository.getById(id);
  if (!row) throw createServiceError("Guide module not found.", 404);
  return row;
};

const listPublished = async (role: string) => {
  await ensureDefaults();
  const rows = await repository.listPublished();
  return rows
    .map((row) => ({ id: Number(row.id), sort_order: Number(row.sort_order), ...normalizeContent(parseJson(row.published_content, {})) }))
    .filter((item) => item.audience_roles.includes(role));
};

const listForAdmin = async (): Promise<GuideAdminRecord[]> => {
  await ensureDefaults();
  const rows = await repository.listForAdmin();
  return rows.map(serializeAdminRow);
};

const isDuplicateEntry = (error: unknown): boolean => (error as DatabaseError | null)?.code === "ER_DUP_ENTRY";

const createDraft = async (payload: unknown, userId: number): Promise<GuideAdminRecord> => {
  await ensureDefaults();
  const content = normalizeContent(payload);
  validateContent(content);
  const sortOrder = await repository.getNextOrder();
  try {
    const id = await repository.createDraft({ slug: content.slug, sortOrder, content, userId });
    return serializeAdminRow(await getRow(id));
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw createServiceError("Another guide module already uses this title or address.", 409);
    throw error;
  }
};

const updateDraft = async (id: number, payload: unknown, userId: number): Promise<GuideAdminRecord> => {
  await getRow(id);
  const content = normalizeContent(payload);
  validateContent(content);
  try {
    await repository.updateDraft(id, { slug: content.slug, content, userId });
    return serializeAdminRow(await getRow(id));
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw createServiceError("Another guide module already uses this title or address.", 409);
    throw error;
  }
};

const publish = async (id: number, userId: number): Promise<GuideAdminRecord> => {
  const row = await getRow(id);
  const content = normalizeContent(parseJson(row.draft_content, {}));
  validateContent(content);
  await repository.publish(id, userId);
  return serializeAdminRow(await getRow(id));
};

const unpublish = async (id: number, userId: number): Promise<GuideAdminRecord> => {
  await getRow(id);
  await repository.unpublish(id, userId);
  return serializeAdminRow(await getRow(id));
};

const archive = async (id: number, userId: number): Promise<void> => {
  await getRow(id);
  await repository.archive(id, userId);
};

const reorder = async (ids: unknown, userId: number): Promise<void> => {
  if (!Array.isArray(ids) || !ids.length || ids.some((id: unknown) => typeof id !== "number" || !Number.isInteger(id))) {
    throw createServiceError("Provide the complete module order.", 400);
  }
  const orderedIds = ids as number[];
  if (new Set(orderedIds).size !== orderedIds.length) throw createServiceError("The module order contains duplicates.", 400);

  const existing = (await repository.listActiveIds()).sort((a, b) => a - b);
  const requested = [...orderedIds].sort((a, b) => a - b);
  if (existing.length !== requested.length || existing.some((id, index) => id !== requested[index])) {
    throw createServiceError("The module list changed. Refresh and try reordering again.", 409);
  }
  await repository.reorder(orderedIds, userId);
};

export = { listPublished, listForAdmin, createDraft, updateDraft, publish, unpublish, archive, reorder };
