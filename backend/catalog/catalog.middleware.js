const ALLOWED_ROLES   = ["admin", "super_admin"];
const VALID_KEY_REGEX = /^[a-z][a-z0-9_]{1,63}$/;
const VALID_TYPES     = ["text", "textarea", "number", "date", "select"];

const requireAdminRole = (req, res, next) => {
  if (!req.user || !ALLOWED_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const validateSchemaPayload = (req, res, next) => {
  const { fields } = req.body;

  if (!Array.isArray(fields)) {
    return res.status(400).json({ message: "'fields' must be an array" });
  }

  for (const f of fields) {
    if (!f.key || !VALID_KEY_REGEX.test(f.key)) {
      return res.status(400).json({
        message: `Invalid field key "${f.key}". Must be lowercase letters, digits, or underscores (2–64 chars, start with a letter).`,
      });
    }
    if (!f.label?.trim()) {
      return res.status(400).json({ message: `Field "${f.key}" is missing a label` });
    }
    if (!VALID_TYPES.includes(f.type)) {
      return res.status(400).json({
        message: `Field "${f.key}" has invalid type "${f.type}"`,
      });
    }
    if (f.type === "select" && (!Array.isArray(f.options) || !f.options.length)) {
      return res.status(400).json({
        message: `Dropdown field "${f.key}" must have at least one option`,
      });
    }
    if (typeof f.order !== "number") {
      return res.status(400).json({ message: `Field "${f.key}" is missing a numeric order` });
    }
    // public is optional boolean — no strict validation needed, coerced to 0/1 in service
  }

  next();
};

const validateBookId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ message: "Invalid book ID" });
  }
  req.params.id = id;
  next();
};

module.exports = { requireAdminRole, validateSchemaPayload, validateBookId };