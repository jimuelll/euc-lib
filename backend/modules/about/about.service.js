const db = require("../../db");

const parseJson = (value, fallback = []) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normaliseRow = (row) => ({
  library_name:  row.library_name,
  established:   row.established ? Number(row.established) : null,
  mission_title: row.mission_title,
  mission_text:  row.mission_text,
  history_title: row.history_title,
  history_text:  row.history_text,
  policies:      parseJson(row.policies,   []),
  facilities:    parseJson(row.facilities, []),
  staff:         parseJson(row.staff,      []),
  spaces:        parseJson(row.spaces,     []),
});

// ── Reads ─────────────────────────────────────────────────────────────────────

const getAboutSettings = async () => {
  const [rows] = await db.query(
    `SELECT library_name, established,
            mission_title, mission_text,
            history_title, history_text,
            policies, facilities, staff, spaces
     FROM about_settings
     WHERE id = 1
     LIMIT 1`
  );
  if (!rows.length) return null;
  return normaliseRow(rows[0]);
};

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Upsert the about_settings row.
 * `updatedBy` is the authenticated admin's user id.
 *
 * Expected shape of `payload`:
 *   library_name, established (int|null),
 *   mission_title, mission_text,
 *   history_title, history_text,
 *   policies   (string[]),
 *   facilities (string[]),
 *   staff      ({ name, role, image_url }[]),   ← updated
 *   spaces     ({ name, description, image_url }[])
 */
const updateAboutSettings = async (payload, updatedBy) => {
  const {
    library_name,
    established,
    mission_title,
    mission_text,
    history_title,
    history_text,
    policies,
    facilities,
    staff,
    spaces,
  } = payload;

  const toJson = (val, fieldName) => {
    if (!Array.isArray(val)) {
      throw Object.assign(
        new Error(`Field "${fieldName}" must be an array`),
        { status: 400 }
      );
    }
    return JSON.stringify(val);
  };

  const policiesJson   = toJson(policies,   "policies");
  const facilitiesJson = toJson(facilities, "facilities");
  const staffJson      = toJson(staff,      "staff");
  const spacesJson     = toJson(spaces,     "spaces");

  await db.query(
    `INSERT INTO about_settings
       (id, library_name, established,
        mission_title, mission_text,
        history_title, history_text,
        policies, facilities, staff, spaces,
        updated_by)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       library_name  = VALUES(library_name),
       established   = VALUES(established),
       mission_title = VALUES(mission_title),
       mission_text  = VALUES(mission_text),
       history_title = VALUES(history_title),
       history_text  = VALUES(history_text),
       policies      = VALUES(policies),
       facilities    = VALUES(facilities),
       staff         = VALUES(staff),
       spaces        = VALUES(spaces),
       updated_by    = VALUES(updated_by)`,
    [
      library_name  ?? "Enverga-Candelaria Library",
      established   ?? null,
      mission_title ?? "Empowering Academic Growth",
      mission_text  ?? null,
      history_title ?? "Our History",
      history_text  ?? null,
      policiesJson,
      facilitiesJson,
      staffJson,
      spacesJson,
      updatedBy ?? null,
    ]
  );

  return getAboutSettings();
};

module.exports = {
  getAboutSettings,
  updateAboutSettings,
};