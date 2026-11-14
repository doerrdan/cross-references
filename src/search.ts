/**
 * Question search without a language model.
 *
 * 1. analyze(): strip question/filler words, detect scope ("im NT", "bei Paulus", "in den Psalmen"),
 *    quoted phrases, and expand every remaining word into weighted variants:
 *      stem of the word itself (1.0) > curated modern→elb vocabulary (0.85) > typo correction (0.7)
 *      > compound parts (0.6) > OpenThesaurus synonyms (0.4)
 * 2. BM25 per variant; a word ("group") scores with its best variant; groups add up and the sum is
 *    damped by the share of groups a verse covers.
 * 3. Cross-reference spreading: the top hits pass score along their OpenBible references, weighted by
 *    votes. Verses linked from many good hits rise, and verses without the words can surface.
 */
import { NT_START, type Bible, type CrossRefs } from "./data.ts";
import { findBook } from "./refs.ts";
import { normalize, stem, tokenize } from "./stem.ts";
import { STOPWORDS, VOCAB } from "./vocab.ts";

export interface Thesaurus {
  sets: string[][];
  keys: Record<string, number[]>;
}

type Source = "wort" | "bibelwortschatz" | "tippfehler" | "ableitung" | "wortteil" | "synonym";
const WEIGHT: Record<Source, number> = {
  wort: 1, bibelwortschatz: 0.85, tippfehler: 0.7, ableitung: 0.6, wortteil: 0.6, synonym: 0.4,
};
const PREFIXES = ["be", "ge", "ver", "er", "ent", "zer", "un"];
const MAX_DERIVED = 5;
const PROMINENCE = 0.25; // up to +25 % for the most cross-referenced verses
const MAX_SYNONYMS = 6;
const MAX_SYNONYM_DF = 800; // frequent words ("meinen", "stehen") as synonyms only add noise
const STOP_STEMS = new Set([...STOPWORDS].map((w) => stem(w)));

interface Variant {
  stems: string[]; // one stem, or several for a phrase
  weight: number;
  source: Source;
  label: string;
}
export interface Group {
  word: string;
  variants: Variant[];
}
export interface Scope {
  label: string;
  test: (b: number) => boolean;
}
export interface Analysis {
  groups: Group[];
  phrases: string[][]; // quoted phrases (stem sequences) every hit must contain
  wording: string[]; // all words of the question as stems; verses with this exact wording get a bonus
  scope: Scope | null;
  gospelBoost: boolean;
}
export interface Hit {
  i: number;
  score: number;
  lexical: number;
  network: number; // contribution from cross references
  linkedFrom: number[]; // top hits that reference this verse
  stems: Set<string>; // stems to highlight
}
export interface Result {
  analysis: Analysis;
  hits: Hit[]; // contain at least one search word
  related: Hit[]; // found only through cross references
}

const PAULINE = new Set(Array.from({ length: 13 }, (_, k) => 44 + k)); // Röm .. Phlm

const SCOPES: [RegExp, Scope][] = [
  [/\b(?:im\s+)?(?:alten\s+testament|at)\b/i, { label: "Altes Testament", test: (b) => b < NT_START }],
  [/\b(?:im\s+)?(?:neuen\s+testament|nt)\b/i, { label: "Neues Testament", test: (b) => b >= NT_START }],
  [/\b(?:in\s+den\s+|im\s+)?evangeli(?:en|um)\b/i, { label: "Evangelien", test: (b) => b >= 39 && b <= 42 }],
  [/\b(?:bei\s+|von\s+)?paulus\b|\bpaulusbriefe?n?\b/i, { label: "Paulusbriefe", test: (b) => PAULINE.has(b) }],
  [/\b(?:in\s+den\s+)?psalmen\b/i, { label: "Psalmen", test: (b) => b === 18 }],
  [/\b(?:bei\s+den\s+|in\s+den\s+)?propheten\b/i, { label: "Propheten", test: (b) => b >= 22 && b <= 38 }],
  [/\b(?:in\s+den\s+)?(?:büchern\s+mose|fünf\s+büchern|thora|tora|pentateuch)\b/i, { label: "5 Bücher Mose", test: (b) => b <= 4 }],
];

