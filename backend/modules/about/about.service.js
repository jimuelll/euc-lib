const repository = require("./about.repository");

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
  library_name: row.library_name,
  established: row.established ? Number(row.established) : null,
  mission_title: row.mission_title,
  mission_text: row.mission_text,
  history_title: row.history_title,
  history_text: row.history_text,
  policies: parseJson(row.policies, []),
  facilities: parseJson(row.facilities, []),
  staff: parseJson(row.staff, []),
  spaces: parseJson(row.spaces, []),
});

const getAboutSettings = async () => {
  const row = await repository.getAboutSettings();
  return row ? normaliseRow(row) : null;
};

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

  const toJson = (value, fieldName) => {
    if (value !== undefined && !Array.isArray(value)) {
      throw Object.assign(new Error(`Field "${fieldName}" must be an array`), { status: 400 });
    }
    return JSON.stringify(Array.isArray(value) ? value : []);
  };

  await repository.updateAboutSettings({
    library_name: library_name ?? "Enverga-Candelaria Library",
    established: established ?? null,
    mission_title: mission_title ?? "Empowering Academic Growth",
    mission_text: mission_text ?? null,
    history_title: history_title ?? "Our History",
    history_text: history_text ?? null,
    policies: toJson(policies, "policies"),
    facilities: toJson(facilities, "facilities"),
    staff: toJson(staff, "staff"),
    spaces: toJson(spaces, "spaces"),
  }, updatedBy);

  return getAboutSettings();
};

module.exports = { getAboutSettings, updateAboutSettings };
