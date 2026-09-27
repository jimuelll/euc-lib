type RecordValue = Record<string, unknown>;

interface IsbnMetadataLookup {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  copyright_year: string;
  publication_place: string;
  physical_description: string;
  subjects: string[];
  categories: string[];
  description: string;
  descriptionSource: "openlibrary" | "googlebooks" | "hardcover" | null;
  synopsisChecked: boolean;
  synopsisErrors: string[];
  synopsisAttempts: string[];
  language: string;
  pageCount: string | number | null;
  publishedDate: string;
  errors: string[];
  openLibraryResponded: boolean;
  googleBooksResponded: boolean;
  googleBooksStatus: number | null;
  googleBooksRetryAfterMs: number | null;
  googleBooksRateLimited: boolean;
  metadataFound: boolean;
}

interface ProviderLookup<T> {
  record: T | null;
  responded: boolean;
  errors: string[];
  status?: number | null;
  retryAfterMs?: number | null;
  rateLimited?: boolean;
}

interface GoogleBooksLookupOptions {
  retryRateLimit?: boolean;
}

interface IsbnLookupOptions extends GoogleBooksLookupOptions {
  skipGoogleBooks?: boolean;
}

type SynopsisLookupOptions = GoogleBooksLookupOptions;

interface SynopsisLookup {
  description: string;
  source: "openlibrary" | "googlebooks" | "hardcover" | null;
  responded: boolean;
  checked: boolean;
  errors: string[];
  status: number | null;
  retryAfterMs: number | null;
  rateLimited: boolean;
  attempts: string[];
}

let openLibraryQueue = Promise.resolve();
let openLibraryLastRequestAt = 0;

const toRecord = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const textValue = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  const record = toRecord(value);
  return textValue(record.name ?? record.key ?? record.value ?? record.text);
};
const firstText = (...values: unknown[]): string => values.map(textValue).find(Boolean) || "";
const firstValue = (...values: unknown[]): string | number | null => {
  const value = values.find(Boolean);
  return typeof value === "number" || typeof value === "string" ? value : null;
};
const uniqueText = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  return values.map(textValue).filter((value) => {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const namedEntities: Record<string, string> = {
  amp: "&", apos: "'", copy: "©", gt: ">", hellip: "…", ldquo: "“", lsquo: "‘",
  lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"', rdquo: "”", reg: "®",
  rsquo: "’", trade: "™",
};

const decodeEntities = (value: string): string => value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (entity, name: string) => {
  if (name[0] === "#") {
    const hexadecimal = name[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "�";
    return String.fromCodePoint(codePoint);
  }
  return namedEntities[name.toLowerCase()] ?? entity;
});

const cleanDescription = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const plainText = decodeEntities(value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\s*br\b[^>]*\/?>/gi, "\n")
    .replace(/<\s*hr\b[^>]*\/?>/gi, "\n")
    .replace(/<\s*\/?\s*(p|div|li|ul|ol|blockquote|h[1-6]|section|article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ");
  return plainText
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
    .slice(0, 8000)
    .trim();
};

const parseRetryAfter = (value: string | null | undefined): number | null => {
  const retryAfter = String(value || "").trim();
  if (!retryAfter) return null;
  if (/^\d+(?:\.\d+)?$/.test(retryAfter)) return Math.max(0, Math.ceil(Number(retryAfter) * 1000));
  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
};

const fetchJson = async (url: string, headers: Record<string, string> = {}): Promise<unknown> => {
  const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw Object.assign(new Error(`Metadata source failed (${response.status})`), {
      status: response.status,
      retryAfterMs: parseRetryAfter(response.headers?.get?.("Retry-After")),
    });
  }
  try { return await response.json(); }
  catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { responseReceived: true }); }
};

