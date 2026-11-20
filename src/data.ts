export interface Book {
  osis: string;
  abbr: string;
  name: string;
  chapters: number;
}

export interface Verse {
  id: string; // OSIS, e.g. "John.3.16"
  b: number; // book index 0..65
  c: number;
  v: number;
  t: string; // text without notes
  n?: [number, string][]; // [offset in t, note]
}
// Psalm titles are verses (Luther 2017 numbering, scripts/renumber.py), so there is no separate title field.

/** [target verse index, end verse index or -1, votes] */
export type XRef = [number, number, number];

export interface Bible {
  books: Book[];
  verses: Verse[];
  /** verse index by "b.c.v" */
  index: Map<string, number>;
  /** first verse index of each chapter, by "b.c" */
  chapterStart: Map<string, number>;
}

export interface CrossRefs {
  source: string;
  out: XRef[][];
  /** incoming references: [source verse index, votes] */
  incoming: [number, number][][];
}

export const NT_START = 39; // Matthäus

const url = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

export async function loadBible(): Promise<Bible> {
  const raw = (await (await fetch(url("bible.json"))).json()) as { books: Book[]; verses: Verse[] };
  const index = new Map<string, number>();
  const chapterStart = new Map<string, number>();
  raw.verses.forEach((v, i) => {
    index.set(`${v.b}.${v.c}.${v.v}`, i);
    const ck = `${v.b}.${v.c}`;
    if (!chapterStart.has(ck)) chapterStart.set(ck, i);
  });
  return { ...raw, index, chapterStart };
}

export async function loadCrossRefs(verseCount: number): Promise<CrossRefs> {
  const raw = (await (await fetch(url("xrefs.json"))).json()) as { source: string; verses?: number; refs: XRef[][] };
  if (raw.refs.length !== verseCount) {
    // the refs address verses by position; a different verse list would show wrong references
    throw new Error(`xrefs.json passt nicht zu bible.json (${raw.refs.length} statt ${verseCount} Verse); build_xrefs.py neu ausführen`);
  }
  const incoming: [number, number][][] = Array.from({ length: verseCount }, () => []);
  raw.refs.forEach((list, from) => {
    for (const [to, , votes] of list) incoming[to].push([from, votes]);
  });
  for (const l of incoming) l.sort((a, b) => b[1] - a[1]);
  return { source: raw.source, out: raw.refs, incoming };
}

export function chapterVerses(bible: Bible, b: number, c: number): number[] {
  const start = bible.chapterStart.get(`${b}.${c}`);
  if (start === undefined) return [];
  const out: number[] = [];
  for (let i = start; i < bible.verses.length && bible.verses[i].b === b && bible.verses[i].c === c; i++) out.push(i);
  return out;
}

export function refLabel(bible: Bible, i: number, end = -1, short = true): string {
  const v = bible.verses[i];
  const book = short ? bible.books[v.b].abbr : bible.books[v.b].name;
  let s = `${book} ${v.c},${v.v}`;
  if (end >= 0 && end !== i) {
    const e = bible.verses[end];
    s += e.c === v.c && e.b === v.b ? `–${e.v}` : `–${e.c},${e.v}`;
  }
  return s;
}
