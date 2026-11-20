import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { baseOf, bucketOf, formKey, summarize, withForm, type Occurrence } from "./concordance-data.ts";

test("base numbers and files", () => {
  assert.equal(baseOf("G2424G"), "G2424");
  assert.equal(baseOf("G0032"), "G0032");
  assert.equal(baseOf("H1234"), null);
  assert.equal(bucketOf("G2316"), "23");
  assert.equal(bucketOf("G0032"), "00");
  assert.equal(bucketOf("G9991"), "99");
});

test("forms are grouped without punctuation and grave accent", () => {
  assert.equal(formKey("θεὸς"), formKey("θεός."));
  assert.notEqual(formKey("θεοῦ"), formKey("θεός"));
});

test("summary groups occurrences by verse and counts editions", () => {
  const occ: Occurrence[] = [
    ["Matt.1.23", "θεός."], ["John.1.1", "θεόν,"], ["John.1.1", "θεὸς"], ["1Tim.3.16", "θεὸς", "t"], ["Acts.1.1", "θεοῦ", "n"],
  ];
  const s = summarize(occ);
  assert.deepEqual(s.verses.map((v) => [v.id, v.forms.length]), [["Matt.1.23", 1], ["John.1.1", 2], ["1Tim.3.16", 1], ["Acts.1.1", 1]]);
  assert.equal(s.total, 5);
  assert.equal(s.na, 4); // all but the TR-only word
  assert.equal(s.tr, 4); // all but the NA-only word
  assert.deepEqual(s.forms[0], [formKey("θεός"), 3]);
  assert.deepEqual(withForm(s.verses, formKey("θεόν")).map((v) => v.id), ["John.1.1"]);
});

const words = new URL("../public/data/greek/words/", import.meta.url);
test("real data: θεός includes the TR reading of 1 Tim 3,16", { skip: !existsSync(new URL("23.json", words)) }, () => {
  const occ = JSON.parse(readFileSync(new URL("23.json", words), "utf8")).G2316 as Occurrence[];
  assert.ok(occ.length > 1300);
  assert.deepEqual(occ.find(([id]) => id === "1Tim.3.16"), ["1Tim.3.16", "θεὸς", "t"]);
});