const fetchOpenLibraryJson = (url: string): Promise<unknown> => {
  const request = openLibraryQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - openLibraryLastRequestAt));
    if (waitMs) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    openLibraryLastRequestAt = Date.now();
    const contact = String(process.env.OPEN_LIBRARY_CONTACT_EMAIL || "").replace(/[\r\n()]/g, "").trim();
    const userAgent = `ECULibraryCatalogue/1.0${contact ? ` (${contact})` : ""}`;
    return fetchJson(url, { "User-Agent": userAgent });
  });
  openLibraryQueue = request.then(() => undefined, () => undefined);
  return request;
};

const lookupOpenLibrary = async (isbn: string): Promise<ProviderLookup<RecordValue>> => {
  const errors: string[] = [];
  let responded = false;
  const isbnParam = encodeURIComponent(isbn);

  try {
    const result = toRecord(await fetchOpenLibraryJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbnParam}&format=json&jscmd=data`));
    responded = true;
    const record = toRecord(result[`ISBN:${isbn}`]);
    if (Object.keys(record).length) return { record, responded, errors };
  } catch (error) {
    if ((error as Error & { responseReceived?: boolean })?.responseReceived) responded = true;
    errors.push(`Open Library: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const result = toRecord(await fetchOpenLibraryJson(`https://openlibrary.org/search.json?isbn=${isbnParam}&fields=title,author_name,subject,publisher,language,number_of_pages_median,publish_year,first_publish_year&limit=1`));
    responded = true;
    const record = toRecord(asArray(result.docs)[0]);
    if (Object.keys(record).length) return { record, responded, errors: [] };
  } catch (error) {
    if ((error as Error & { responseReceived?: boolean })?.responseReceived) responded = true;
    errors.push(`Open Library search: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { record: null, responded, errors };
};

const lookupGoogleBooksOnce = async (isbn: string): Promise<ProviderLookup<RecordValue>> => {
  const googleKey = String(process.env.GOOGLE_BOOKS_API_KEY || "").trim();
  const keyParam = googleKey ? `&key=${encodeURIComponent(googleKey)}` : "";
  try {
    const result = toRecord(await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${keyParam}`));
    const item = toRecord(asArray(result.items)[0]);
    const volumeInfo = toRecord(item.volumeInfo);
    return { record: Object.keys(volumeInfo).length ? volumeInfo : null, responded: true, errors: [], status: null, retryAfterMs: null, rateLimited: false };
  } catch (error) {
    return {
      record: null,
      responded: Boolean((error as Error & { responseReceived?: boolean })?.responseReceived),
      errors: [`Google Books: ${error instanceof Error ? error.message : String(error)}`],
      status: typeof (error as Error & { status?: unknown })?.status === "number" ? (error as Error & { status: number }).status : null,
      retryAfterMs: typeof (error as Error & { retryAfterMs?: unknown })?.retryAfterMs === "number" ? (error as Error & { retryAfterMs: number }).retryAfterMs : null,
      rateLimited: typeof (error as Error & { status?: unknown })?.status === "number" && (error as Error & { status: number }).status === 429,
    };
  }
};

const lookupGoogleBooks = async (isbn: string, { retryRateLimit = false }: GoogleBooksLookupOptions = {}): Promise<ProviderLookup<RecordValue>> => {
  const firstAttempt = await lookupGoogleBooksOnce(isbn);
  if (!retryRateLimit || firstAttempt.status !== 429) return firstAttempt;

  const waitMs = firstAttempt.retryAfterMs ?? 2000;
  if (waitMs > 60000) return { ...firstAttempt, rateLimited: true };
  if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));

  const retry = await lookupGoogleBooksOnce(isbn);
  return {
    ...retry,
    rateLimited: retry.status === 429,
    retryAfterMs: retry.status === 429 ? retry.retryAfterMs ?? waitMs : retry.retryAfterMs ?? null,
  };
};

