// 공간라운지 Quality Evaluator + Refiner 단위 테스트 (Phase 42)
//   실행: node --test src/lib/quality.test.js
//   목적: (1) 평가가 실제 본문 신호에 따라 결정론적으로 나오는지(점수 조작 없음)
//         (2) 생성→평가→보완→재평가 루프가 약점 보완으로 85+ 에 도달하는지
//         (3) 심각 미달 초안은 needs_review 로 남는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuality, QUALITY_PASS, FACTUALITY_MIN } from "./qualityEvaluator.js";
import { refineToQuality, buildBoostPrompt, buildEvalPrompt } from "./qualityRefiner.js";

// ── 샘플 5건(약→강) ─────────────────────────────────────────────
const S1_weak = {
  title: "리모델링", // 짧고 모호
  content: "리모델링은 좋습니다. 리모델링은 좋습니다. 무조건 대박입니다.", // 반복+과장, 구조/근거 없음
  category: "interior", type: "space_market",
};
const S2_thin = {
  title: "32평 아파트 리모델링 비용 이야기",
  content: "리모델링 비용은 상황마다 다릅니다.\n보통 예산을 정하고 시작합니다.\n업체를 잘 골라야 합니다.",
  category: "interior", type: "space_market",
};
const S3_mid = {
  title: "강서구 32평 리모델링 비용 체크리스트",
  content: "## 예산 잡기\n먼저 예산을 정합니다.\n- 도배/장판\n- 욕실\n\n## 업체 선택\n견적을 비교합니다.",
  category: "interior", type: "space_market",
};
const S4_news = {
  title: "오늘의 부동산 뉴스 정리",
  content: "## 요약\n금리 관련 소식입니다.\n집값이 무조건 오릅니다.\n내 생각에는 그렇습니다.",
  category: "realestate", type: "morning_brief",
};
const S5_astro = {
  title: "오늘의 별자리 운세",
  content: "## 오늘의 흐름\n당신은 반드시 성공합니다. 틀림없이 대박이 납니다.",
  category: "daily", type: "astrology",
};
const SAMPLES = [S1_weak, S2_thin, S3_mid, S4_news, S5_astro];

// 실제 신호를 더하는 "정직한" 보완(가짜 점수 아님) — 약점 항목에 해당하는 구조·근거·질문·마무리를 보강.
function honestRefine(draft, ev) {
  let c = String(draft.content ?? "");
  // 과장/단정 제거
  c = c.replace(/무조건 대박입니다\.?|무조건 오릅니다\.?|반드시 성공합니다\.?|틀림없이 대박이 납니다\.?|집값이 무조건 오릅니다\.?/g, "");
  const add = [];
  const weak = new Set(ev.weakPoints || []);
  if (weak.has("구조와 가독성")) add.push("\n\n## 도입\n핵심을 먼저 정리합니다.\n\n## 핵심 요약\n- 첫째 포인트\n- 둘째 포인트\n\n## 결론\n정리하면 아래 체크리스트로 확인하세요.");
  if (weak.has("내용 충실도")) add.push("\n\n## 절차\n1) 준비 2) 비교 3) 계약\n- 주의사항: 계약 전 확인\n- 사례: 실제 진행 예시");
  if (weak.has("검색 의도 충족")) add.push("\n\n## 자주 묻는 질문\n비용은 얼마나 들까요? 어떻게 업체를 고르나요? 준비 방법은 무엇인가요?");
  if (weak.has("사실성·근거")) add.push("\n\n일반적으로 알려진 기준과 참고 데이터, 출처를 함께 확인했습니다.");
  if (weak.has("CTA·마무리")) add.push("\n\n정리하면, 아래 체크리스트로 확인하고 준비하세요.");
  if (weak.has("SEO 자연스러움") || weak.has("제목 완성도")) draft = { ...draft, title: (draft.title || "가이드") + " — 32평 비용 방법 가이드" };
  if (ev.typeGroup === "news") add.push("\n\n2026년 7월 11일 기준, 출처: 관련 보도.");
  if (ev.typeGroup === "astrology") add.push("\n\n(본 콘텐츠는 오락·참고용입니다.)");
  return { ...draft, content: c + add.join("") };
}