export class SearchEngine {
  private postings = new Map<string, { docs: Int32Array; tf: Uint8Array }>();
  private docStems: string[][];
  private docLen: Float32Array;
  private avgLen: number;
  private n: number;
  private vocabByLength = new Map<number, string[]>();
  private curated = new Map<string, string[][]>();
  private bible: Bible;
  private xrefs: CrossRefs | null = null;
  private thesaurus: Thesaurus | null = null;
  private prominence: Float32Array | null = null;

  constructor(bible: Bible) {
    this.bible = bible;
    this.n = bible.verses.length;
    const cache = new Map<string, string>();
    const st = (w: string) => {
      let s = cache.get(w);
      if (s === undefined) cache.set(w, (s = stem(w)));
      return s;
    };
    const lists = new Map<string, number[]>();
    this.docStems = new Array(this.n);
    this.docLen = new Float32Array(this.n);
    let total = 0;
    bible.verses.forEach((v, i) => {
      const stems = tokenize(v.t).map((t) => st(t.word));
      this.docStems[i] = stems;
      this.docLen[i] = stems.length;
      total += stems.length;
      const tf = new Map<string, number>();
      for (const s of stems) tf.set(s, (tf.get(s) ?? 0) + 1);
      for (const [s, f] of tf) {
        let l = lists.get(s);
        if (!l) lists.set(s, (l = []));
        l.push(i, f);
      }
    });
    this.avgLen = total / this.n;
    for (const [s, l] of lists) {
      const docs = new Int32Array(l.length / 2);
      const tf = new Uint8Array(l.length / 2);
      for (let k = 0; k < docs.length; k++) {
        docs[k] = l[2 * k];
        tf[k] = Math.min(255, l[2 * k + 1]);
      }
      this.postings.set(s, { docs, tf });
      const arr = this.vocabByLength.get(s.length) ?? [];
      arr.push(s);
      this.vocabByLength.set(s.length, arr);
    }
    for (const [k, vals] of Object.entries(VOCAB)) {
      this.curated.set(stem(k), vals.map((v) => v.split(/\s+/).map((w) => stem(w))));
    }
  }

  setCrossRefs(x: CrossRefs) {
    this.xrefs = x;
    // prominence of a verse = log of all votes on its references, scaled to 0..1
    const raw = new Float32Array(this.n);
    x.out.forEach((list, i) => {
      for (const [, , v] of list) raw[i] += v;
    });
    x.incoming.forEach((list, i) => {
      for (const [, v] of list) raw[i] += v;
    });
    let max = 0;
    for (let i = 0; i < this.n; i++) max = Math.max(max, (raw[i] = Math.log1p(raw[i])));
    this.prominence = raw.map((r) => r / max);
  }
  setThesaurus(t: Thesaurus) {
    this.thesaurus = t;
  }

  df(s: string) {
    return this.postings.get(s)?.docs.length ?? 0;
  }

  // ---------- query analysis ----------

  analyze(query: string): Analysis {
    let q = ` ${query.trim()} `;
    let scope: Scope | null = null;
    for (const [re, sc] of SCOPES) {
      if (re.test(q)) {
        scope = sc;
        q = q.replace(re, " ");
        break;
      }
    }
    if (!scope) {
      // "in Jesaja", "bei Johannes", "im Römerbrief"
      const m = /\b(?:in|im|bei)\s+((?:[1-3]\.?\s*)?[A-Za-zÄÖÜäöüß]+?)(?:brief)?\b/i.exec(q);
      if (m) {
        const b = findBook(this.bible.books, m[1], false);
        if (b !== undefined) {
          scope = { label: this.bible.books[b].name, test: (x) => x === b };
          q = q.replace(m[0], " ");
        }
      }
    }
    const gospelBoost = /\bjesus\b.*\b(sagt|spricht|lehrt|redet|predigt|antwortet)\b|\b(sagt|spricht|lehrt|redet)\s+jesus\b/i.test(q);

    const phrases: string[][] = [];
    q = q.replace(/["„“”]([^"„“”]+)["„“”]/g, (_, p: string) => {
      const stems = tokenize(p).map((t) => stem(t.word));
      if (stems.length) phrases.push(stems);
      return " ";
    });