const lookupGoogleBooksSynopsis = async (isbn: string, options: GoogleBooksLookupOptions = {}): Promise<{
  description: string; responded: boolean; errors: string[]; status: number | null; retryAfterMs: number | null; rateLimited: boolean;
}> => {
  const googleBooks = await lookupGoogleBooks(isbn, options);
  return {
    description: cleanDescription(googleBooks.record?.description),
    responded: googleBooks.responded,
    errors: googleBooks.errors,
    status: googleBooks.status ?? null,
    retryAfterMs: googleBooks.retryAfterMs ?? null,
    rateLimited: Boolean(googleBooks.rateLimited),
  };
};

const openLibraryWorkKey = (value: unknown): string => {
  const key = textValue(value);
  const match = key.match(/(?:^|\/)works\/(OL\d+W)(?:$|\/)/i);
  return match ? `/works/${match[1]}` : "";
};

const lookupOpenLibrarySynopsis = async (isbn: string): Promise<{ description: string; responded: boolean; errors: string[]; attempts: string[] }> => {
  const isbnParam = encodeURIComponent(isbn);
  const errors: string[] = [];
  const workKeys: string[] = [];
  const attempts: string[] = [];
  let responded = false;

  try {
    const edition = toRecord(await fetchOpenLibraryJson(`https://openlibrary.org/isbn/${isbnParam}.json`));
    responded = true;
    for (const work of asArray(edition.works)) {
      const key = openLibraryWorkKey(toRecord(work).key);
      if (key && !workKeys.includes(key)) workKeys.push(key);
    }
  } catch (error) {
    const status = (error as Error & { status?: number })?.status;
    if (status === 404) responded = true;
    else errors.push(`Open Library synopsis: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!workKeys.length) {
    try {
      const search = toRecord(await fetchOpenLibraryJson(`https://openlibrary.org/search.json?isbn=${isbnParam}&fields=key&limit=1`));
      responded = true;
      for (const item of asArray(search.docs)) {
        const key = openLibraryWorkKey(toRecord(item).key);
        if (key && !workKeys.includes(key)) workKeys.push(key);
      }
    } catch (error) {
      const status = (error as Error & { status?: number })?.status;
      if (status === 404) responded = true;
      else errors.push(`Open Library synopsis search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const key of workKeys.slice(0, 3)) {
    try {
      const work = toRecord(await fetchOpenLibraryJson(`https://openlibrary.org${key}.json`));
      responded = true;
      const description = cleanDescription(textValue(work.description));
      if (description) {
        attempts.push("Open Library Work: synopsis found");
        return { description, responded, errors, attempts };
      }
    } catch (error) {
      const status = (error as Error & { status?: number })?.status;
      if (status === 404) responded = true;
      else errors.push(`Open Library work synopsis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  attempts.push(errors.length ? "Open Library Work: lookup failed" : "Open Library Work: no synopsis");
  return { description: "", responded, errors, attempts };
};

const lookupHardcoverSynopsis = async (isbn: string): Promise<{ description: string; responded: boolean; errors: string[]; configured: boolean }> => {
  const token = String(process.env.HARDCOVER_API_TOKEN || "").trim();
  if (!token) return { description: "", responded: false, errors: [], configured: false };
  const query = `query SynopsisByIsbn($isbn: String!) {
    editions(where: {_or: [{isbn_10: {_eq: $isbn}}, {isbn_13: {_eq: $isbn}}]}, limit: 1) {
      book { description }
    }
  }`;

  try {
    const response = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { isbn } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { description: "", responded: false, errors: [`Hardcover: Metadata source failed (${response.status})`], configured: true };
    }
    const payload = toRecord(await response.json());
    const graphQLErrors = asArray(payload.errors);
    if (graphQLErrors.length) {
      return { description: "", responded: true, errors: [`Hardcover: ${textValue(toRecord(graphQLErrors[0]).message) || "GraphQL lookup failed"}`], configured: true };
    }
    const data = toRecord(payload.data);
    const edition = toRecord(asArray(data.editions)[0]);
    const book = toRecord(edition.book);
    return { description: cleanDescription(textValue(book.description)), responded: true, errors: [], configured: true };
  } catch (error) {
    return { description: "", responded: false, errors: [`Hardcover: ${error instanceof Error ? error.message : String(error)}`], configured: true };
  }
};

const lookupBookSynopsis = async (isbn: string, options: SynopsisLookupOptions = {}): Promise<SynopsisLookup> => {
  const openLibrary = await lookupOpenLibrarySynopsis(isbn);
  if (openLibrary.description) {
    return { description: openLibrary.description, source: "openlibrary", responded: true, checked: true, errors: openLibrary.errors, status: null, retryAfterMs: null, rateLimited: false, attempts: openLibrary.attempts };
  }

  const googleBooks = await lookupGoogleBooksSynopsis(isbn, options);
  const errors = [...openLibrary.errors, ...googleBooks.errors];
  const attempts = [...openLibrary.attempts, googleBooks.description ? "Google Books: synopsis found" : googleBooks.rateLimited ? "Google Books: rate limited" : googleBooks.errors.length ? "Google Books: lookup failed" : "Google Books: no synopsis"];
  if (googleBooks.description) {
    return { description: googleBooks.description, source: "googlebooks", responded: true, checked: true, errors, status: googleBooks.status, retryAfterMs: googleBooks.retryAfterMs, rateLimited: googleBooks.rateLimited, attempts };
  }

  const hardcover = await lookupHardcoverSynopsis(isbn);
  errors.push(...hardcover.errors);
  attempts.push(hardcover.description ? "Hardcover: synopsis found" : hardcover.configured ? hardcover.errors.length ? "Hardcover: lookup failed" : "Hardcover: no synopsis" : "Hardcover: skipped (HARDCOVER_API_TOKEN is not configured)");
  return {
    description: hardcover.description,
    source: hardcover.description ? "hardcover" : null,
    responded: openLibrary.responded || googleBooks.responded || hardcover.responded,
    checked: Boolean(hardcover.description) || (openLibrary.responded && googleBooks.responded && errors.length === 0 && (!process.env.HARDCOVER_API_TOKEN || hardcover.responded)),
    errors,
    status: googleBooks.status,
    retryAfterMs: googleBooks.retryAfterMs,
    rateLimited: googleBooks.rateLimited,
    attempts,
  };
};

const lookupIsbnMetadata = async (isbn: string, options: IsbnLookupOptions = {}): Promise<IsbnMetadataLookup> => {
  const googleBooksRequest = options.skipGoogleBooks
    ? Promise.resolve<ProviderLookup<RecordValue>>({ record: null, responded: false, errors: [], status: null, retryAfterMs: null, rateLimited: false })
    : lookupGoogleBooks(isbn, options);
  const [openLibrary, googleBooks] = await Promise.all([lookupOpenLibrary(isbn), googleBooksRequest]);
  const open = openLibrary.record || {};
  const google = googleBooks.record || {};
  const openAuthors = asArray(open.authors ?? open.author_name).map(textValue);
  const googleAuthors = asArray(google.authors).map(textValue);
  const openSubjects = asArray(open.subjects ?? open.subject);
  const googleCategories = asArray(google.categories);
  const openPublishers = asArray(open.publishers ?? open.publisher);
  const openPublicationPlaces = asArray(open.publish_places);
  const openLanguages = asArray(open.languages ?? open.language);
  const pageCount = firstValue(open.number_of_pages, open.number_of_pages_median, google.pageCount);
  const publishedDate = firstText(open.publish_date, asArray(open.publish_year)[0], open.first_publish_year, google.publishedDate);
  let openLibraryDescription = cleanDescription(textValue(open.description) || textValue(toRecord(open.details).description));
  let openLibrarySynopsisResponded = openLibrary.responded;
  let synopsisErrors: string[] = [];
  let synopsisAttempts: string[] = [];
  if (!openLibraryDescription) {
    const synopsis = await lookupOpenLibrarySynopsis(isbn);
    openLibraryDescription = synopsis.description;
    openLibrarySynopsisResponded = openLibrarySynopsisResponded || synopsis.responded;
    synopsisErrors = synopsis.errors;
    synopsisAttempts = synopsis.attempts;
  } else {
    synopsisAttempts = ["Open Library: synopsis found"];
  }
  let description = openLibraryDescription;
  let descriptionSource: SynopsisLookup["source"] = description ? "openlibrary" : null;
  if (!description && !options.skipGoogleBooks) {
    description = cleanDescription(google.description);
    synopsisAttempts.push(description ? "Google Books: synopsis found" : googleBooks.rateLimited ? "Google Books: rate limited" : googleBooks.errors.length ? "Google Books: lookup failed" : "Google Books: no synopsis");
    if (description) descriptionSource = "googlebooks";
  } else if (!description && options.skipGoogleBooks) {
    synopsisAttempts.push("Google Books: skipped (previously checked)");
  } else if (description && googleBooks.errors.length) {
    synopsisAttempts.push(googleBooks.rateLimited ? "Google Books metadata lookup: rate limited (synopsis already found in Open Library)" : "Google Books metadata lookup: failed (synopsis already found in Open Library)");
  }
  let hardcoverResponded = false;
  if (!description) {
    const hardcover = await lookupHardcoverSynopsis(isbn);
    description = hardcover.description;
    hardcoverResponded = hardcover.responded;
    synopsisErrors.push(...hardcover.errors);
    synopsisAttempts.push(hardcover.description ? "Hardcover: synopsis found" : hardcover.configured ? hardcover.errors.length ? "Hardcover: lookup failed" : "Hardcover: no synopsis" : "Hardcover: skipped (HARDCOVER_API_TOKEN is not configured)");
    if (description) descriptionSource = "hardcover";
  }
  const synopsisErrorsForBook = uniqueText([...synopsisErrors, ...googleBooks.errors]);
  const synopsisChecked = Boolean(description) || (
    openLibrarySynopsisResponded
    && (googleBooks.responded || Boolean(options.skipGoogleBooks))
    && synopsisErrorsForBook.length === 0
    && (!process.env.HARDCOVER_API_TOKEN || hardcoverResponded || Boolean(descriptionSource))
  );

  return {
    isbn,
    title: firstText(open.title, google.title),
    author: uniqueText(openAuthors.length ? openAuthors : googleAuthors).join(", "),
    publisher: firstText(openPublishers[0], open.publisher, google.publisher),
    copyright_year: publishedDate.match(/\d{4}/)?.[0] || "",
    publication_place: firstText(openPublicationPlaces[0]),
    physical_description: pageCount !== null && Number(pageCount) > 0 ? `${pageCount} pages` : "",
    subjects: uniqueText([...openSubjects, ...googleCategories]),
    categories: uniqueText(googleCategories),
    description,
    descriptionSource,
    synopsisChecked,
    synopsisErrors: synopsisErrorsForBook,
    synopsisAttempts,
    language: firstText(openLanguages[0], open.language, google.language),
    pageCount,
    publishedDate,
    errors: uniqueText([...openLibrary.errors, ...googleBooks.errors, ...synopsisErrors]),
    openLibraryResponded: openLibrary.responded,
    googleBooksResponded: googleBooks.responded,
    googleBooksStatus: googleBooks.status ?? null,
    googleBooksRetryAfterMs: googleBooks.retryAfterMs ?? null,
    googleBooksRateLimited: Boolean(googleBooks.rateLimited),
    metadataFound: Boolean(openLibrary.record || googleBooks.record),
  };
};

export = { lookupIsbnMetadata, lookupGoogleBooksSynopsis, lookupBookSynopsis, cleanDescription };
