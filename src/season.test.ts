import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonOf, offMark, themeOn } from "./season.ts";
import { CATALOG, BY_ID } from "./shop.ts";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

test("seasons change on the right days", () => {
  assert.equal(seasonOf(day(2026, 9, 30)), null);
  assert.equal(seasonOf(day(2026, 10, 1)), "halloween");
  assert.equal(seasonOf(day(2026, 10, 31)), "halloween");
  assert.equal(seasonOf(day(2026, 11, 1)), "christmas");
  assert.equal(seasonOf(day(2026, 12, 31)), "christmas");
  assert.equal(seasonOf(day(2027, 1, 6)), "christmas");
  assert.equal(seasonOf(day(2027, 1, 7)), null);
});

test("a stale saved 'on' can't show Halloween at Christmas or in spring", () => {
  assert.equal(themeOn("halloween", "on", day(2026, 11, 1)), false);
  assert.equal(themeOn("christmas", null, day(2026, 11, 1)), true);
  assert.equal(themeOn("halloween", "on", day(2027, 4, 1)), false);
  assert.equal(themeOn("christmas", "on", day(2027, 4, 1)), false);
});

test("the two themes are never on together", () => {
  for (let i = 0; i < 366; i++) {
    const d = new Date(2026, 0, 1 + i, 12);
    assert.ok(!(themeOn("halloween", "on", d) && themeOn("christmas", "on", d)));
  }
});

test("turning a theme off lasts that season, not next year", () => {
  const dec = day(2026, 12, 20);
  assert.equal(themeOn("christmas", offMark(dec), dec), false);
  assert.equal(themeOn("christmas", offMark(dec), day(2027, 1, 3)), false); // same season, new calendar year
  assert.equal(themeOn("christmas", offMark(dec), day(2027, 11, 1)), true);
  assert.equal(themeOn("halloween", "off", day(2027, 10, 1)), true); // old-style saved value
});

test("seasonal shop: Christmas items exist and Halloween items stayed", () => {
  assert.ok(CATALOG.filter((i) => i.season === "christmas").length >= 15);
  for (const id of ["witch-hat", "pumpkin-suit", "ghost-sheet", "bed-pumpkin", "jack-o-lantern", "bat-garland"]) assert.equal(BY_ID[id]?.season, "halloween");
  assert.equal(BY_ID["santa-hat"]?.season, "christmas");
});
