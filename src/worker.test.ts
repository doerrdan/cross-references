import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "../worker/index.ts";

const ASSETS = { fetch: () => Promise.resolve(new Response("site")) };
const env: Env = { ASSETS, BASIC_AUTH_USER: "bibel", BASIC_AUTH_PASSWORD: "Gnade für alle" };
const call = (auth?: string, e: Env = env) =>
  worker.fetch(new Request("https://x/", { headers: auth ? { Authorization: auth } : {} }), e);
const basic = (s: string) => "Basic " + Buffer.from(s, "utf8").toString("base64");

test("correct credentials reach the static files", async () => {
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
  assert.equal((await call(basic("bibel:Gnade für alle"), { ASSETS })).status, 500);
});
test("user name * accepts any user name, password still required", async () => {
  const wild: Env = { ASSETS, BASIC_AUTH_USER: "*", BASIC_AUTH_PASSWORD: "Gnade für alle" };
  for (const u of ["bibel", "irgendwer", ""]) {
    assert.equal((await call(basic(`${u}:Gnade für alle`), wild)).status, 200, u);
  }
  assert.equal((await call(basic("bibel:falsch"), wild)).status, 401);
  assert.equal((await call(undefined, wild)).status, 401);
});
