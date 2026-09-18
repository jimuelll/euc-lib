const repository = require("./catalog.repository");

const PUBLIC_CATALOGUE_CORE_KEYS = ["id", "title", "author", "isbn", "copies", "material_type", "metadata"];
const OPERATIONAL_BOOK_KEYS = new Set(["title", "author", "isbn", "copies", "book_type_id", "material_type"]);
const MAX_CUSTOM_FIELDS = 15;

const fieldsForMaterial = (schema, materialType) =>
  schema.filter((field) => field.scope === "shared" || field.scope === materialType);

const getSchema = async (options = {}) => repository.getSchema(options);

const upsertSchema = async (fields) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const existingKeys = await repository.findActiveSchemaKeys(conn);
    const incomingKeys = new Set(fields.map((field) => field.key));
    const toArchive = existingKeys.filter((key) => !incomingKeys.has(key));
    await repository.archiveSchemaKeys(toArchive, conn);
    await repository.upsertSchema(fields, conn);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  MAX_CUSTOM_FIELDS,
  OPERATIONAL_BOOK_KEYS,
  PUBLIC_CATALOGUE_CORE_KEYS,
  fieldsForMaterial,
  getSchema,
  upsertSchema,
};
