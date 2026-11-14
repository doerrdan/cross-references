import "./style.css";
import { canonStrip } from "./canon.ts";
import {
  chapterVerses, loadBible, loadCrossRefs, NT_START, refLabel,
  type Bible, type CrossRefs,
} from "./data.ts";
import { parseRefs, type Ref } from "./refs.ts";
import { SearchEngine, type Hit, type Result, type Thesaurus } from "./search.ts";

// ---------- state ----------

let bible: Bible;
let xrefs: CrossRefs | null = null;
let engine: SearchEngine;
let selected = -1;
let direction: "out" | "in" = "out";
let minVotes = loadNumber("minVotes", 3);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const main = $<HTMLElement>("main");
const panel = $<HTMLElement>("panel");
const input = $<HTMLInputElement>("q");

function loadNumber(key: string, fallback: number) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : fallback;
  } catch {
    return fallback;
  }
}
function saveNumber(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* private mode */
  }
}

/** Tiny element helper: h("p", {class: "x"}, "text", child) */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | EventListener> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") e.addEventListener(k.replace(/^on/, ""), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false) e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

// ---------- routing ----------
// #/                      start page
// #/John.3                chapter
// #/John.3.16             chapter with verse selected
// #/suche/<query>         search

const verseHash = (i: number) => {
  const v = bible.verses[i];
  return `#/${bible.books[v.b].osis}.${v.c}.${v.v}`;
};
const chapterHash = (b: number, c: number) => `#/${bible.books[b].osis}.${c}`;
const searchHash = (q: string) => `#/suche/${encodeURIComponent(q)}`;

function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  if (hash.startsWith("suche/")) {
    const q = hash.slice(6);
    input.value = q;
    runSearch(q);
    return;
  }
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/.exec(hash);
  const b = m ? bible.books.findIndex((bk) => bk.osis === m[1]) : -1;
  if (m && b >= 0) {
    const c = Math.min(+m[2], bible.books[b].chapters);
    const vi = m[3] ? bible.index.get(`${b}.${c}.${+m[3]}`) : undefined;
    showChapter(b, c, vi);
    if (vi !== undefined) select(vi, false);
    else closePanel();
    return;
  }
  input.value = "";
  showHome();
}

function go(hash: string) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ---------- views ----------

function showHome() {
  document.title = "Querverweise der Elberfelder";
  closePanel();
  const examples = [
    "Was sagt Jesus über Sorgen?", "Vergebung bei Paulus", "Trost in Trauer",
    "der Herr ist mein Hirte", "Gemeinde im NT", "Jes 53", "Röm 8,28-39",
  ];
  main.replaceChildren(
    h("section", { class: "home" },
      h("h1", {}, "Jeder Vers mit seinen Querverweisen"),
      h("p", { class: "lede" },
        "Die Elberfelder Übersetzung mit rund 340 000 Querverweisen aus OpenBible.info, ",
        "sortiert nach Stimmen. Gib eine Bibelstelle ein oder stelle eine Frage in eigenen Worten."),
      h("ul", { class: "examples", "aria-label": "Beispiele" },
        ...examples.map((q) => h("li", {}, h("a", { href: searchHash(q) }, q)))),
      bookIndex(),
    ),
  );
}

function bookIndex(onPick?: () => void) {
  const group = (title: string, from: number, to: number) =>
    h("div", { class: "book-group" },
      h("h2", {}, title),
      h("ol", {},
        ...bible.books.slice(from, to).map((bk, k) =>
          h("li", {}, h("a", { href: chapterHash(from + k, 1), onclick: () => onPick?.() }, bk.name)))));
  return h("div", { class: "book-index" },
    group("Altes Testament", 0, NT_START), group("Neues Testament", NT_START, bible.books.length));
}

