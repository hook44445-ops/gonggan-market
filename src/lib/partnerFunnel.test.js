// 업체 가입 깔때기(10-02) — 어디서 빠지는지 세는 순수 함수 · 가입 화면이 «바로 입찰»을 약속하지 않는지 · 203 알림 문구
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { summarizePartnerFunnel, weakestStep, FUNNEL_LOG_STEPS, PARTNER_FUNNEL_ACTIONS, FUNNEL_DOC_CTA } from "./partnerFunnelStats.js";

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf-8");
const logs = (a, n) => Array.from({ length: n }, () => ({ action: a }));

test("깔때기: 기록 4단계 + 실제 표 3단계를 앞 단계 대비 %로", () => {
  const rows = summarizePartnerFunnel({
    logs: [...logs("partner_landing_view", 40), ...logs("partner_join_click", 10), ...logs("partner_onboard_region", 8), ...logs("partner_onboard_specialty", 6)],
    companies: [
      { id: "c1", owner_id: "u1", name: "한결 인테리어", verified: true },
      { id: "c2", owner_id: "u2", name: "바른 집수리", verified: false },
      { id: "c3", owner_id: "u3", name: "테스트 업체", verified: true },   // 테스트 업체는 뺀다
      { id: "c4", owner_id: "u4", name: "공간 필름", verified: false },
    ],
    bids: [{ company_id: "u1" }, { company_id: "c3" }],   // 예전 입찰은 company_id 에 주인 id 가 들어 있기도 하다
  });
  assert.deepEqual(rows.map((r) => r.count), [40, 10, 8, 6, 3, 1, 1]);
  assert.deepEqual(rows.map((r) => r.rate), [null, 25, 80, 75, 50, 33, 100]);
  const w = weakestStep(rows);
  assert.equal(w.label, "입점 버튼 누름");   // 40 → 10 (25%)
});

test("깔때기: 모르는 값은 0 이 아니라 «모름»(null) · 앞 단계 5 미만이면 가장 약한 곳을 말하지 않는다", () => {
  const rows = summarizePartnerFunnel({ logs: null, companies: [{ id: "a", name: "가", verified: false }], bids: null });
  assert.equal(rows[0].count, null);
  assert.equal(rows.find((r) => r.key === "joined").count, 1);
  assert.equal(rows.find((r) => r.key === "first_bid").count, null);
  assert.equal(weakestStep(rows), null);
  assert.equal(weakestStep(summarizePartnerFunnel({ logs: [...logs("partner_landing_view", 3), ...logs("partner_join_click", 1)] })), null);
});

test("깔때기 기록 이름이 화면 코드와 같다(오타면 아무 데도 안 남는다)", () => {
  const landing = read("../screens/PartnerLandingScreen.jsx");
  const onboarding = read("../screens/CompanyOnboarding.jsx");
  assert.match(landing, /trackPartnerFunnel\("partner_landing_view"\)/);
  assert.match(landing, /trackPartnerFunnel\("partner_join_click"/);
  assert.match(onboarding, /trackPartnerFunnel\("partner_onboard_region"\)/);
  assert.match(onboarding, /trackPartnerFunnel\("partner_onboard_specialty"\)/);
  assert.match(onboarding, /trackPartnerFunnel\(FUNNEL_DOC_CTA\)/);
  for (const [a] of FUNNEL_LOG_STEPS) assert.ok(PARTNER_FUNNEL_ACTIONS.includes(a));
  assert.ok(PARTNER_FUNNEL_ACTIONS.includes(FUNNEL_DOC_CTA));
});

test("가입 마친 화면: 사업자등록 확인 전엔 입찰이 잠긴다(124) — «바로 입찰»을 약속하지 않고 서류 올리기를 먼저", () => {
  const onboarding = read("../screens/CompanyOnboarding.jsx");
  assert.ok(!/보고 입찰할 수 있어요/.test(onboarding), "가입 직후 입찰할 수 있다고 말한다(사실 아님)");
  assert.match(onboarding, /입찰은 사업자등록증을 올리고 확인이 끝나면 열려요/);
  assert.match(onboarding, /startAt: "document-center"/);
  const main = read("../components/MainApp.jsx");
  assert.match(main, /user\.startAt === "document-center" && user\.id && !user\.isGuest && activeRole === "company"/);
  // startAt 은 한 번만 쓰는 이동 — 기기 세션에 저장하지 않는다
  assert.match(read("../App.jsx"), /const \{ startAt: _once, \.\.\.persist \} = u;[\s\S]{0,120}saveSession\(persist\)/);
});

test("관리자 승인 알림은 «입찰이 열렸어요»와 한도를 말한다", () => {
  const admin = read("../screens/AdminScreen.jsx");
  assert.match(admin, /사업자등록이 확인됐어요 — 입찰이 열렸어요/);
  assert.match(admin, /limitText\(LIMITS\.BIZ\)/);
});

test("SQL 203: 사업자등록 확인 전 업체에 «바로 입찰 · 견적을 보내 보세요»를 보내지 않는다", () => {
  const sql = read("../../supabase/migrations/203_partner_alerts_before_biz.sql");
  assert.match(sql, /v_fit\s+:= coalesce\(v_limit, 1\) > 0 and/);
  assert.match(sql, /사업자등록증을 올리면 입찰할 수 있어요\(홈택스에서 당일 발급\)/);
  assert.match(sql, /when r\.open_cnt > 0 and not r\.verified then/);
  assert.match(sql, /group by c\.id, c\.owner_id, c\.verified/);
  // 권한은 다시 열지 않는다(115 가 request_notify_partners 를 잠갔다)
  assert.ok(!/grant execute on function public\.request_notify_partners/.test(sql));
});
