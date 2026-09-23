// 라운지 자동 글 — 「날마다 새롭게」가 실제로 지켜지는지 센다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDailyTopics } from "../constants/loungeTopicPool.js";
import { generateDraft } from "../constants/aiContentFactory.js";
import { DRAFT_FORMATS, josa } from "../constants/aiDraftWriter.js";

const draftsFor = (days) => {
  const out = [];
  for (let d = 1; d <= days; d++) {
    const day = new Date(Date.UTC(2026, 9, d)).toISOString().slice(0, 10);
    for (const t of pickDailyTopics(5, day)) {
      out.push({
        day,
        topic: t.topic,
        brand: t.brand ?? null,
        draft: generateDraft({
          issue: t.topic, spaceAngle: t.angle, category: t.category,
          region: t.region, brand: t.brand ?? null, variant: t.variant ?? 0,
        }),
      });
    }
  }
  return out;
};

test("한 달(30일) 글이 모두 다르다", () => {
  const rows = draftsFor(30);
  const keys = new Set(rows.map(r => `${r.draft.title}||${r.draft.content.slice(0, 150)}`));
  assert.equal(rows.length, 150);
  assert.equal(keys.size, rows.length, "같은 제목·같은 도입의 글이 있다");
});

test("두 달(60일)도 모두 다르다", () => {
  const rows = draftsFor(60);
  const keys = new Set(rows.map(r => `${r.draft.title}||${r.draft.content.slice(0, 150)}`));
  assert.equal(keys.size, rows.length);
});

test("형식은 열 벌이고, 같은 주제가 다시 나오면 형식이 밀린다", () => {
  assert.ok(DRAFT_FORMATS.length >= 10, "형식이 열 벌 이상");
  const a = generateDraft({ issue: "욕실 리모델링 비용", spaceAngle: "욕실 하나 고치는 데 얼마나 드나요?", variant: 0 });
  const b = generateDraft({ issue: "욕실 리모델링 비용", spaceAngle: "욕실 하나 고치는 데 얼마나 드나요?", variant: 1 });
  assert.notEqual(a.content, b.content);
  assert.notEqual(a.title, b.title);
});

test("우리 이야기(광고성)는 사흘에 한 번 이하", () => {
  const rows = draftsFor(30);
  const brandCount = rows.filter(r => r.brand).length;
  assert.ok(brandCount <= 11, `우리 이야기 ${brandCount}회 — 너무 잦다`);
});

test("조사(은/는)를 받침에 맞게 붙인다", () => {
  assert.equal(josa("욕실", "은", "는"), "욕실은");
  assert.equal(josa("공사", "은", "는"), "공사는");
  const d = generateDraft({ issue: "이사 날짜와 공사 일정 맞추기", spaceAngle: "이사 날짜와 공사 일정, 어떻게 맞추나요?", variant: 8 });
  assert.ok(!d.content.includes("은(는)"), "「은(는)」 같은 표기가 남아 있다");
});

test("모든 글에 한 줄 답과 FAQ가 있다(AEO)", () => {
  for (const r of draftsFor(7)) {
    assert.ok(r.draft.content.startsWith("**한 줄 답**"), `${r.topic}: 한 줄 답 없음`);
    assert.ok(r.draft.content.includes("## 자주 묻는 질문"), `${r.topic}: FAQ 없음`);
    assert.ok(r.draft.content.length >= 600, `${r.topic}: 본문이 너무 짧다`);
  }
});