function showChapter(b: number, c: number, focus?: number) {
  const bk = bible.books[b];
  document.title = `${bk.name} ${c} | Elberfelder`;
  const ids = chapterVerses(bible, b, c);
  const prev = c > 1 ? chapterHash(b, c - 1) : b > 0 ? chapterHash(b - 1, bible.books[b - 1].chapters) : null;
  const next = c < bk.chapters ? chapterHash(b, c + 1) : b < bible.books.length - 1 ? chapterHash(b + 1, 1) : null;

  const already = main.dataset.chapter === `${b}.${c}`;
  if (!already) {
    main.dataset.chapter = `${b}.${c}`;
    main.replaceChildren(
      h("article", { class: "chapter" },
        h("header", { class: "chapter-head" },
          h("h1", {}, `${bk.name} `, h("span", { class: "chapter-no" }, String(c))),
          chapterPicker(b, c)),
        h("div", { class: "verses" }, ...ids.map((i) => verseLine(i))),
        h("nav", { class: "pager", "aria-label": "Kapitel blättern" },
          prev ? h("a", { href: prev, rel: "prev" }, "Vorheriges Kapitel") : h("span"),
          next ? h("a", { href: next, rel: "next" }, "Nächstes Kapitel") : h("span"))),
    );
    window.scrollTo({ top: 0 });
  }
  markSelected();
  if (focus !== undefined) {
    document.getElementById(`v${focus}`)?.scrollIntoView({ block: "center", behavior: already ? "smooth" : "auto" });
  }
}

function chapterPicker(b: number, c: number) {
  const sel = h("select", { "aria-label": "Kapitel wählen", onchange: (e: Event) => go(chapterHash(b, +(e.target as HTMLSelectElement).value)) },
    ...Array.from({ length: bible.books[b].chapters }, (_, k) =>
      h("option", { value: k + 1, selected: k + 1 === c }, `Kapitel ${k + 1}`)));
  return sel;
}

function verseLine(i: number) {
  const v = bible.verses[i];
  const count = xrefs?.out[i].filter((r) => r[2] >= minVotes).length;
  return h("p", { class: "verse", id: `v${i}`, "data-i": i },
    v.h ? h("span", { class: "superscription" }, v.h) : null,
    h("a", { class: "vno", href: verseHash(i), "aria-label": `Vers ${v.v}, Querverweise zeigen` }, String(v.v)),
    h("span", { class: "vtext" }, ...renderText(i)),
    count ? h("span", { class: "xcount", "aria-hidden": "true" }, String(count)) : null);
}

/** Verse text with footnote markers and optional highlight ranges. */
function renderText(i: number, marks: [number, number][] = [], withNotes = true): Node[] {
  const v = bible.verses[i];
  const t = v.t;
  const cuts = new Set<number>([0, t.length]);
  for (const [a, b] of marks) cuts.add(a).add(b);
  const notes = withNotes ? v.n ?? [] : [];
  for (const [o] of notes) cuts.add(Math.min(o, t.length));
  const points = [...cuts].sort((a, b) => a - b);
  const out: Node[] = [];
  let noteNo = 0;
  for (let k = 0; k < points.length; k++) {
    const p = points[k];
    for (const [o, text] of notes) {
      if (Math.min(o, t.length) === p) {
        noteNo++;
        out.push(h("sup", { class: "fn", title: text }, h("button", {
          type: "button", "aria-label": `Fußnote: ${text}`,
          onclick: (e: Event) => { e.stopPropagation(); toggleNote(e.currentTarget as HTMLElement, text); },
        }, String.fromCharCode(96 + noteNo))));
      }
    }
    if (k === points.length - 1) break;
    const seg = t.slice(p, points[k + 1]);
    const marked = marks.some(([a, b]) => a <= p && points[k + 1] <= b);
    out.push(marked ? h("mark", {}, seg) : document.createTextNode(seg));
  }
  return out;
}

function toggleNote(btn: HTMLElement, text: string) {
  const sup = btn.parentElement!;
  const open = sup.nextElementSibling?.classList.contains("note-open");
  if (open) {
    sup.nextElementSibling!.remove();
    return;
  }
  sup.after(h("span", { class: "note-open" }, text));
}

function markSelected() {
  main.querySelectorAll(".verse.selected").forEach((e) => e.classList.remove("selected"));
  if (selected >= 0) document.getElementById(`v${selected}`)?.classList.add("selected");
}