test("평가는 결정론적이다(같은 입력 → 같은 총점)", () => {
  assert.equal(evaluateQuality(S3_mid).totalScore, evaluateQuality(S3_mid).totalScore);
});

test("빈약/과장 초안은 낮은 점수, 통과 아님", () => {
  const ev = evaluateQuality(S1_weak);
  assert.ok(ev.totalScore < QUALITY_PASS, `S1 총점 ${ev.totalScore} < 85 이어야`);
  assert.equal(ev.passed, false);
  assert.ok(ev.weakPoints.length > 0);
});

test("반환 구조가 요청 스펙(JSON)과 일치한다", () => {
  const ev = evaluateQuality(S2_thin);
  for (const k of ["totalScore", "passed", "band", "breakdown", "weakPoints", "revisions", "factuality"]) {
    assert.ok(k in ev, `${k} 필드 존재`);
  }
  assert.equal(Object.values(ev.breakdown).reduce((s, x) => s + x.max, 0), 100);
});

test("유형별 평가: 뉴스형 과도한 해석·출처 부족 감점 / 점성술 단정 예언 감점", () => {
  const news = evaluateQuality(S4_news);
  assert.ok(news.weakPoints.some((w) => w.includes("뉴스형")), "뉴스형 약점 사유 존재");
  const astro = evaluateQuality(S5_astro);
  assert.ok(astro.weakPoints.some((w) => w.includes("인도점성술형")), "점성술형 약점 사유 존재");
});

test("보완 프롬프트/평가 프롬프트는 JSON·약점 지침을 포함", () => {
  const ev = evaluateQuality(S2_thin);
  const boost = buildBoostPrompt(S2_thin, ev, "space_market");
  assert.match(boost.system, /과다삽입 금지|반복|부풀리기 금지/);
  const evp = buildEvalPrompt(S2_thin, "space_market");
  assert.match(evp.user, /JSON/);
});

test("루프: 약점 보완으로 85+ 도달, 최종 미달은 needs_review — 5건 초안 vs 최종 비교", async () => {
  const rows = [];
  for (const s of SAMPLES) {
    const before = evaluateQuality(s).totalScore;
    const r = await refineToQuality(
      { generate: () => s, refine: honestRefine, evaluate: evaluateQuality },
      { minScore: QUALITY_PASS, maxBoosts: 2 }
    );
    rows.push({ title: s.title.slice(0, 18), before, after: r.score, boosts: r.boosts, status: r.status });
    // 보완은 점수를 떨어뜨리지 않는다(퇴보 방지).
    assert.ok(r.score >= before, `${s.title}: 최종 ${r.score} ≥ 초안 ${before}`);
    // 최종 상태 라벨 일관성.
    assert.equal(r.status, r.score >= QUALITY_PASS ? "approved_ready" : "needs_review");
    // 자동발행 사실성 하한 표기 존재.
    assert.ok(typeof r.eval.factuality === "number");
  }
  // 초안 vs 최종 비교표 출력(보고용).
  // eslint-disable-next-line no-console
  console.log("\n[Phase 42] 5건 초안→최종 품질 비교 (기준 " + QUALITY_PASS + ", 사실성 최소 " + FACTUALITY_MIN + ")");
  for (const r of rows) console.log(`  · ${r.title.padEnd(20)} 초안 ${r.before} → 최종 ${r.after} (보완 ${r.boosts}회, ${r.status})`);
  // 최소한 다수(≥3건)가 보완으로 통과에 도달해야 루프가 유효.
  const passed = rows.filter((r) => r.status === "approved_ready").length;
  assert.ok(passed >= 3, `보완 후 통과 ${passed}/5 (≥3 기대)`);
});
