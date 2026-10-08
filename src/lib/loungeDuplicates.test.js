import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeLoungeTitle, uniqueByTitle, findSameTitleWithin, duplicateTarget, TITLE_REPEAT_DAYS } from "./loungeDuplicates.js";
import { TOPIC_REPEAT_HOURS, filterNewTopics } from "./duplicateChecker.js";

const P = (id, title, created_at, extra = {}) => ({ id, title, created_at, content: "본문", ...extra });

test("표기만 다른 제목은 같은 제목", () => {
  assert.equal(normalizeLoungeTitle("폭우와 공간의 관계 (2)"), normalizeLoungeTitle("폭우와  공간의 관계!"));
  assert.notEqual(normalizeLoungeTitle("폭우와 공간"), normalizeLoungeTitle("장마와 공간"));
});

test("제목마다 한 편 — 가장 먼저 만든 글, 순서는 처음 나온 자리", () => {
  const posts = [P("c", "폭우와 공간", "2026-10-07"), P("x", "다른 글", "2026-10-06"), P("a", "폭우와 공간", "2026-09-01"), P("b", "폭우와 공간(2)", "2026-09-20")];
  assert.deepEqual(uniqueByTitle(posts).map((p) => p.id), ["a", "x"]);
});

test("30일 안 같은 제목이면 다시 만들지 않는다", () => {
  const now = Date.parse("2026-10-09");
  const posts = [P("a", "폭우와 공간", "2026-09-20")];
  assert.equal(findSameTitleWithin("폭우와 공간", posts, { now })?.id, "a");
  assert.equal(findSameTitleWithin("폭우와 공간", [P("a", "폭우와 공간", "2026-08-01")], { now }), null);
  assert.equal(TOPIC_REPEAT_HOURS, TITLE_REPEAT_DAYS * 24);
});

test("자동 생성 중복 창은 30일 — 사흘 전 주제도 걸러진다(전엔 48시간)", () => {
  const existing = [{ ai_topic: "폭우와 공간", title: "폭우와 공간", created_at: new Date(Date.now() - 3 * 864e5).toISOString() }];
  assert.equal(filterNewTopics([{ topic: "폭우와 공간" }], existing, TOPIC_REPEAT_HOURS).length, 0);
  const src = readFileSync(new URL("./serverAutonomousCycle.js", import.meta.url), "utf8");
  assert.ok(src.includes("filterNewTopics(collected, existing, TOPIC_REPEAT_HOURS)"));
});

test("숨긴 사본은 301, 공개 사본(본문 같음)은 canonical, 내용 다르면 그대로", () => {
  const orig = P("o", "폭우와 공간", "2026-09-01");
  assert.equal(duplicateTarget(P("h", "폭우와 공간", "2026-10-01", { is_hidden: true }), orig)?.action, "redirect");
  assert.equal(duplicateTarget(P("p", "폭우와 공간", "2026-10-01"), orig)?.action, "canonical");
  assert.equal(duplicateTarget(P("d", "폭우와 공간", "2026-10-01", { content: "다른 본문" }), orig), null);
  assert.equal(duplicateTarget(orig, orig), null);
});

test("봇 페이지: 사본 정리 · /lounge 허브 · sitemap 한 편", () => {
  const pre = readFileSync(new URL("../../api/prerender.js", import.meta.url), "utf8");
  assert.ok(pre.includes("duplicateTarget(post,"));
  assert.ok(pre.includes("renderLoungeHub(req, res, site)"));
  const sm = readFileSync(new URL("../../api/sitemap.js", import.meta.url), "utf8");
  assert.ok(sm.includes("uniqueByTitle(posts)") && sm.includes("path: '/lounge'"));
});
