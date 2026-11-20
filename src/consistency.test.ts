import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// xrefs.json addresses verses by their position in bible.json. If the verse list changes (a verse
// added, removed, split or renumbered) without running scripts/build_xrefs.py, every later reference
// points to the wrong verse. This test catches that.
const read = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const bible = read("bible.json") as { verses: { id: string }[] };
const xrefs = read("xrefs.json") as { verses: number; ids_sha256: string; refs: [number, number, number][][] };

test("cross references were built for this bible.json", () => {
  assert.equal(xrefs.refs.length, bible.verses.length, "Anzahl der Verse");
  assert.equal(xrefs.verses, bible.verses.length);
  const ids = createHash("sha256").update(bible.verses.map((v) => v.id).join("\n")).digest("hex");
  assert.equal(xrefs.ids_sha256, ids, "Versliste geändert: python3 scripts/build_xrefs.py ausführen");
});

test("all cross references point into the bible", () => {
  const n = bible.verses.length;
  const bad = xrefs.refs.flat().filter(([to, end]) => to < 0 || to >= n || end >= n);
  assert.deepEqual(bad, []);
});
