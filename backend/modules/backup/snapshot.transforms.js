const { createHash } = require("crypto");
const { APPLICATION_TABLES } = require("./snapshot.registry");

const SNAPSHOT_VERSION = 8;
const LEGACY_METADATA_KEYS = Object.freeze([
  "category", "edition", "publication_year", "location", "thesis_program",
  "thesis_adviser", "academic_year", "thesis_abstract", "thesis_keywords", "accession_number",
]);

const pad = (value, length = 2) => String(value).padStart(length, "0");

function isValidCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function invalidDateValue() {
  return Object.assign(new Error("The backup contains an invalid date value."), { status: 400 });
}

function normalizeSqlTemporalValue(value, columnType) {
  const type = String(columnType).toLowerCase();
  const text = String(value).trim();

  // Preserve canonical SQL values as wall-clock values. Parsing a value such
  // as `2026-07-17 00:00:00` with new Date() depends on the server timezone
  // and can both shift it and let malformed values reach MySQL.
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,6})?)?)?$/);
  if (match) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ""] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hasTime = hourText !== undefined;
    const hour = Number(hourText ?? 0);
    const minute = Number(minuteText ?? 0);
    const second = Number(secondText ?? 0);
    if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) throw invalidDateValue();
    const datePart = `${yearText}-${monthText}-${dayText}`;
    if (type === "date") return datePart;
    if (/^year(?:\(|$)/.test(type)) return yearText;
    if (/^(datetime|timestamp)/.test(type)) {
      const timePart = hasTime ? `${pad(hour)}:${pad(minute)}:${pad(second)}${fraction}` : "00:00:00";
      return `${datePart} ${timePart}`;
    }
  }

  if (/^time(?:\(|$)/.test(type)) {
    // MySQL TIME can contain a sign and values beyond 24 hours. Keep only its
    // documented SQL form; ISO timestamps are handled below.
    if (/^-?\d{1,3}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/.test(text)) return text;
    throw invalidDateValue();
  }
  if (/^year(?:\(|$)/.test(type) && /^\d{4}$/.test(text)) return text;

  // Tagged Date objects and uploaded ISO values represent instants, so UTC is
  // the only unambiguous conversion to MySQL's canonical text form.
  if (/T|Z$|[+-]\d{2}:?\d{2}$/.test(text)) return formatDateForMySql(text, type);
  throw invalidDateValue();
}

function formatDateForMySql(isoValue, columnType = "") {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    throw invalidDateValue();
  }

  const type = String(columnType).toLowerCase();
  const datePart = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const timePart = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  if (type === "date") return datePart;
  if (/^time(?:\(|$)/.test(type)) return timePart;
  if (type.startsWith("year")) return String(date.getUTCFullYear());

  const precision = Number(type.match(/\((\d+)\)/)?.[1] ?? 0);
  const fraction = precision > 0
    ? `.${pad(date.getUTCMilliseconds(), 3).padEnd(Math.min(precision, 6), "0").slice(0, Math.min(precision, 6))}`
    : "";
  return `${datePart} ${timePart}${fraction}`;
}

function encodeValue(value) {
  if (Buffer.isBuffer(value)) return { __backupType: "buffer", data: value.toString("base64") };
  if (value instanceof Date) return { __backupType: "date", data: value.toISOString() };
  return value;
}

function decodeValue(value, columnType) {
  if (value && typeof value === "object" && value.__backupType === "buffer") return Buffer.from(value.data, "base64");
  if (value && typeof value === "object" && value.__backupType === "date") return formatDateForMySql(value.data, columnType);
  const normalizedColumnType = String(columnType).toLowerCase();
  // Every temporal value is normalized and validated before MySQL sees it.
  // This covers both Date objects serialized by mysql2 and plain SQL strings
  // carried in an uploaded snapshot.
  if (typeof value === "string" && /^(date|datetime|timestamp|time|year)/.test(normalizedColumnType)) {
    return normalizeSqlTemporalValue(value, normalizedColumnType);
  }
  // JSON values arrive as objects after an uploaded snapshot is parsed by
  // Express. mysql2 must receive JSON text for a JSON column, not an object
  // coerced to "[object Object]".
  if (normalizedColumnType === "json" && value !== null && value !== undefined) {
    if (typeof value === "string") {
      try { JSON.parse(value); return value; }
      catch { throw Object.assign(new Error("The backup contains invalid JSON data."), { status: 400 }); }
    }
    return JSON.stringify(value);
  }
  return value;
}

function schemaFingerprint(tables) {
  return createHash("sha256").update(JSON.stringify(tables)).digest("hex");
}

function payloadChecksum(payload) {
  const { integrity, ...unsigned } = payload;
  return createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
}

function validateBackup(backup) {
  return backup?.format === "euc-library-backup"
    && Number.isInteger(backup.version)
    && backup.tables && typeof backup.tables === "object";
}

function assertSnapshotIntegrity(backup) {
  if (backup.version >= 4 && backup.integrity?.checksum !== payloadChecksum(backup)) {
    throw Object.assign(new Error("The backup integrity check failed."), { status: 400 });
  }
  // v3 is the last legacy format that carried a raw schema fingerprint.
  if (backup.version === 3 && (!backup.schema?.tables || backup.schema.fingerprint !== schemaFingerprint(backup.schema.tables))) {
    throw Object.assign(new Error("The backup schema fingerprint is invalid."), { status: 400 });
  }
}

function upgradeV3ToV4(backup) {
  assertSnapshotIntegrity(backup);
  for (const field of backup.tables.catalog_schema ?? []) field.scope ||= "shared";
  backup.version = 4;
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  return backup;
}

function upgradeV4ToV5(backup) {
  assertSnapshotIntegrity(backup);
  const schemaMetadataKeys = new Set((backup.tables.catalog_schema ?? [])
    .map((field) => String(field?.key ?? ""))
    .filter((key) => key && !["title", "author", "isbn", "copies"].includes(key)));
  const operationalBookColumns = new Set(["id", "title", "material_type", "metadata", "book_type_id", "author", "isbn", "copies", "created_by", "created_at", "updated_at", "deleted_at", "deleted_by"]);
  const snapshotCustomColumns = new Set((backup.schema?.tables?.books?.columns ?? [])
    .map((column) => String(column?.name ?? ""))
    .filter((key) => key && !operationalBookColumns.has(key)));
  for (const field of backup.tables.catalog_schema ?? []) field.scope ||= "shared";
  for (const book of backup.tables.books ?? []) {
    let metadata = decodeValue(book.metadata, "json") || {};
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }
    for (const key of new Set([...LEGACY_METADATA_KEYS, ...schemaMetadataKeys, ...snapshotCustomColumns])) {
      if (Object.prototype.hasOwnProperty.call(book, key)) {
        if (book[key] !== null && book[key] !== "") metadata[key] = book[key];
        delete book[key];
      }
    }
    book.metadata = JSON.stringify(metadata);
    if (book.material_type === "thesis") { book.book_type_id = null; book.copies = 0; }
  }
  for (const table of APPLICATION_TABLES) backup.tables[table] ??= [];
  if (!backup.tables.library_circulation_settings.length) {
    backup.tables.library_circulation_settings.push({ id: 1, overdue_fine_per_hour: 1 });
  }
  backup.tableManifest = Object.keys(backup.tables).sort();
  backup.version = 5;
  delete backup.schema;
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  return backup;
}

