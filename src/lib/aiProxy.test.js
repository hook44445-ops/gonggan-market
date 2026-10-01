// 10-01 — 관리자 화면 AI 는 서버를 거쳐(키를 앱에 싣지 않는다) · «지금 트렌드 확인»은 관리자 토큰으로
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("./llmClient.js", import.meta.url), "utf8");
const providers = readFileSync(new URL("./llmProviders.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../../api/trend/check-trends.js", import.meta.url), "utf8");
const writer = readFileSync(new URL("./serverLoungeWriter.js", import.meta.url), "utf8");
const adm = readFileSync(new URL("../screens/AdminScreen.jsx", import.meta.url), "utf8");

test("브라우저 코드는 AI 키를 VITE_ 에서 읽지 않는다(공개 코드에 들어간다)", () => {
  for (const src of [client, providers]) {
    assert.doesNotMatch(src, /ENV\.VITE_(LLM_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY)/);
  }
  assert.match(client, /const API_KEY {2}= IN_BROWSER \? "" :/);
  assert.match(client, /url: PROXY_URL/);
  assert.match(client, /"\/api\/trend\/check-trends\?mode=llm_chat"/);
});

test("서버 통로 — 관리자·운영자 토큰만 · 서버 키 · 키 없으면 503 NO_SERVER_KEY", () => {
  assert.match(api, /req\.query\?\.mode === 'llm_chat'/);
  assert.match(api, /if \(!\(await isAdminSession\(req\)\)\) return sendJson\(401/);
  assert.match(api, /NO_SERVER_KEY/);
  assert.match(writer, /export async function adminChat\(/);
  assert.match(writer, /if \(!key\) return \{ error: "NO_SERVER_KEY" \};/);
});

test("«지금 트렌드 확인» — 크론 비밀 키 대신 관리자 토큰 · 결과는 서버가 돌려주는 값으로", () => {
  assert.match(api, /if \(await isAdminSession\(req\)\) manual = true;/);
  assert.match(adm, /fetch\("\/api\/trend\/check-trends", \{ headers: authHeader\(adminUserId\) \}\)/);
  assert.match(adm, /trendCheckResult\.generated/);
  assert.doesNotMatch(adm, /trendCheckResult\.collected/);
});

test("10-01 대표 — 인도점성술은 빼고 별자리 운세로 · 큐티는 둔다 · 서버 트렌드 운세 글은 자동 발행 안 함", async () => {
  const day = readFileSync(new URL("./dayRunner.js", import.meta.url), "utf8");
  assert.match(day, /export const DAY_PROGRAM = \["qt", "astrology", "morning_brief", "space_market", "trend_present"\];/);
  assert.match(day, /zodiacPrompt\(\)/);
  assert.doesNotMatch(adm, /indianAstrology|인도점성술 포함|인도점성술 대상|오늘의 인도점성술/);
  assert.match(adm, /\{ id: "qt", label: "📖 오늘 큐티 말씀"/);
  assert.match(adm, /\{ id: "astrology", label: "⭐ 오늘의 별자리 운세"/);
  const { zodiacPrompt, ZODIAC_SIGNS, ZODIAC_DISCLAIMER } = await import("./zodiacHoroscope.js");
  assert.equal(ZODIAC_SIGNS.length, 12);
  const p = zodiacPrompt(Date.parse("2026-10-02T00:00:00Z"));
  assert.match(p, /양자리\(3\/21~4\/19\)/);
  assert.match(p, /단정적 예언/);
  assert.ok(p.includes(ZODIAC_DISCLAIMER));
  const cycle = readFileSync(new URL("./serverAutonomousCycle.js", import.meta.url), "utf8");
  assert.match(cycle, /if \(type === "astrology"\) \{\s+res\.needsReview \+= 1;/);
});
