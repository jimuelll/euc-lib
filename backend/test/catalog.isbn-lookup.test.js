const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../modules/catalog/catalog.query.service");

test("ISBN lookup falls back to Google Books when Open Library is unavailable", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).startsWith("https://openlibrary.org/")) return { ok: false, status: 503 };
    return {
      ok: true,
      json: async () => ({ items: [{ volumeInfo: {
        title: "Blue Lock, Vol. 1",
        authors: ["Muneyuki Kaneshiro", "Yusuke Nomura"],
        publishedDate: "2022-01-01",
        publisher: "Kodansha",
        pageCount: 208,
        categories: ["Comics & Graphic Novels"],
      } }] }),
    };
  };
  try {
    const metadata = await service.lookupIsbn("1646514823");
    assert.equal(metadata.title, "Blue Lock, Vol. 1");
    assert.equal(metadata.author, "Muneyuki Kaneshiro, Yusuke Nomura");
    assert.equal(metadata.copyright_year, "2022");
    assert.equal(metadata.physical_description, "208 pages");
    assert.deepEqual(metadata.subjects, ["Comics & Graphic Novels"]);
    assert.equal(requests.length, 3);
    assert.match(requests[2], /googleapis\.com\/books\/v1\/volumes\?q=isbn:1646514823/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("ISBN lookup uses Open Library search when its book endpoint has no record", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("/api/books?")) return { ok: false, status: 404 };
    if (String(url).includes("/search.json?")) {
      return { ok: true, json: async () => ({ docs: [{
        title: "Shangri-La Frontier 1",
        author_name: ["Ryosuke Fuji", "Katarina"],
        publish_year: [2022],
        publisher: ["Kodansha Comics"],
        number_of_pages_median: 208,
        subject: ["Manga", "Fantasy"],
      }] }) };
    }
    throw new Error("Google Books should not be requested");
  };
  try {
    const metadata = await service.lookupIsbn("1646514823");
    assert.equal(metadata.title, "Shangri-La Frontier 1");
    assert.equal(metadata.author, "Ryosuke Fuji, Katarina");
    assert.equal(metadata.publisher, "Kodansha Comics");
    assert.deepEqual(metadata.subjects, ["Manga", "Fantasy"]);
    assert.equal(requests.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
