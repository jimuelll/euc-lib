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
    assert.equal(requests.length, 2);
    assert.match(requests[1], /googleapis\.com\/books\/v1\/volumes\?q=isbn:1646514823/);
  } finally {
    global.fetch = originalFetch;
  }
});
