/**
 * The catalog has two kinds of data: operational columns and configurable
 * descriptive values.  Never add form-builder keys to SQL queries directly;
 * use these fixed projections when another workflow needs a display value.
 */
const metadataValue = (alias, key, output = key) =>
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.${key}')) AS \`${output}\``;

const catalogDisplayColumns = (alias = "bk", keys = ["category"]) =>
  keys.map((key) => metadataValue(alias, key)).join(", ");

const parseMetadata = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Buffer.isBuffer(value)) return value;
  try { return JSON.parse(value); } catch { return {}; }
};

const capabilities = (materialType) => ({
  canBorrow: materialType === "book",
  canReserve: materialType === "book",
});

const hydrateCatalogRecord = (record, { publicKeys = null, publicFields = null } = {}) => {
  const allMetadata = parseMetadata(record.metadata);
  const keys = publicFields
    ? publicFields
      .filter((field) => (field.scope || "shared") === "shared" || field.scope === record.material_type)
      .map((field) => field.key)
    : publicKeys;
  const metadata = keys
    ? Object.fromEntries(keys.filter((key) => Object.hasOwn(allMetadata, key)).map((key) => [key, allMetadata[key]]))
    : allMetadata;
  const typeCapabilities = capabilities(record.material_type);
  return {
    ...record,
    ...metadata,
    metadata,
    ...typeCapabilities,
    ...(Object.prototype.hasOwnProperty.call(record, "canBorrow") ? { canBorrow: Boolean(record.canBorrow) } : {}),
    ...(Object.prototype.hasOwnProperty.call(record, "canReserve") ? { canReserve: Boolean(record.canReserve) } : {}),
  };
};

module.exports = { metadataValue, catalogDisplayColumns, parseMetadata, capabilities, hydrateCatalogRecord };