function upgradeV5ToV6(backup) {
  assertSnapshotIntegrity(backup);
  // A v5 "ready" reservation did not identify the physical copy it held.
  // Restoring it as ready would promise pickup without protecting inventory,
  // so safely return it to the queue for staff to prepare again.
  for (const reservation of backup.tables.reservations ?? []) {
    if (reservation.status === "ready" && !reservation.reserved_copy_id) {
      reservation.status = "pending";
      reservation.reserved_copy_id = null;
    }
  }
  backup.version = 6;
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  return backup;
}

function upgradeV6ToV7(backup) {
  assertSnapshotIntegrity(backup);
  // v7 introduced the durable actor-aware audit stream. Older snapshots have
  // no equivalent records, but must still restore safely into the new schema.
  for (const table of APPLICATION_TABLES) backup.tables[table] ??= [];
  backup.version = 7;
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  return backup;
}

function upgradeV7ToV8(backup) {
  assertSnapshotIntegrity(backup);
  // Audit history became an append-only system ledger in v8. Existing v7
  // audit rows are intentionally retained in the live database on restore,
  // never replaced by an older snapshot.
  delete backup.tables.audit_events;
  backup.tableManifest = Object.keys(backup.tables).sort();
  backup.version = 8;
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  return backup;
}

// Each supported snapshot version advances through one reviewed transformer.
const SNAPSHOT_TRANSFORMERS = new Map([[3, upgradeV3ToV4], [4, upgradeV4ToV5], [5, upgradeV5ToV6], [6, upgradeV6ToV7], [7, upgradeV7ToV8]]);

function upgradeBackup(backup) {
  if (backup.version > SNAPSHOT_VERSION) {
    throw Object.assign(new Error(`Snapshot version ${backup.version} was created by a newer release and cannot be restored safely.`), { status: 409 });
  }
  while (backup.version !== SNAPSHOT_VERSION) {
    const transformer = SNAPSHOT_TRANSFORMERS.get(backup.version);
    if (!transformer) throw Object.assign(new Error(`Snapshot version ${backup.version} is not supported by this release.`), { status: 409 });
    backup = transformer(backup);
  }
  assertSnapshotIntegrity(backup);
  return backup;
}

module.exports = {
  SNAPSHOT_VERSION,
  encodeValue,
  decodeValue,
  payloadChecksum,
  validateBackup,
  upgradeBackup,
};
