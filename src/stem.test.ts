import { test } from "node:test";
import assert from "node:assert/strict";
import { stem } from "./stem.ts";

// expected values from the Snowball German reference vocabulary
const cases: [string, string][] = [
  ["aufeinanderfolgende", "aufeinanderfolg"], ["aufeinanderfolgenden", "aufeinanderfolg"],
  ["kategorische", "kategor"], ["glaubt", "glaubt"], ["glauben", "glaub"], ["glaube", "glaub"],
  ["vergebung", "vergeb"], ["vergeben", "vergeb"], ["herrlichkeit", "herrlich"],
  ["daß", "dass"], ["dass", "dass"], ["häuser", "haus"], ["füße", "fuss"], ["himmel", "himmel"],
  ["gerechtigkeit", "gerecht"], ["liebe", "lieb"], ["geliebt", "geliebt"], ["erkenntnis", "erkenntnis"],
];
test("snowball german", () => {
  for (const [w, s] of cases) assert.equal(stem(w), s, w);
});