// ---------- cross-reference panel ----------

function select(i: number, push = true) {
  selected = i;
  if (push && location.hash !== verseHash(i)) {
    history.replaceState(null, "", verseHash(i));
  }
  markSelected();
  renderPanel();
}

function closePanel() {
  selected = -1;
  panel.hidden = true;
  document.body.classList.remove("panel-open");
  markSelected();
}

function renderPanel() {
  if (selected < 0) return;
  const i = selected;
  const v = bible.verses[i];
  panel.hidden = false;
  document.body.classList.add("panel-open");

  const head = h("header", { class: "panel-head" },
    h("h2", {}, h("a", { href: verseHash(i) }, refLabel(bible, i, -1, false))),
    h("button", { type: "button", class: "close", "aria-label": "Querverweise schließen", onclick: () => {
      closePanel();
      history.replaceState(null, "", chapterHash(v.b, v.c));
    } }, "Schließen"));
  const quote = h("blockquote", { class: "panel-verse" },
    v.h ? h("span", { class: "superscription" }, v.h) : null, ...renderText(i));

  if (!xrefs) {
    panel.replaceChildren(head, quote, h("p", { class: "muted" }, "Querverweise werden geladen …"));
    return;
  }
  const outAll = xrefs.out[i];
  const inAll = xrefs.incoming[i];
  const outList = outAll.filter((r) => r[2] >= minVotes);
  const inList = inAll.filter((r) => r[1] >= minVotes);
  const items = direction === "out"
    ? outList.map(([to, end, votes]) => ({ to, end, votes }))
    : inList.map(([from, votes]) => ({ to: from, end: -1, votes }));
  const maxVotes = Math.max(1, ...items.map((x) => x.votes));

  const tabs = h("div", { class: "tabs", role: "tablist" },
    tab("out", `Verweist auf (${outList.length})`),
    tab("in", `Wird zitiert von (${inList.length})`));
  const filter = h("label", { class: "filter" }, "Mindestens ",
    h("select", { onchange: (e: Event) => {
      minVotes = +(e.target as HTMLSelectElement).value;
      saveNumber("minVotes", minVotes);
      refreshCounts();
      renderPanel();
    } }, ...[0, 1, 3, 10, 30, 100].map((n) => h("option", { value: n, selected: n === minVotes }, String(n)))),
    " Stimmen");

  const list = h("ol", { class: "xrefs" },
    ...items.map(({ to, end, votes }) => {
      const last = end >= 0 ? end : to;
      const textParts: Node[] = [];
      for (let k = to; k <= Math.min(last, to + 2); k++) {
        if (k > to) textParts.push(h("span", { class: "vno-inline" }, ` ${bible.verses[k].v} `));
        textParts.push(...renderText(k, [], false));
      }
      if (last > to + 2) textParts.push(document.createTextNode(" …"));
      return h("li", {},
        h("a", { class: "xref", href: verseHash(to) },
          h("span", { class: "xref-ref" }, refLabel(bible, to, end)),
          h("span", { class: "votes", title: `${votes} Stimmen auf OpenBible.info` },
            h("span", { class: "votes-bar", style: `inline-size:${Math.max(4, (Math.log1p(Math.max(0, votes)) / Math.log1p(maxVotes)) * 100)}%` }),
            h("span", { class: "votes-n" }, String(votes))),
          h("span", { class: "xref-text" }, ...textParts)));
    }));

  const empty = items.length
    ? null
    : h("p", { class: "muted" },
      (direction === "out" ? outAll.length : inAll.length)
        ? `Keine Verweise mit mindestens ${minVotes} Stimmen. Senken Sie die Schwelle, um schwächere Verweise zu sehen.`
        : direction === "out" ? "Zu diesem Vers verzeichnet OpenBible.info keine Verweise." : "Kein anderer Vers verweist hierher.");

  panel.replaceChildren(
    head, quote,
    canonStrip(bible, i, items.map(({ to, votes }) => ({ to, votes })), (t) => go(verseHash(t))),
    h("div", { class: "panel-controls" }, tabs, filter),
    empty ?? list);
  panel.scrollTop = 0;

  function tab(d: "out" | "in", label: string) {
    return h("button", {
      type: "button", role: "tab", "aria-selected": String(direction === d),
      onclick: () => { direction = d; renderPanel(); },
    }, label);
  }
}

