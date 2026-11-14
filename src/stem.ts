/**
 * German Snowball stemmer (https://snowballstem.org/algorithms/german/stemmer.html)
 * plus the tokenizer shared by the search index, the query parser and the build scripts.
 * Umlauts and ß are folded (ä→a, ß→ss), so "daß"/"dass" and "Füße"/"Fusse" meet.
 */

const VOWELS = "aeiouyäöü";
const isVowel = (c: string) => VOWELS.includes(c);
const S_ENDING = "bdfghklmnrt";
const ST_ENDING = "bdfghklmnt";

function r2From(w: string, r1raw: number): number {
  for (let i = r1raw + 1; i < w.length; i++) if (!isVowel(w[i]) && isVowel(w[i - 1])) return i + 1;
  return w.length;
}

/** Words whose Snowball stem collides with an unrelated word ("vergeblich" -> "vergeb" = "vergeben"). */
const EXCEPTIONS: Record<string, string> = {
  vergeblich: "vergeblich", vergebliche: "vergeblich", vergeblichen: "vergeblich", vergebens: "vergeblich",
};

export function stem(word: string): string {
  let w = word.toLowerCase().replace(/ß/g, "ss");
  const ex = EXCEPTIONS[w];
  if (ex) return ex;
  if (w.length < 3) return fold(w);
  // mark u and y between vowels as consonants
  const chars = [...w];
  for (let i = 1; i < chars.length - 1; i++) {
    if ((chars[i] === "u" || chars[i] === "y") && isVowel(chars[i - 1]) && isVowel(chars[i + 1])) {
      chars[i] = chars[i].toUpperCase();
    }
  }
  w = chars.join("");

  let r1raw = w.length;
  for (let i = 1; i < w.length; i++) if (!isVowel(w[i]) && isVowel(w[i - 1])) { r1raw = i + 1; break; }
  const r2 = r2From(w, r1raw);
  const r1 = Math.min(Math.max(r1raw, 3), w.length);

  const inR1 = (suffix: string) => w.length - suffix.length >= r1;
  const inR2 = (suffix: string) => w.length - suffix.length >= r2;
  const cut = (n: number) => { w = w.slice(0, w.length - n); };

  // step 1
  let m = /(ern|em|er)$/.exec(w);
  if (m) {
    if (inR1(m[1])) cut(m[1].length);
  } else if ((m = /(en|es|e)$/.exec(w))) {
    if (inR1(m[1])) {
      cut(m[1].length);
      if (w.endsWith("niss")) cut(1);
    }
  } else if (w.endsWith("s") && inR1("s") && S_ENDING.includes(w[w.length - 2] ?? "")) {
    cut(1);
  }

  // step 2
  if ((m = /(en|er|est)$/.exec(w))) {
    if (inR1(m[1])) cut(m[1].length);
  } else if (w.endsWith("st") && inR1("st") && w.length >= 6 && ST_ENDING.includes(w[w.length - 3])) {
    cut(2);
  }

  // step 3: d-suffixes
  if ((m = /(end|ung)$/.exec(w)) && inR2(m[1])) {
    cut(m[1].length);
    if (w.endsWith("ig") && inR2("ig") && !w.endsWith("eig")) cut(2);
  } else if ((m = /(ig|ik|isch)$/.exec(w)) && inR2(m[1]) && w[w.length - m[1].length - 1] !== "e") {
    cut(m[1].length);
  } else if ((m = /(lich|heit)$/.exec(w)) && inR2(m[1])) {
    cut(m[1].length);
    const n = /(er|en)$/.exec(w);
    if (n && inR1(n[1])) cut(2);
  } else if (w.endsWith("keit") && inR2("keit")) {
    cut(4);
    const n = /(lich|ig)$/.exec(w);
    if (n && inR2(n[1])) cut(n[1].length);
  }

  return fold(w.toLowerCase());
}

const fold = (w: string) => w.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");

/** Words of a text, lowercased, with their character offsets (for highlighting). */
export function tokenize(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/[\p{L}]+(?:-[\p{L}]+)*/gu)) {
    out.push({ word: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Lowercase, umlaut-folded form used for exact (unstemmed) matching and fuzzy lookup. */
export const normalize = (w: string) => fold(w.toLowerCase().replace(/ß/g, "ss"));
