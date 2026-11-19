/**
 * Data model of public/data/greek/ (written by scripts/build_greek.py) and the pure selection logic:
 * which words a view mode shows and in which order. No DOM, no fetch, so node --test can run it.
 */

/** b = in NA28 and TR, n = only NA28, t = only TR */
export type Edition = "b" | "n" | "t";
export type Mode = "na" | "tr" | "both";

export interface GreekWord {
  g: string; // Greek with punctuation
  s: string; // Strong number(s), joined words "G1473+G2532"
  m: string; // morphology code(s), "P-1NS+CONJ"
  gl: string; // English context gloss
  ed: Edition;
}

type Orders = { na?: Record<string, number[]>; tr?: Record<string, number[]> };

export interface GreekExtra {
  after: number; // Elberfelder verse after which the verse is shown
  ref: string; // TAGNT reference, e.g. "Luk.17.36"
  note: string;
  words: GreekWord[];
  order?: { na?: number[]; tr?: number[] };
}

export interface GreekChapter {
  book: string;
  chapter: number;
  verses: Record<string, GreekWord[]>;
  order?: Orders;
  par?: Record<string, number[]>;
  extra?: GreekExtra[];
}

export const MODES: Mode[] = ["na", "tr", "both"];
export const MODE_LABEL: Record<Mode, string> = { na: "NA28", tr: "TR", both: "Beide" };
export const EDITION_LABEL: Record<Edition, string> = { b: "NA28 und TR", n: "nur NA28", t: "nur TR" };

/**
 * Indices into `words` for a mode. NA and TR use the edition's own word order where the data has one;
 * "both" shows every word in the stored (NA) order.
 */
export function wordIndices(words: GreekWord[], mode: Mode, order?: { na?: number[]; tr?: number[] }): number[] {
  if (mode === "both") return words.map((_, i) => i);
  const own = order?.[mode];
  if (own) return own;
  const keep: Edition = mode === "na" ? "n" : "t";
  return words.flatMap((w, i) => (w.ed === "b" || w.ed === keep ? [i] : []));
}

/** Words of Elberfelder verse v in a mode, plus the TAGNT verses shown after it (e.g. Lk 17,36 TR). */
export function verseView(ch: GreekChapter, v: number, mode: Mode) {
  const key = String(v);
  const words = ch.verses[key] ?? [];
  const order = { na: ch.order?.na?.[key], tr: ch.order?.tr?.[key] };
  const extras = (ch.extra ?? [])
    .filter((e) => e.after === v)
    .map((e) => ({ ...e, indices: wordIndices(e.words, mode, e.order) }))
    .filter((e) => e.indices.length > 0);
  return { words, indices: wordIndices(words, mode, order), extras, exists: key in ch.verses };
}

/** "G1473+G2532" + "P-1NS+CONJ" -> [["G1473", "P-1NS"], ["G2532", "CONJ"]] */
export function parts(w: GreekWord): [string, string][] {
  const s = w.s.split("+");
  const m = w.m.split("+");
  return s.map((x, i) => [x, m[i] ?? ""]);
}

/** "G0746" -> "G746", the number as Strong's concordance prints it; suffix letters stay ("G2424G"). */
export function strongLabel(s: string): string {
  return s.replace(/^G0+(?=\d)/, "G");
}
