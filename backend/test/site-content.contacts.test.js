const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/site-content/site-content.repository");
const service = require("../modules/site-content/site-content.service");
const { validatePublished } = require("../modules/publishing/publishing.validation");

test("site contacts remove only exact seed placeholders and permit blank published contacts", async () => {
  const original = { ...repository };
  let saved;
  try {
    repository.getSiteContent = async defaults => ({ ...defaults, address: "123 University Avenue, Building C, 2nd Floor", contact_email: "library@college.edu", contact_phone: "(555) 123-4567" });
    const clean = await service.get();
    assert.equal(clean.address, ""); assert.equal(clean.contact_email, ""); assert.equal(clean.contact_phone, "");
    assert.doesNotThrow(() => validatePublished("homepage", clean, clean));
    assert.throws(() => validatePublished("homepage", { ...clean, contact_email: "bad" }, clean), /valid contact email/);
    repository.getSiteContent = async defaults => ({ ...defaults, address: "Real campus", contact_email: "staff@example.edu", contact_phone: "1234" });
    const configured = await service.get();
    assert.equal(configured.address, "Real campus"); assert.equal(configured.contact_email, "staff@example.edu"); assert.equal(configured.contact_phone, "1234");
    repository.ensureDefaults = async defaults => { assert.equal(defaults.contact_email, ""); };
    repository.updateSiteContent = async value => { saved = value; };
    await service.update({ ...clean, address: "", contact_email: "", contact_phone: "" });
    assert.equal(saved.address, ""); assert.equal(saved.contact_email, ""); assert.equal(saved.contact_phone, "");
    repository.getSiteContent = async defaults => defaults;
    const defaults = await service.get();
    assert.equal(defaults.address, ""); assert.equal(defaults.contact_email, ""); assert.equal(defaults.contact_phone, "");
  } finally { Object.assign(repository, original); }
});
