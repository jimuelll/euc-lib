const test = require("node:test");
const assert = require("node:assert/strict");
const { validateBookTypeInput, validateIsbn } = require("./catalog.validation");

test("normalizes ISBN-10 input", () => assert.equal(validateIsbn("0-306-40615-2"), "0306406152"));
test("rejects invalid ISBN", () => assert.throws(() => validateIsbn("invalid"), { status: 400 }));
test("validates book type policy values", () => assert.deepEqual(validateBookTypeInput({ name: "Regular", defaultBorrowDays: "7", finePerHour: "2.5" }), { name: "Regular", days: 7, fine: 2.5, fineInterval: "hour", initial: 0 }));
