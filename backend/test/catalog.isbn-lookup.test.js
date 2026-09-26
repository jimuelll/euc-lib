const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../modules/catalog/catalog.query.service");
const isbnMetadataLookup = require("../modules/catalog/isbn-metadata.lookup");

const response = (payload) => ({ ok: true, json: async () => payload });
const unavailable = (status = 503) => ({ ok: false, status });

test("ISBN lookup queries both providers and uses Google Books for the cleaned synopsis", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).startsWith("https://openlibrary.org/api/books?")) {
      return response({ "ISBN:1646514823": {
        title: "Open Library title",
        authors: [{ name: "Open Library Author" }],
        publish_date: "2019",
        publishers: [{ name: "Open Library Press" }],
        publish_places: [{ name: "New York" }],
        number_of_pages: 310,
        subjects: [{ name: "Graphic novels" }],
      } });
    }
    if (String(url).startsWith("https://www.googleapis.com/books/v1/volumes?")) {
      return response({ items: [{ volumeInfo: {
        title: "Google Books title",
        authors: ["Google Books Author"],
        publishedDate: "2022-01-01",
        publisher: "Google Press",
        pageCount: 208,
        categories: ["Comics & Graphic Novels", "Biography"],
        description: "<p>A &amp; useful <b>synopsis</b>.</p><p>Second line.</p><script>ignore this</script>",
      } }] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const metadata = await service.lookupIsbn("1646514823");
    assert.equal(metadata.title, "Open Library title");
    assert.equal(metadata.author, "Open Library Author");
    assert.equal(metadata.publisher, "Open Library Press");
    assert.equal(metadata.copyright_year, "2019");
    assert.equal(metadata.publication_place, "New York");
    assert.equal(metadata.physical_description, "310 pages");
    assert.deepEqual(metadata.subjects, ["Graphic novels", "Comics & Graphic Novels", "Biography"]);
    assert.equal(metadata.description, "A & useful synopsis.\n\nSecond line.");
    assert.equal(requests.length, 2);
    assert.ok(requests.some(({ url }) => url.startsWith("https://openlibrary.org/api/books?")));
    assert.ok(requests.some(({ url }) => url.startsWith("https://www.googleapis.com/books/v1/volumes?q=isbn:1646514823")));
  } finally {
    global.fetch = originalFetch;
  }
});

test("ISBN lookup merges Google Books fields when Open Library search has gaps", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes("/api/books?")) return response({});
    if (String(url).includes("/search.json?")) {
      return response({ docs: [{
        title: "Open Library search title",
        author_name: ["Open Library search author"],
        publisher: ["Open Library search press"],
        number_of_pages_median: 220,
        publish_year: [2020],
        subject: ["History"],
      }] });
    }
    if (String(url).startsWith("https://www.googleapis.com/books/v1/volumes?")) {
      return response({ items: [{ volumeInfo: {
        title: "Google title", authors: ["Google author"], publisher: "Google press",
        publishedDate: "2021", pageCount: 240, categories: ["History", "Biography"],
        description: "A synopsis.",
      } }] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const metadata = await service.lookupIsbn("1646514823");
    assert.equal(metadata.title, "Open Library search title");
    assert.equal(metadata.author, "Open Library search author");
    assert.equal(metadata.publisher, "Open Library search press");
    assert.equal(metadata.copyright_year, "2020");
    assert.equal(metadata.physical_description, "220 pages");
    assert.deepEqual(metadata.subjects, ["History", "Biography"]);
    assert.equal(metadata.description, "A synopsis.");
  } finally {
    global.fetch = originalFetch;
  }
});

test("ISBN lookup keeps Open Library details when Google Books is unavailable", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).startsWith("https://openlibrary.org/api/books?")) {
      return response({ "ISBN:1646514823": {
        title: "Open Library only",
        authors: [{ name: "A. Writer" }],
        publishers: [{ name: "Library Press" }],
      } });
    }
    if (String(url).startsWith("https://www.googleapis.com/books/v1/volumes?")) return unavailable();
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const metadata = await service.lookupIsbn("1646514823");
    assert.equal(metadata.title, "Open Library only");
    assert.equal(metadata.author, "A. Writer");
    assert.equal(metadata.publisher, "Library Press");
    assert.equal(Object.hasOwn(metadata, "description"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Google Books remains a fallback when Open Library is unavailable", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).startsWith("https://openlibrary.org/")) return unavailable();
    return response({ items: [{ volumeInfo: {
      title: "Blue Lock, Vol. 1",
      authors: ["Muneyuki Kaneshiro", "Yusuke Nomura"],
      publishedDate: "2022-01-01",
      publisher: "Kodansha",
      pageCount: 208,
      categories: ["Comics & Graphic Novels"],
      description: "A football manga.",
    } }] });
  };
  try {
    const metadata = await service.lookupIsbn("1646514823");
    assert.equal(metadata.title, "Blue Lock, Vol. 1");
    assert.equal(metadata.author, "Muneyuki Kaneshiro, Yusuke Nomura");
    assert.equal(metadata.copyright_year, "2022");
    assert.equal(metadata.physical_description, "208 pages");
    assert.deepEqual(metadata.subjects, ["Comics & Graphic Novels"]);
    assert.equal(metadata.description, "A football manga.");
    assert.equal(requests.length, 3);
    assert.ok(requests.some((url) => url.includes("/search.json?")));
    assert.ok(requests.some((url) => url.startsWith("https://www.googleapis.com/books/v1/volumes?q=isbn:1646514823")));
  } finally {
    global.fetch = originalFetch;
  }
});

test("ISBN lookup keeps its unavailable error when both providers fail", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => unavailable();
  try {
    await assert.rejects(service.lookupIsbn("1646514823"), (error) => error.status === 503 && error.message === "ISBN lookup is unavailable right now");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Google Books synopsis cleaning removes markup, decodes entities, and caps its length", () => {
  const clean = isbnMetadataLookup.cleanDescription("<p>One&nbsp;&amp; two<br>three</p><script>unsafe()</script><div> <i>Four</i> </div>");
  assert.equal(clean, "One & two\nthree\n\nFour");
  assert.doesNotMatch(clean, /<|>|unsafe/);
  assert.equal(isbnMetadataLookup.cleanDescription("x".repeat(8002)).length, 8000);
});
