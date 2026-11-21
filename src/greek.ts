/**
 * Greek text (TAGNT, STEPBible) below an NT verse: mode switch NA28 / TR / Beide and a popover per word
 * with lemma, Strong number, German morphology and gloss. Chapter files are loaded on first use and cached.
 */
import { baseOf, bucketOf, type Occurrence } from "./concordance-data.ts";
import {
  EDITION_LABEL, MODE_LABEL, MODES, parts, strongLabel, verseView,
  type GreekChapter, type GreekWord, type Mode,
} from "./greek-text.ts";

/** l lemma, d German meaning (machine-translated), e English (TBESG), en: d is still English */
type Lexicon = Record<string, { l: string; d: string; e?: string; en?: 1 }>;
type Morph = Record<string, string>;
/** base Strong number -> [[Elberfelder word, count], ...], estimated (scripts/align_de.py) */
type Translations = Record<string, [string, number][]>;

const base = `${import.meta.env.BASE_URL}data/greek/`;
const chapters = new Map<string, Promise<GreekChapter>>();
let shared: Promise<[Lexicon, Morph, Translations]> | null = null;

async function json<T>(file: string): Promise<T> {
  const r = await fetch(base + file);
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

function loadChapter(book: string, c: number) {
  const key = `${book}/${c}`;
  let p = chapters.get(key);
  if (!p) {
    p = json<GreekChapter>(`${key}.json`);
    p.catch(() => chapters.delete(key)); // allow a retry after a network error
    chapters.set(key, p);
  }
  return p;
}

const wordFiles = new Map<string, Promise<Record<string, Occurrence[]>>>();

/** Every occurrence of a Greek word (base Strong number, e.g. "G2316"), from data/greek/words/. */
export async function loadOccurrences(b: string): Promise<Occurrence[]> {
  const file = `words/${bucketOf(b)}.json`;
  let p = wordFiles.get(file);
  if (!p) {
    p = json<Record<string, Occurrence[]>>(file);
    p.catch(() => wordFiles.delete(file));
    wordFiles.set(file, p);
  }
  return (await p)[b] ?? [];
}

/** Lexicon entries of a base number: G0863 -> G0863G, G0863H, G0863I (the senses of ἀφίημι). */
export async function lexiconEntries(b: string) {
  const [lex] = await loadShared();
  return Object.entries(lex)
    .filter(([k]) => baseOf(k) === b)
    .map(([k, v]) => ({ strong: k, ...v }));
}

function loadShared() {
  if (!shared) {
    shared = Promise.all([json<Lexicon>("lexicon.json"), json<Morph>("morph-codes.json"), json<Translations>("translations.json")]);
    shared.catch(() => (shared = null));
  }
  return shared;
}

// ---------- mode ----------

const MODE_KEY = "greekMode";
let mode: Mode = readMode();

function readMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY) as Mode | null;
    return m && MODES.includes(m) ? m : "na";
  } catch {
    return "na";
  }
}

function setMode(m: Mode) {
  mode = m;
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* private mode */
  }
  hidePopover();
  document.querySelectorAll<HTMLElement>(".greek").forEach((el) => renderers.get(el)?.());
}

const renderers = new WeakMap<HTMLElement, () => void>();

// ---------- DOM helpers ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", ...children: (Node | string)[]) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...children);
  return e;
}

// ---------- view ----------

/** Block with the Greek text of an NT verse; `book` is the OSIS id ("John"). */
export function greekBlock(book: string, c: number, v: number, label: string): HTMLElement {
  const block = el("section", "greek");
  block.setAttribute("aria-label", `Griechischer Text zu ${label}`);
  const body = el("div", "greek-body");
  const switcher = el("div", "tabs greek-modes");
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "Textausgabe");
  for (const m of MODES) {
    const b = el("button", "", MODE_LABEL[m]);
    b.type = "button";
    b.dataset.mode = m;
    b.title = m === "na" ? "Nestle-Aland, 28. Auflage" : m === "tr" ? "Textus Receptus (Scrivener 1894)" : "Alle Wörter, Unterschiede markiert";
    b.addEventListener("click", () => setMode(m));
    switcher.append(b);
  }
  block.append(el("div", "greek-head", el("h3", "", "Griechisch"), switcher), body);
  body.append(el("p", "muted greek-status", "Griechischer Text wird geladen …"));

  let data: GreekChapter | null = null;
  const render = () => {
    switcher.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    if (!data) return;
    const view = verseView(data, v, mode);
    const nodes: Node[] = [];
    if (!view.exists) {
      nodes.push(el("p", "muted", "Zu diesem Vers liegt kein griechischer Text vor."));
    } else if (!view.indices.length) {
      const other = mode === "na" ? "nur im TR" : "nur in NA28";
      nodes.push(el("p", "muted greek-status", `Dieser Vers fehlt in ${MODE_LABEL[mode]}; er steht ${other}.`));
    } else {
      nodes.push(line(view.words, view.indices));
    }
    for (const x of view.extras) {
      nodes.push(el("p", "greek-extra-note", x.note), line(x.words, x.indices));
    }
    if (mode === "both" && view.words.some((w) => w.ed !== "b")) {
      nodes.push(el("p", "greek-legend",
        el("span", "gw ed-n", "nur NA28"), " ", el("span", "gw ed-t", "nur TR")));
    }
    body.replaceChildren(...nodes);
  };
  renderers.set(block, render);
  render();

  Promise.all([loadChapter(book, c), loadShared()]).then(
    ([ch]) => {
      data = ch;
      render();
    },
    (err) => body.replaceChildren(el("p", "muted greek-status", `Griechischer Text konnte nicht geladen werden (${String(err)}).`)),
  );
  return block;
}

