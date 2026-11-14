import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRefs } from "./refs.ts";

const { books } = JSON.parse(readFileSync(new URL("../public/data/bible.json", import.meta.url), "utf8"));
const p = (s: string) => parseRefs(books, s);

test("single verses and chapters", () => {
  assert.deepEqual(p("Joh 3,16"), [{ b: 42, c: 3, v: 16 }]);
  assert.deepEqual(p("Johannes 3:16"), [{ b: 42, c: 3, v: 16 }]);
  assert.deepEqual(p("1. Mose 1"), [{ b: 0, c: 1 }]);
  assert.deepEqual(p("1Mo 1,1-3"), [{ b: 0, c: 1, v: 1, vEnd: 3 }]);
  assert.deepEqual(p("1. Kor 13"), [{ b: 45, c: 13 }]);
  assert.deepEqual(p("1Kön 18"), [{ b: 10, c: 18 }]);
  assert.deepEqual(p("Offb 21,4"), [{ b: 65, c: 21, v: 4 }]);
  assert.deepEqual(p("Psalm 23"), [{ b: 18, c: 23 }]);
});
test("lists and ranges", () => {
  assert.deepEqual(p("Röm 3,23; 6,23"), [{ b: 44, c: 3, v: 23 }, { b: 44, c: 6, v: 23 }]);
  assert.deepEqual(p("1Mo 1,1-2,3"), [{ b: 0, c: 1, v: 1, cEnd: 2, vEnd: 3 }]);
});
test("questions are not references", () => {
  for (const q of ["Klage", "Liebe", "Jesus", "Was sagt Jesus über Sorgen?", "Gott ist Liebe", "Joh 999"]) {
    assert.equal(p(q), null, q);
  }
});
