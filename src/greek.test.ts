import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parts, strongLabel, verseView, wordIndices, type GreekChapter, type GreekWord } from "./greek-text.ts";

const w = (g: string, ed: GreekWord["ed"]): GreekWord => ({ g, s: "G0001", m: "CONJ", gl: "", ed });
const words = [w("a", "b"), w("b", "n"), w("c", "t"), w("d", "b")];
const text = (ws: GreekWord[], idx: number[]) => idx.map((i) => ws[i].g).join(" ");

test("modes select words by edition", () => {
  assert.equal(text(words, wordIndices(words, "na")), "a b d");
  assert.equal(text(words, wordIndices(words, "tr")), "a c d");
  assert.equal(text(words, wordIndices(words, "both")), "a b c d");
});

test("an edition's own word order wins", () => {
  assert.equal(text(words, wordIndices(words, "tr", { tr: [3, 0, 2] })), "d a c");
  assert.equal(text(words, wordIndices(words, "na", { tr: [3, 0, 2] })), "a b d");
});

test("verse view with extra verse and missing verse", () => {
  const ch: GreekChapter = {
    book: "Luke", chapter: 17,
    verses: { "35": words, "36": [w("x", "b")] },
    extra: [{ after: 35, ref: "Luk.17.36", note: "nur TR", words: [w("t1", "t"), w("t2", "t")] }],
  };
  assert.equal(verseView(ch, 35, "na").extras.length, 0); // TR-only extra verse is not shown for NA
  assert.equal(text(ch.extra![0].words, verseView(ch, 35, "tr").extras[0].indices), "t1 t2");
  assert.equal(verseView(ch, 37, "na").exists, false);
});

test("joined words and Strong labels", () => {
  assert.deepEqual(parts({ g: "κἀγὼ", s: "G1473+G2532", m: "P-1NS+CONJ", gl: "I also", ed: "b" }),
    [["G1473", "P-1NS"], ["G2532", "CONJ"]]);
  assert.equal(strongLabel("G0746"), "G746");
  assert.equal(strongLabel("G2424G"), "G2424G");
});

// Stichproben an Varianten, die TAGNT selbst markiert (needs npm run greek output)
const dir = new URL("../public/data/greek/", import.meta.url);
const chapter = (p: string) => JSON.parse(readFileSync(new URL(p, dir), "utf8")) as GreekChapter;
const nfc = (s: string) => s.normalize("NFC");
const show = (ch: GreekChapter, v: number, m: "na" | "tr") => {
  const view = verseView(ch, v, m);
  return nfc(text(view.words, view.indices));
};

test("real data: NA28 and TR differ where TAGNT marks variants", { skip: !existsSync(new URL("Matt/2.json", dir)) }, () => {
  const mt2 = chapter("Matt/2.json");
  assert.ok(show(mt2, 3, "tr").startsWith(nfc("Ἀκούσας δὲ Ἡρῴδης ὁ βασιλεὺς ἐταράχθη")));
  assert.ok(show(mt2, 3, "na").startsWith(nfc("Ἀκούσας δὲ ὁ βασιλεὺς Ἡρῴδης ἐταράχθη")));
  assert.equal(show(chapter("Matt/18.json"), 11, "na"), "");
  assert.match(show(chapter("Matt/18.json"), 11, "tr"), new RegExp(nfc("σῶσαι τὸ ἀπολωλός")));
  assert.doesNotMatch(show(chapter("1John/5.json"), 7, "na"), new RegExp(nfc("οὐρανῷ")));
  assert.match(show(chapter("1John/5.json"), 7, "tr"), new RegExp(nfc("ἕν τῷ οὐρανῷ ὁ πατήρ")));
  const tim3 = chapter("1Tim/3.json"); // reading given only as a TAGNT meaning variant
  assert.match(show(tim3, 16, "na"), new RegExp(nfc("μυστήριον, ὃς ἐφανερώθη")));
  assert.match(show(tim3, 16, "tr"), new RegExp(nfc("μυστήριον, θεὸς ἐφανερώθη")));
  const lk17 = chapter("Luke/17.json");
  assert.equal(verseView(lk17, 36, "na").exists, false); // Luther 2017 numbering: 17,35 is followed by 17,37
  assert.match(show(lk17, 37, "na"), new RegExp("^" + nfc("Καὶ ἀποκριθέντες")));
  assert.equal(verseView(lk17, 35, "tr").extras[0].ref, "Luk.17.36");
});

test("real data: Elberfelder renderings (estimated) for John 3,16", { skip: !existsSync(new URL("John/3.json", dir)) }, () => {
  const ch = chapter("John/3.json");
  const de = Object.fromEntries(ch.verses["16"].filter((w) => w.de).map((w) => [nfc(w.g).replace(/[.,]$/, ""), w.de]));
  assert.equal(de[nfc("θεὸς")], "Gott");
  assert.equal(de[nfc("κόσμον")], "Welt");
  assert.equal(de[nfc("υἱὸν")], "Sohn");
  const tr = JSON.parse(readFileSync(new URL("translations.json", dir), "utf8")) as Record<string, [string, number][]>;
  assert.equal(tr.G2316[0][0], "Gott");
  assert.equal(tr.G0026[0][0], "Liebe");
  assert.ok(!tr.G4982.some(([w]) => w === "werden"), "no auxiliary as rendering of a verb");
});