function line(words: GreekWord[], indices: number[]) {
  const p = el("p", "greek-text");
  p.lang = "grc";
  indices.forEach((i, k) => {
    const w = words[i];
    const b = el("button", `gw${w.ed === "b" ? "" : ` ed-${w.ed}`}`, w.g);
    b.type = "button";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (popoverFor === b && pinned) hidePopover();
      else showPopover(b, w, true);
    });
    b.addEventListener("mouseenter", () => {
      if (hoverable.matches && !pinned) showPopover(b, w, false);
    });
    b.addEventListener("mouseleave", () => {
      if (hoverable.matches && !pinned) hidePopover();
    });
    if (k) p.append(" ");
    p.append(b);
  });
  return p;
}

// ---------- popover ----------

const hoverable = window.matchMedia("(hover: hover) and (pointer: fine)");
let popover: HTMLElement | null = null;
let popoverFor: HTMLElement | null = null;
let pinned = false;

async function showPopover(anchor: HTMLElement, w: GreekWord, pin: boolean) {
  const [lex, morph, translations] = await loadShared();
  if (!popover) {
    popover = el("div", "gpop");
    popover.setAttribute("role", "dialog");
    popover.addEventListener("click", (e) => e.stopPropagation());
    document.body.append(popover);
  }
  popoverFor?.classList.remove("active");
  popoverFor = anchor;
  pinned = pin;
  anchor.classList.add("active");
  const word = el("p", "gpop-word", w.g);
  word.lang = "grc";
  const rows: Node[] = [word];
  // how the Elberfelder renders the word: here, and how often with which word (estimated)
  if (w.de) rows.push(el("p", "gpop-row gpop-here", el("span", "gpop-key", "Hier: "), el("b", "", w.de)));
  const base0 = baseOf(w.s.split("+")[0]);
  const counts = base0 && !w.m.startsWith("T-") ? translations[base0] : undefined; // article: arbitrary, left out
  if (counts?.length) {
    rows.push(el("p", "gpop-row gpop-counts", el("span", "gpop-key", "In der Elberfelder: "),
      counts.map(([d, n]) => `${d} ${n.toLocaleString("de-DE")}×`).join(" · ")),
    el("p", "gpop-est", "automatisch ermittelt"));
  }
  for (const [s, m] of parts(w)) {
    const entry = lex[s];
    const lemma = el("span", "gpop-lemma", entry?.l ?? "–");
    lemma.lang = "grc";
    rows.push(
      el("p", "gpop-head", lemma, " ", el("span", "gpop-strong", strongLabel(s))),
      el("p", "gpop-morph", morph[m] ?? m),
    );
    if (entry?.d) rows.push(el("p", "gpop-row gpop-meaning", entry.d));
    const b = baseOf(s);
    if (b) {
      const link = el("a", "gpop-all", "Alle Stellen von ", Object.assign(el("span", "", entry?.l ?? s), { lang: "grc" }), " →");
      link.href = `#/wort/${b}`;
      link.addEventListener("click", () => hidePopover());
      rows.push(el("p", "gpop-row", link));
    }
  }
  if (w.ed !== "b") rows.push(el("p", `gpop-row gpop-ed ed-${w.ed}`, EDITION_LABEL[w.ed]));
  rows.push(el("p", "gpop-note", "Bedeutung maschinell aus dem Englischen übersetzt (STEP Bible)"));
  popover.replaceChildren(...rows);
  popover.setAttribute("aria-label", `Wortinformation zu ${w.g}`);
  popover.hidden = false;
  place(anchor);
}

function place(anchor: HTMLElement) {
  if (!popover) return;
  const r = anchor.getBoundingClientRect();
  const pw = Math.min(popover.offsetWidth, window.innerWidth - 16);
  const left = Math.min(window.innerWidth - pw - 8, Math.max(8, r.left + r.width / 2 - pw / 2));
  const below = r.bottom + 8 + popover.offsetHeight < window.innerHeight || r.top < popover.offsetHeight + 16;
  popover.style.left = `${left}px`;
  popover.style.top = `${below ? r.bottom + 6 : r.top - popover.offsetHeight - 6}px`;
}

export function hidePopover() {
  if (popover) popover.hidden = true;
  popoverFor?.classList.remove("active");
  popoverFor = null;
  pinned = false;
}

document.addEventListener("click", () => {
  if (popover && !popover.hidden) hidePopover(); // tap outside closes
});
// capture phase: Escape closes only the popover, not also the cross-reference panel (main.ts)
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && popover && !popover.hidden) {
    e.stopImmediatePropagation();
    popoverFor?.focus();
    hidePopover();
  }
}, true);
document.addEventListener("scroll", () => popover && !popover.hidden && popoverFor && place(popoverFor), true);
window.addEventListener("resize", () => popover && !popover.hidden && popoverFor && place(popoverFor));