function refreshCounts() {
  if (!xrefs) return;
  main.querySelectorAll<HTMLElement>(".verse").forEach((p) => {
    const i = +p.dataset.i!;
    const n = xrefs!.out[i].filter((r) => r[2] >= minVotes).length;
    let badge = p.querySelector(".xcount");
    if (!n) badge?.remove();
    else {
      if (!badge) p.append((badge = h("span", { class: "xcount", "aria-hidden": "true" })));
      badge.textContent = String(n);
    }
  });
}

// ---------- search ----------

function runSearch(q: string) {
  q = q.trim();
  main.dataset.chapter = "";
  closePanel();
  if (!q) return showHome();
  const refs = parseRefs(bible.books, q);
  if (refs) return showRefs(refs, q);
  document.title = `${q} | Suche`;
  const result = engine.search(q, { minVotes: 1 });
  renderResults(q, result);
}

function showRefs(refs: Ref[], q: string) {
  if (refs.length === 1 && refs[0].cEnd === undefined && refs[0].vEnd === undefined) {
    const r = refs[0];
    const vi = r.v ? bible.index.get(`${r.b}.${r.c}.${r.v}`) : undefined;
    history.replaceState(null, "", vi !== undefined ? verseHash(vi) : chapterHash(r.b, r.c));
    route();
    return;
  }
  const verses: number[] = [];
  for (const r of refs) {
    const start = bible.index.get(`${r.b}.${r.c}.${r.v ?? 1}`);
    if (start === undefined) continue;
    const endC = r.cEnd ?? r.c;
    let endI = r.vEnd !== undefined
      ? bible.index.get(`${r.b}.${endC}.${r.vEnd}`)
      : r.v !== undefined && r.cEnd === undefined ? start : undefined;
    if (endI === undefined) {
      const lastChapter = chapterVerses(bible, r.b, Math.min(endC, bible.books[r.b].chapters));
      endI = r.v !== undefined && r.cEnd === undefined ? start : lastChapter[lastChapter.length - 1];
    }
    for (let k = start; k <= (endI ?? start) && k - start < 400; k++) verses.push(k);
  }
  document.title = `${q} | Elberfelder`;
  main.replaceChildren(
    h("section", { class: "results" },
      h("h1", {}, q),
      verses.length
        ? h("div", { class: "verses" }, ...verses.map((i) => {
          const line = verseLine(i);
          line.querySelector(".vno")!.textContent = refLabel(bible, i);
          line.classList.add("with-ref");
          return line;
        }))
        : h("p", { class: "muted" }, "Diese Stelle gibt es in der Elberfelder nicht.")));
  markSelected();
}

const SOURCE_LABEL: Record<string, string> = {
  bibelwortschatz: "Wortschatz", tippfehler: "Schreibweise", ableitung: "verwandte Form",
  wortteil: "Wortteil", synonym: "Synonym",
};

