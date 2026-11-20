/**
 * Word concordance of the Greek NT (public/data/greek/words/, written by scripts/build_greek.py):
 * every occurrence of a Greek word, keyed by its Strong number without the sense letter
 * (G2424G and G2424I -> G2424). Pure functions, no DOM and no fetch, so node --test can run them.
 */

/** [Elberfelder verse id "1Tim.3.16", Greek form "θεὸς", "n" = only NA28 | "t" = only TR] */
export type Occurrence = [string, string, ("n" | "t")?];

export interface VerseHits {
  id: string;
  forms: { g: string; ed?: "n" | "t" }[];
}

/** "G2424G" / "G2424" -> "G2424"; null for anything that is not a Greek Strong number. */
export function baseOf(strong: string): string | null {
  const m = /^G\d{4}/.exec(strong);
  return m ? m[0] : null;
}

/** File that holds a base number: G2316 -> "23" (words/23.json). */
export function bucketOf(base: string): string {
  return String(Math.floor(Number(base.slice(1)) / 100)).padStart(2, "0");
}

/**
 * Dictionary form of an inflected word for grouping: punctuation removed, grave accent written as acute
 * (θεὸς before another word and θεός at the end are the same form).
 */
export function formKey(g: string): string {
  return g
    .normalize("NFD")
    .replace(/̀/g, "́")
    .replace(/[.,;:··;᾽']/g, "")
    .normalize("NFC");
}

export function summarize(occ: Occurrence[]) {
  const verses: VerseHits[] = [];
  const forms = new Map<string, number>();
  let na = 0;
  let tr = 0;
  for (const [id, g, ed] of occ) {
    const last = verses[verses.length - 1];
    if (last && last.id === id) last.forms.push({ g, ed });
    else verses.push({ id, forms: [{ g, ed }] });
    const k = formKey(g);
    forms.set(k, (forms.get(k) ?? 0) + 1);
    if (ed !== "t") na++;
    if (ed !== "n") tr++;
  }
  const byCount = [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "el"));
  return { verses, forms: byCount, total: occ.length, na, tr };
}

/** Verses that contain the given form (formKey), for the form filter. */
export function withForm(verses: VerseHits[], form: string | null): VerseHits[] {
  return form ? verses.filter((v) => v.forms.some((f) => formKey(f.g) === form)) : verses;
}
