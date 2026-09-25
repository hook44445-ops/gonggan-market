import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, signTicket, verifyTicket, sessionUserId } from "./sessionToken.server.js";

const SECRET = "test-secret-please-change";
const UID = "11111111-2222-4333-8444-555555555555";

test("로그인 토큰 — 서명하고 확인하면 사용자 ID 가 나온다(PostgREST 모양)", () => {
  const t = signSession(UID, SECRET);
  const p = verifySession(t, SECRET);
  assert.equal(p.sub, UID);
  assert.equal(p.role, "authenticated");
  assert.equal(p.aud, "authenticated");
  assert.equal(sessionUserId({ headers: { authorization: `Bearer ${t}` } }, SECRET), UID);
});

test("위조·다른 비밀키·만료는 거절", () => {
  const t = signSession(UID, SECRET);
  const [h, b, s] = t.split(".");
  const forged = [h, Buffer.from(JSON.stringify({ aud: "authenticated", role: "authenticated", sub: "evil", exp: 9999999999 })).toString("base64url"), s].join(".");
  assert.equal(verifySession(forged, SECRET), null);
  assert.equal(verifySession(t, "other-secret"), null);
  assert.equal(verifySession("not.a.token", SECRET), null);
  assert.equal(sessionUserId({ headers: {} }, SECRET), null);
});

test("비밀키가 없으면 토큰을 만들지 않는다(예전과 같은 동작)", () => {
  assert.equal(signSession(UID, ""), null);
  assert.equal(signTicket("+821000000000", ""), null);
});

test("가입 표는 로그인 토큰으로 못 쓰고, 로그인 토큰은 가입 표로 못 쓴다", () => {
  const ticket = signTicket("+821012345678", SECRET);
  assert.equal(verifyTicket(ticket, SECRET).phone, "+821012345678");
  assert.equal(verifySession(ticket, SECRET), null);
  assert.equal(verifyTicket(signSession(UID, SECRET), SECRET), null);
});
