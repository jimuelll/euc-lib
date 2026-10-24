import { describe, expect, it } from "vitest";
import { copyCount } from "./catalogue-copy-count";

describe("copyCount", () => {
  it.each([
    [1, 1, "1 copy"], [0, 1, "0 of 1 copy"], [2, 3, "2 of 3 copies"],
    [1, 2, "1 of 2 copies"], [0, 0, "0 of 0 copies"],
    [1, undefined, "1 copy"], [2, undefined, "2 copies"], [-1, 3, "0 of 3 copies"],
  ])("formats %s available of %s", (available, total, expected) => {
    expect(copyCount(available, total)).toBe(expected);
  });
});
