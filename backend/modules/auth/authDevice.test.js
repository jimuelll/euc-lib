const assert = require("assert");
const { getDeviceType, normalizeDeviceType } = require("./authDevice");

assert.strictEqual(getDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit"), "mobile");
assert.strictEqual(getDeviceType("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile"), "mobile");
assert.strictEqual(getDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit"), "tablet");
assert.strictEqual(getDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit"), "desktop");
assert.strictEqual(getDeviceType(), "unknown");
assert.strictEqual(normalizeDeviceType("mobile"), "mobile");
assert.strictEqual(normalizeDeviceType("watch"), "unknown");
