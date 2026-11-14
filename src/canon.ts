/**
 * Canon strip: the 66 books side by side, each as wide as its number of verses.
 * Arcs connect the selected verse with the targets of its cross references;
 * stroke opacity follows the OpenBible votes.
 */
import { NT_START, refLabel, type Bible } from "./data.ts";

const W = 1000;
const BASE = 112;
const SVG = "http://www.w3.org/2000/svg";

export interface Link {
  to: number;
  votes: number;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function canonStrip(bible: Bible, from: number, links: Link[], onPick: (i: number) => void): SVGSVGElement {
  const n = bible.verses.length;
  const x = (i: number) => (i / n) * W;
  const svg = el("svg", { viewBox: `0 0 ${W} 150`, class: "canon", role: "img" });
  svg.setAttribute(
    "aria-label",
    `Lage der ${links.length} Verweise in der Bibel: ${links.filter((l) => bible.verses[l.to].b < NT_START).length} im Alten, ` +
      `${links.filter((l) => bible.verses[l.to].b >= NT_START).length} im Neuen Testament`,
  );

  // books
  const starts: number[] = [];
  for (let b = 0; b < bible.books.length; b++) starts.push(bible.chapterStart.get(`${b}.1`) ?? 0);
  starts.push(n);
  for (let b = 0; b < bible.books.length; b++) {
    const r = el("rect", {
      x: x(starts[b]) + 0.5,
      y: BASE,
      width: Math.max(0.5, x(starts[b + 1]) - x(starts[b]) - 1),
      height: 9,
      class: `book ${b >= NT_START ? "nt" : "ot"}${b === bible.verses[from].b ? " current" : ""}`,
    });
    const t = el("title", {});
    t.textContent = bible.books[b].name;
    r.append(t);
    svg.append(r);
  }
  const lbl = (tx: number, text: string, anchor: string) => {
    const t = el("text", { x: tx, y: 146, class: "canon-label", "text-anchor": anchor });
    t.textContent = text;
    svg.append(t);
  };
  lbl(x(starts[NT_START]) / 2, "Altes Testament", "middle");
  lbl((x(starts[NT_START]) + W) / 2, "Neues Testament", "middle");

  // arcs, weakest first so strong ones are drawn on top
  const max = Math.max(1, ...links.map((l) => l.votes));
  const x0 = x(from);
  for (const l of [...links].sort((a, b) => a.votes - b.votes)) {
    const x1 = x(l.to);
    const h = Math.min(98, 10 + Math.abs(x1 - x0) * 0.16);
    const p = el("path", {
      d: `M${x0},${BASE} Q${(x0 + x1) / 2},${BASE - 2 * h} ${x1},${BASE}`,
      class: "arc",
      "stroke-opacity": (0.18 + 0.82 * Math.sqrt(Math.max(0, l.votes) / max)).toFixed(2),
    });
    const t = el("title", {});
    t.textContent = `${refLabel(bible, l.to)} (${l.votes} Stimmen)`;
    p.append(t);
    p.addEventListener("click", () => onPick(l.to));
    svg.append(p);
  }
  svg.append(el("circle", { cx: x0, cy: BASE, r: 4, class: "origin" }));
  return svg;
}
