// Executive Office KPI + 발행결과 단위 테스트 (Phase 51)
//   실행: node --test src/lib/executiveOffice.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { executiveKpis, publishResult } from "./executiveOffice.js";

const LONG = ["## 도입","이 글은 독자에게 실제 도움이 되는 정보를 충분한 분량으로 자세히 정리한 본문입니다.","","## 상세 본문","- 첫 번째 준비 항목과 확인 방법에 대한 설명","- 두 번째 비교 기준과 절차에 대한 안내","- 세 번째 주의사항 체크리스트 정리","일반적으로 알려진 기준과 참고 자료, 실제 사례와 절차를 함께 확인했습니다.","어떻게 준비할까요? 무엇을 먼저 확인해야 할까요?","","## 결론","정리하면 아래 체크리스트로 차근차근 준비하시면 도움이 됩니다."].join("\n");
const now = Date.parse("2026-07-12T05:00:00Z"); // KST 14:00

test("§8 publishResult — published 만 URL/게시시간/Elapsed/ID 반환", () => {
  assert.equal(publishResult({ publish_status: "draft" }), null);
  const pr = publishResult({ id: "abc12345", title: "공간 글", publish_status: "published", created_at: "2026-07-12T04:00:00Z", updated_at: "2026-07-12T05:00:00Z" }, { now });
  assert.ok(pr.url.startsWith("/lounge/posts/"));
  assert.equal(pr.elapsedMin, 60);
  assert.equal(pr.publishId, "abc12345".slice(0, 8));
});

test("§10 executiveKpis — 오늘 생성/발행/긴급/예약/평균품질/예산", () => {
  const recs = [
    { id: "a", title: "속보 집중호우 통제", content: LONG, publish_status: "published", created_at: "2026-07-12T05:00:00Z", updated_at: "2026-07-12T05:10:00Z", is_seed: true, ai_topic: "x" },
    { id: "b", title: "장마철 곰팡이 예방법", content: LONG, publish_status: "draft", created_at: "2026-07-12T05:00:00Z", is_seed: true, ai_topic: "y" },
    { id: "c", title: "예약된 공간 글", content: LONG, publish_status: "scheduled", scheduled_at: "2026-07-13T05:00:00Z", created_at: "2026-07-12T05:00:00Z", is_seed: true, ai_topic: "z" },
  ];
  const k = executiveKpis(recs, { now });
  assert.equal(k.todayGenerated, 3);
  assert.equal(k.todayPublished, 1);
  assert.ok(k.immediate >= 1, "긴급(속보) 1건 이상");
  assert.equal(k.scheduledPending, 1);
  assert.ok(k.avgQuality != null);
  assert.equal(k.budget.total.cap, 15);
});

test("빈 입력에도 안전", () => {
  const k = executiveKpis([], { now });
  assert.equal(k.todayGenerated, 0);
  assert.equal(k.todayPublished, 0);
  assert.equal(k.avgQuality, null);
});
