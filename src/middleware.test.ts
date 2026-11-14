import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.ts";

const env = { BASIC_AUTH_USER: "bibel", BASIC_AUTH_PASSWORD: "Gnade für alle" };
const ok = () => Promise.resolve(new Response("site"));
const call = (auth?: string, e: object = env) =>
  onRequest({ request: new Request("https://x/", { headers: auth ? { Authorization: auth } : {} }), env: e, next: ok });
const basic = (s: string) => "Basic " + Buffer.from(s, "utf8").toString("base64");

test("correct credentials pass through", async () => {
  assert.equal(await (await call(basic("bibel:Gnade für alle"))).text(), "site");
});
test("wrong or missing credentials get 401 with a challenge", async () => {
  for (const auth of [undefined, basic("bibel:falsch"), basic("other:Gnade für alle"), "Basic !!!", "Bearer x", basic("nocolon")]) {
    const r = await call(auth);
    assert.equal(r.status, 401, String(auth));
    assert.match(r.headers.get("WWW-Authenticate") ?? "", /^Basic /);
  }
});
test("missing secrets fail closed", async () => {
  assert.equal((await call(basic("bibel:Gnade für alle"), {})).status, 500);
});