    let words = tokenize(q).map((t) => t.word);
    const wording = words.length >= 3 ? words.map((w) => stem(w)) : [];
    const content = words.filter((w) => !STOPWORDS.has(w) && w.length > 1);
    if (content.length) words = content;
    // "Jesus" in "was sagt Jesus über X" is the speaker, not the topic
    if (gospelBoost && words.length > 1) words = words.filter((w) => w !== "jesus");

    const groups: Group[] = [];
    for (const w of [...new Set(words)]) groups.push(...this.expand(w));
    return { groups, phrases, wording, scope, gospelBoost };
  }

  private expand(word: string): Group[] {
    const s = stem(word);
    const variants: Variant[] = [];
    const add = (stems: string[], source: Source, label: string) => {
      if (stems.length === 1 && !this.df(stems[0])) return;
      if (variants.some((v) => v.stems.join(" ") === stems.join(" "))) return;
      variants.push({ stems, weight: WEIGHT[source], source, label });
    };
    add([s], "wort", word);
    for (const stems of this.curated.get(s) ?? []) add(stems, "bibelwortschatz", stems.join(" "));

    for (const t of this.derived(s)) add([t], "ableitung", t);
    if (!this.df(s)) {
      for (const t of this.typoCandidates(s)) add([t], "tippfehler", t);
      if (!variants.length) {
        const parts = this.splitCompound(normalize(word));
        if (parts) return parts.map((p) => ({ word: p, variants: [{ stems: [p], weight: WEIGHT.wortteil, source: "wortteil" as const, label: p }] }));
      }
    }
    if (this.thesaurus) {
      const syn = new Map<string, number>();
      for (const k of this.thesaurus.keys[s] ?? []) {
        for (const t of this.thesaurus.sets[k]) {
          if (t !== s && !STOP_STEMS.has(t) && this.df(t) <= MAX_SYNONYM_DF) syn.set(t, (syn.get(t) ?? 0) + 1);
        }
      }
      // prefer stems that appear in several of the word's synonym sets, then frequent ones
      const ranked = [...syn].sort((a, b) => b[1] - a[1] || this.df(b[0]) - this.df(a[0])).slice(0, MAX_SYNONYMS);
      for (const [t] of ranked) add([t], "synonym", t);
    }
    return variants.length ? [{ word, variants }] : [{ word, variants: [] }];
  }

  /** "sorg" -> "besorgt", "morgen" -> "morgend": stems with a common prefix or a short extra ending. */
  private derived(s: string): string[] {
    if (s.length < 4) return [];
    const out: string[] = [];
    for (let len = s.length + 1; len <= s.length + 5; len++) {
      for (const t of this.vocabByLength.get(len) ?? []) {
        if (t.startsWith(s) && t.length <= s.length + 3) out.push(t);
        else if (PREFIXES.some((p) => t.startsWith(p) && t.slice(p.length).startsWith(s) && t.length - p.length <= s.length + 2))
          out.push(t);
      }
    }
    return out.sort((a, b) => this.df(b) - this.df(a)).slice(0, MAX_DERIVED);
  }

  /** Stems within edit distance 1 (2 for long words) of a stem that is not in the Bible. */
  private typoCandidates(s: string): string[] {
    if (s.length < 4) return [];
    const maxD = s.length >= 8 ? 2 : 1;
    const out: [string, number][] = [];
    for (let len = s.length - maxD; len <= s.length + maxD; len++) {
      for (const t of this.vocabByLength.get(len) ?? []) {
        const d = editDistance(s, t, maxD);
        if (d <= maxD) out.push([t, d]);
      }
    }
    return out.sort((a, b) => a[1] - b[1] || this.df(b[0]) - this.df(a[0])).slice(0, 3).map(([t]) => t);
  }

  /** "nächstenliebe" -> ["nachst", "lieb"] if both halves occur in the Bible. */
  private splitCompound(w: string): string[] | null {
    let best: string[] | null = null;
    let bestDf = 0;
    for (let k = 3; k <= w.length - 3; k++) {
      for (const left of [w.slice(0, k), w.slice(0, k).replace(/(s|n|en|es)$/, "")]) {
        const a = stem(left);
        const b = stem(w.slice(k));
        const da = this.df(a);
        const db = this.df(b);
        if (da && db && Math.min(da, db) > bestDf) {
          best = [a, b];
          bestDf = Math.min(da, db);
        }
      }
    }
    return best;
  }

  // ---------- scoring ----------

  search(query: string, opts: { minVotes?: number; limit?: number } = {}): Result {
    const analysis = this.analyze(query);
    const limit = opts.limit ?? 60;
    const groups = analysis.groups.filter((g) => g.variants.length);
    const lexical = new Float32Array(this.n);
    const covered = new Uint8Array(this.n);
    const matched: Map<number, Set<string>> = new Map();

    for (const g of groups) {
      const best = new Map<number, number>();
      for (const v of g.variants) {
        const scores = v.stems.length === 1 ? this.bm25(v.stems[0]) : this.phraseScores(v.stems);
        for (const [d, sc] of scores) {
          const x = sc * v.weight;
          if (x > (best.get(d) ?? 0)) best.set(d, x);
          let m = matched.get(d);
          if (!m) matched.set(d, (m = new Set()));
          for (const s of v.stems) m.add(s);
        }
      }
      for (const [d, x] of best) {
        lexical[d] += x;
        covered[d]++;
      }
    }

    const phraseDocs = analysis.phrases.map((p) => this.phraseScores(p));
    for (const [k, pd] of phraseDocs.entries()) {
      for (const [d, sc] of pd) {
        lexical[d] += sc;
        covered[d]++;
        let m = matched.get(d);
        if (!m) matched.set(d, (m = new Set()));
        for (const s of analysis.phrases[k]) m.add(s);
      }
    }
    // verbatim wording ("wer an mich glaubt"): bonus, not a filter
    if (analysis.wording.length) {
      for (const [d, sc] of this.phraseScores(analysis.wording)) lexical[d] += sc + 4;
    }
    const nGroups = groups.length + analysis.phrases.length;
    if (!nGroups) return { analysis, hits: [], related: [] };

    const candidates: number[] = [];
    for (let d = 0; d < this.n; d++) {
      if (!lexical[d]) continue;
      if (phraseDocs.some((pd) => !pd.has(d))) {
        lexical[d] = 0;
        continue;
      }
      if (analysis.scope && !analysis.scope.test(this.bible.verses[d].b)) {
        lexical[d] = 0;
        continue;
      }
      const coverage = covered[d] / nGroups;
      lexical[d] *= coverage * coverage;
      if (groups.length > 1 && covered[d] === nGroups && this.inOrder(d, groups)) lexical[d] *= 1.3;
      if (this.prominence) lexical[d] *= 1 + PROMINENCE * this.prominence[d];
      if (analysis.gospelBoost && this.bible.verses[d].b >= 39 && this.bible.verses[d].b <= 42) lexical[d] *= 1.3;
      candidates.push(d);
    }
    candidates.sort((a, b) => lexical[b] - lexical[a]);

    // cross-reference spreading from the best lexical hits
    const network = new Float32Array(this.n);
    const linkedFrom = new Map<number, number[]>();
    const maxLex = candidates.length ? lexical[candidates[0]] : 0;
    const minVotes = opts.minVotes ?? 1;
    if (this.xrefs && maxLex > 0) {
      for (const src of candidates.slice(0, 40)) {
        const strength = lexical[src] / maxLex;
        if (strength < 0.25) break;
        for (const [to, end, votes] of this.xrefs.out[src]) {
          if (votes < minVotes) continue;
          const w = strength * Math.min(1, Math.log1p(votes) / Math.log1p(50));
          for (let t = to; t <= (end >= 0 ? Math.min(end, to + 5) : to); t++) {
            if (t === src) continue;
            network[t] += w;
            const l = linkedFrom.get(t) ?? [];
            if (l.length < 8) l.push(src);
            linkedFrom.set(t, l);
          }
        }
      }
    }
    let maxNet = 0;
    for (const t of linkedFrom.keys()) maxNet = Math.max(maxNet, network[t]);
    const NET_SHARE = 0.35;
    const netScore = (d: number) => (maxNet ? (network[d] / maxNet) * NET_SHARE * maxLex : 0);

    const hit = (d: number): Hit => ({
      i: d,
      lexical: lexical[d],
      network: netScore(d),
      score: lexical[d] + netScore(d),
      linkedFrom: linkedFrom.get(d) ?? [],
      stems: matched.get(d) ?? new Set(),
    });
    const hits = candidates.slice(0, 400).map(hit).sort((a, b) => b.score - a.score).slice(0, limit);
    const related = [...linkedFrom.keys()]
      .filter((d) => !lexical[d] && (!analysis.scope || analysis.scope.test(this.bible.verses[d].b)))
      .map(hit)
      .filter((h) => h.linkedFrom.length >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { analysis, hits, related };
  }

  /** True if the groups occur in query order within a short window (quoted from memory, roughly). */
  private inOrder(d: number, groups: Group[]): boolean {
    const ds = this.docStems[d];
    const sets = groups.map((g) => new Set(g.variants.filter((v) => v.source !== "synonym").map((v) => v.stems[0])));
    let pos = -1;
    let start = -1;
    for (const set of sets) {
      let k = pos + 1;
      while (k < ds.length && !set.has(ds[k])) k++;
      if (k >= ds.length) return false;
      if (start < 0) start = k;
      pos = k;
    }
    return pos - start <= 2 * groups.length + 2;
  }

  private bm25(s: string): Map<number, number> {
    const out = new Map<number, number>();
    const p = this.postings.get(s);
    if (!p) return out;
    const k1 = 0.9; // verses are short; repeated words should count less than in long documents
    const b = 0.75;
    const idf = Math.log(1 + (this.n - p.docs.length + 0.5) / (p.docs.length + 0.5));
    for (let k = 0; k < p.docs.length; k++) {
      const d = p.docs[k];
      const f = p.tf[k];
      out.set(d, (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.docLen[d]) / this.avgLen)));
    }
    return out;
  }

  /** Verses containing the stems consecutively; scored as the sum of the stems' BM25. */
  private phraseScores(stems: string[]): Map<number, number> {
    const out = new Map<number, number>();
    const first = this.postings.get(stems[0]);
    if (!first) return out;
    const parts = stems.map((s) => this.bm25(s));
    for (const d of first.docs) {
      const ds = this.docStems[d];
      outer: for (let k = 0; k + stems.length <= ds.length; k++) {
        for (let j = 0; j < stems.length; j++) if (ds[k + j] !== stems[j]) continue outer;
        out.set(d, parts.reduce((acc, m) => acc + (m.get(d) ?? 0), 0));
        break;
      }
    }
    return out;
  }

  /** Character ranges of words in verse i whose stem is in `stems`. */
  highlight(i: number, stems: Set<string>): [number, number][] {
    return tokenize(this.bible.verses[i].t)
      .filter((t) => stems.has(stem(t.word)))
      .map((t) => [t.start, t.end]);
  }
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
