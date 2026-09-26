/**
 * The catalog has two kinds of data: operational columns and configurable
 * descriptive values.  Never add form-builder keys to SQL queries directly;
 * use these fixed projections when another workflow needs a display value.
 */
type Metadata = Record<string, any>;
interface CatalogRecord extends Record<string, any> {
  metadata?: unknown;
  material_type?: string;
}
interface PublicField {
  key: string;
  scope?: string;
}
interface HydrateOptions {
  publicKeys?: string[] | null;
  publicFields?: PublicField[] | null;
}

const metadataValue = (alias: string, key: string, output = key): string =>
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.${key}')) AS \`${output}\``;

const catalogDisplayColumns = (alias = "bk", keys: string[] = ["category"]): string =>
  keys.map((key) => metadataValue(alias, key)).join(", ");

const parseMetadata = (value: unknown): Metadata => {
  if (!value) return {};
  if (typeof value === "object" && !Buffer.isBuffer(value)) return value as Metadata;
  try { return JSON.parse(String(value)); } catch { return {}; }
};

const capabilities = (materialType: string | undefined) => ({
  canBorrow: materialType === "book",
  canReserve: materialType === "book",
});

const hydrateCatalogRecord = (record: CatalogRecord, { publicKeys = null, publicFields = null }: HydrateOptions = {}) => {
  const allMetadata = parseMetadata(record.metadata);
  const keys: string[] | null = publicFields
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

export = { metadataValue, catalogDisplayColumns, parseMetadata, capabilities, hydrateCatalogRecord };
