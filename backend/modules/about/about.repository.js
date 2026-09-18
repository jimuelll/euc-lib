const db = require("../../db");

const getAboutSettings = async (conn = db) => {
  const [rows] = await conn.query(
    `SELECT library_name, established,
            mission_title, mission_text,
            history_title, history_text,
            policies, facilities, staff, spaces
     FROM about_settings
     WHERE id = 1
     LIMIT 1`,
  );
  return rows[0] ?? null;
};

const updateAboutSettings = async (payload, updatedBy, conn = db) => {
  await conn.query(
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
      payload.library_name,
      payload.established,
      payload.mission_title,
      payload.mission_text,
      payload.history_title,
      payload.history_text,
      payload.policies,
      payload.facilities,
      payload.staff,
      payload.spaces,
      updatedBy ?? null,
    ],
  );
};

module.exports = { getAboutSettings, updateAboutSettings };
