const { validate, createValidationError } = require("../../middlewares/validate");
const { MAX_CUSTOM_FIELDS, getSchema } = require("./catalog.service");

const ADMIN_ROLES = ["admin", "super_admin"];
const CATALOG_ROLES = ["staff", ...ADMIN_ROLES];
const VALID_KEY_REGEX = /^[a-z][a-z0-9_]{1,63}$/;
const VALID_TYPES = ["text", "textarea", "number", "date", "select"];
const BARCODE_REGEX = /^LIB-\d{6}-\d{3}$/;
const MATERIAL_KEYS = new Set(["material_type", "thesis_program", "thesis_adviser", "academic_year", "thesis_abstract", "thesis_keywords", "accession_number"]);

const requireAdminRole = (req, res, next) => {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const requireSuperAdminRole = (req, res, next) => {
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const requireCatalogRole = (req, res, next) => {
  if (!req.user || !CATALOG_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const ensureBookBodyObject = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Request body must be an object");
  }
};

const validateFieldValue = (field, value) => {
  if (value === undefined || value === "") {
    return;
  }

  if (field.type === "number") {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw createValidationError(`Field "${field.key}" must be a valid number`);
    }
    if (field.key === "copies" && (!Number.isInteger(num) || num < 0)) {
      throw createValidationError('Field "copies" must be a whole number greater than or equal to 0');
    }
    if (field.key === "publication_year" && (!Number.isInteger(num) || num < 0 || num > 3000)) {
      throw createValidationError('Field "publication_year" must be a whole number between 0 and 3000');
    }
    return;
  }

  if (field.type === "date") {
    if (Number.isNaN(Date.parse(value))) {
      throw createValidationError(`Field "${field.key}" must be a valid date`);
    }
    return;
  }

  if (field.type === "select") {
    if (typeof value !== "string" || !value.trim()) {
      throw createValidationError(`Field "${field.key}" must be a non-empty string`);
    }
    if (Array.isArray(field.options) && field.options.length && !field.options.includes(value)) {
      throw createValidationError(`Field "${field.key}" must be one of the configured options`);
    }
    return;
  }

  if (typeof value !== "string") {
    throw createValidationError(`Field "${field.key}" must be a string`);
  }
};

const validateBookPayload = async (req, { requireCoreFields = false, requireAtLeastOneField = false } = {}) => {
  ensureBookBodyObject(req.body);

  const schema = await getSchema();
  const schemaByKey = new Map(schema.map((field) => [field.key, field]));
  const payloadKeys = Object.keys(req.body);

  if (requireAtLeastOneField && payloadKeys.length === 0) {
    throw createValidationError("At least one field must be provided");
  }

  for (const key of payloadKeys) {
    const field = schemaByKey.get(key);
    if (!field && !MATERIAL_KEYS.has(key) && key !== "book_type_id") {
      throw createValidationError(`Unknown field "${key}"`);
    }
    if (key === "material_type") { if (!["book", "thesis"].includes(req.body[key])) throw createValidationError("material_type must be book or thesis"); continue; }
    if (key === "book_type_id") { if (!Number.isInteger(Number(req.body[key])) || Number(req.body[key]) < 1) throw createValidationError("Book type is required"); continue; }
    if (MATERIAL_KEYS.has(key)) { if (typeof req.body[key] !== "string") throw createValidationError(`Field "${key}" must be text`); continue; }
    validateFieldValue(field, req.body[key]);
  }

  if (requireCoreFields) {
    for (const key of ["title", "author"]) {
      if (typeof req.body[key] !== "string" || !req.body[key].trim()) {
        throw createValidationError(`Field "${key}" is required`);
      }
    }
    if (!Number.isInteger(Number(req.body.book_type_id)) || Number(req.body.book_type_id) < 1) throw createValidationError("Book type is required");
  }
};

const validateSchemaPayload = validate((req) => {
  const { fields } = req.body;

  if (!Array.isArray(fields)) {
    throw createValidationError("'fields' must be an array");
  }

  const customFields = fields.filter((f) => !f.locked && !f.archived);
  if (customFields.length > MAX_CUSTOM_FIELDS) {
    throw createValidationError(
      `Too many custom fields. Maximum allowed is ${MAX_CUSTOM_FIELDS} (you have ${customFields.length}).`
    );
  }

  const seenKeys = new Set();
  for (const f of fields) {
    if (!f.key || !VALID_KEY_REGEX.test(f.key)) {
      throw createValidationError(
        `Invalid field key "${f.key}". Must be lowercase letters, digits, or underscores (2-64 chars, start with a letter).`
      );
    }
    if (seenKeys.has(f.key)) {
      throw createValidationError(`Duplicate field key "${f.key}"`);
    }
    seenKeys.add(f.key);

    if (!f.label?.trim()) {
      throw createValidationError(`Field "${f.key}" is missing a label`);
    }
    if (!VALID_TYPES.includes(f.type)) {
      throw createValidationError(`Field "${f.key}" has invalid type "${f.type}"`);
    }
    if (f.type === "select" && (!Array.isArray(f.options) || !f.options.length)) {
      throw createValidationError(`Dropdown field "${f.key}" must have at least one option`);
    }
    if (typeof f.order !== "number") {
      throw createValidationError(`Field "${f.key}" is missing a numeric order`);
    }
  }
});

const validateBookId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ message: "Invalid book ID" });
  }
  req.params.id = id;
  next();
};

const validateBarcode = (req, res, next) => {
  if (!BARCODE_REGEX.test(req.params.barcode)) {
    return res.status(400).json({ message: "Invalid barcode format" });
  }
  next();
};

const validateCreateBookPayload = validate(async (req) => {
  await validateBookPayload(req, { requireCoreFields: true });
});

const validateUpdateBookPayload = validate(async (req) => {
  await validateBookPayload(req, { requireAtLeastOneField: true });
});

module.exports = {
  requireAdminRole,
  requireSuperAdminRole,
  requireCatalogRole,
  validateSchemaPayload,
  validateBookId,
  validateBarcode,
  validateCreateBookPayload,
  validateUpdateBookPayload,
};
