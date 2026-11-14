/**
 * Parses German Bible references: "Joh 3,16", "Johannes 3:16-18", "1. Mose 1", "Ps 23",
 * "1Mo 1,1-2,3", several separated by ";" ("Röm 3,23; 6,23").
 */
import type { Book } from "./data.ts";

export interface Ref {
  b: number;
  c: number;
  v?: number;
  cEnd?: number;
  vEnd?: number;
}

const EXTRA: Record<string, string[]> = {
  Gen: ["genesis", "1mos"], Exod: ["exodus", "2mos"], Lev: ["levitikus", "3mos"], Num: ["numeri", "4mos"],
  Deut: ["deuteronomium", "5mos"], Josh: ["jos"], Judg: ["ri", "richter"], Ruth: ["rut", "rt"],
  "1Sam": ["1sa"], "2Sam": ["2sa"], "1Kgs": ["1kon", "1konige", "1koenige"], "2Kgs": ["2kon", "2konige", "2koenige"],
  "1Chr": ["1chronik"], "2Chr": ["2chronik"], Ezra: ["esra"], Esth: ["ester", "esther"],
  Job: ["hi", "ijob", "job"], Ps: ["psalm", "psa", "psalter"], Prov: ["sprichworter", "spruche", "sprueche"],
  Eccl: ["koh", "kohelet", "prediger"], Song: ["hld", "hoheslied", "hohelied", "hl"], Isa: ["jesaja"],
  Lam: ["klgl", "klagelieder"], Ezek: ["ez", "ezechiel"], Joel: ["joe"], Amos: ["am"], Obad: ["obd", "obadja"],
  Jonah: ["jona"], Mic: ["micha"], Zeph: ["zef", "zefanja"], Zech: ["sach"],
  Matt: ["mat", "matth", "matthaus", "matthaeus"], Mark: ["mar", "mark", "markus"], Luke: ["luk", "lukas"],
  John: ["jh", "johannes", "joh"], Acts: ["apg", "apostelgeschichte", "act"], Rom: ["rom", "roemer"],
  "1Cor": ["1ko"], "2Cor": ["2ko"], "1Thess": ["1thess", "1th"], "2Thess": ["2thess", "2th"], Titus: ["tit"],
  Phlm: ["phlm", "phm", "philemon"], Heb: ["heb", "hebraer", "hebraeer"], Jas: ["jak", "jakobus"],
  "1Pet": ["1pet", "1petrus"], "2Pet": ["2pet", "2petrus"], "1John": ["1joh"], "2John": ["2joh"], "3John": ["3joh"],
  Jude: ["jud", "judas"], Rev: ["off", "offb", "offenbarung", "apk", "apokalypse"],
};

const key = (s: string) =>
  s.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss").replace(/[.\s]/g, "");

let aliasCache: { books: Book[]; map: Map<string, number>; names: [string, number][] } | null = null;

function aliases(books: Book[]) {
  if (aliasCache?.books === books) return aliasCache;
  const map = new Map<string, number>();
  const names: [string, number][] = [];
  books.forEach((bk, i) => {
    for (const a of [bk.abbr, bk.name, bk.osis, ...(EXTRA[bk.osis] ?? [])]) {
      const k = key(a);
      if (!map.has(k)) map.set(k, i);
    }
    names.push([key(bk.name), i]);
  });
  aliasCache = { books, map, names };
  return aliasCache;
}

/** Book index for a name, abbreviation or unique prefix of a German book name. */
export function findBook(books: Book[], name: string, allowPrefix = true): number | undefined {
  const { map, names } = aliases(books);
  const k = key(name);
  if (!k) return undefined;
  const exact = map.get(k);
  if (exact !== undefined) return exact;
  if (!allowPrefix || k.replace(/^\d/, "").length < 3) return undefined;
  const hits = names.filter(([n]) => n.startsWith(k));
  return hits.length === 1 ? hits[0][1] : undefined;
}

const BOOK = String.raw`((?:[1-3]\.?\s*)?[A-Za-zÄÖÜäöüß]+\.?)`;
const ONE = new RegExp(
  String.raw`^${BOOK}?\s*(\d{1,3})(?:\s*[,:]\s*(\d{1,3}))?(?:\s*[-–]\s*(?:(\d{1,3})\s*[,:]\s*)?(\d{1,3}))?$`,
);
const BOOK_ONLY = new RegExp(String.raw`^${BOOK}$`);

/**
 * Parse one or more references. Returns null if the input does not look like a reference.
 * A part without a book name ("6,23" in "Röm 3,23; 6,23") inherits the previous book.
 */
export function parseRefs(books: Book[], input: string): Ref[] | null {
  const parts = input.split(";").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: Ref[] = [];
  let lastBook: number | undefined;
  for (const part of parts) {
    const m = ONE.exec(part);
    if (!m) {
      const bo = BOOK_ONLY.exec(part);
      const b = bo ? findBook(books, bo[1], false) : undefined; // "Klage" must not open Klagelieder
      if (b === undefined || parts.length > 1) return null;
      return [{ b, c: 1 }];
    }
    const [, bookName, c, v, c2, v2] = m;
    const b = bookName ? findBook(books, bookName) : lastBook;
    if (b === undefined) return null;
    lastBook = b;
    const ref: Ref = { b, c: +c };
    if (ref.c < 1 || ref.c > books[b].chapters) return null;
    if (v) ref.v = +v;
    if (v2) {
      if (c2) ref.cEnd = +c2;
      if (ref.v === undefined) {
        // "Ps 23-25": chapter range
        ref.cEnd = +v2;
      } else {
        ref.vEnd = +v2;
      }
    }
    out.push(ref);
  }
  return out;
}