function renderResults(q: string, r: Result) {
  const a = r.analysis;
  const understood = h("div", { class: "understood" },
    h("p", {}, a.groups.length || a.phrases.length ? "Gesucht wird nach" : "Keine Suchbegriffe erkannt."),
    h("ul", { class: "terms" },
      ...a.phrases.map((p) => h("li", { class: "term" }, h("strong", {}, `„${p.join(" ")}“`), " als Wortfolge")),
      ...a.groups.map((g) => {
        const extra = g.variants.filter((v) => v.source !== "wort");
        return h("li", { class: "term" },
          h("strong", {}, g.word),
          g.variants.length ? null : h("span", { class: "muted" }, " (kommt nicht vor)"),
          extra.length
            ? h("details", {}, h("summary", {}, `+ ${extra.length} Varianten`),
              h("ul", {}, ...extra.map((v) => h("li", {}, v.label, h("span", { class: "muted" }, ` ${SOURCE_LABEL[v.source]}`)))))
            : null);
      }),
      a.scope ? h("li", { class: "term scope" }, "nur ", h("strong", {}, a.scope.label)) : null,
      a.gospelBoost ? h("li", { class: "term scope" }, "Evangelien bevorzugt") : null));

  const hitItem = (hit: Hit, related = false) => {
    const i = hit.i;
    const marks = engine.highlight(i, hit.stems);
    const reason = hit.linkedFrom.length && hit.network > 0.25 * hit.score
      ? h("span", { class: "reason" }, related
        ? `verwiesen von ${hit.linkedFrom.slice(0, 3).map((k) => refLabel(bible, k)).join(", ")}`
        : `gestärkt durch ${hit.linkedFrom.length} Querverweise`)
      : null;
    return h("li", { class: "hit", "data-i": i },
      h("a", { class: "hit-ref", href: verseHash(i), onclick: (e: Event) => {
        if (window.matchMedia("(min-width: 64rem)").matches) {
          e.preventDefault();
          select(i, false);
          history.replaceState(null, "", location.hash); // keep the search in the address bar
        }
      } }, refLabel(bible, i)),
      h("p", { class: "hit-text" }, ...renderText(i, marks, false)),
      reason,
      h("a", { class: "in-context", href: verseHash(i) }, "im Kapitel lesen"));
  };

  main.replaceChildren(
    h("section", { class: "results" },
      h("h1", {}, q),
      understood,
      r.hits.length
        ? h("ol", { class: "hits" }, ...r.hits.map((x) => hitItem(x)))
        : h("p", { class: "empty" },
          "Kein Vers enthält diese Begriffe. Versuchen Sie ein anderes Wort oder eine Bibelstelle wie „Joh 3,16“."),
      r.related.length
        ? h("section", { class: "related" },
          h("h2", {}, "Verwandte Stellen ohne die Suchbegriffe"),
          h("p", { class: "muted" }, "Diese Verse werden von mehreren Treffern oben als Querverweis genannt."),
          h("ol", { class: "hits" }, ...r.related.map((x) => hitItem(x, true))))
        : null,
      xrefs ? null : h("p", { class: "muted" }, "Querverweise werden noch geladen; die Gewichtung über das Verweisnetz folgt.")));
  window.scrollTo({ top: 0 });
}

// ---------- events ----------

$<HTMLFormElement>("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) go(searchHash(q));
});

main.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("a, button, select, details")) return;
  const p = target.closest<HTMLElement>(".verse");
  if (p && window.getSelection()?.isCollapsed !== false) select(+p.dataset.i!);
});

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
    if (e.key === "Escape" && e.target === input) input.blur();
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    input.focus();
    input.select();
  } else if (e.key === "Escape" && selected >= 0) {
    closePanel();
  } else if ((e.key === "j" || e.key === "k") && selected >= 0) {
    const next = selected + (e.key === "j" ? 1 : -1);
    if (next >= 0 && next < bible.verses.length) go(verseHash(next));
  }
});

window.addEventListener("hashchange", route);

// ---------- start ----------

async function start() {
  try {
    bible = await loadBible();
  } catch (err) {
    main.replaceChildren(h("p", { class: "empty" }, `Der Bibeltext konnte nicht geladen werden: ${String(err)}`));
    return;
  }
  engine = new SearchEngine(bible);
  route();
  const [x, t] = await Promise.allSettled([
    loadCrossRefs(bible.verses.length),
    fetch(`${import.meta.env.BASE_URL}data/thesaurus.json`).then((r) => r.json() as Promise<Thesaurus>),
  ]);
  if (t.status === "fulfilled") engine.setThesaurus(t.value);
  if (x.status === "fulfilled") {
    xrefs = x.value;
    engine.setCrossRefs(xrefs);
    refreshCounts();
  }
  // re-run views that depend on the late data
  if (location.hash.includes("suche/") || selected >= 0) route();
}

start();
