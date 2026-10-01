import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { pageSeo, consumerFaq, partnerFaq, isBetaServer } from "./siteSeo.js";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf-8");

// ─────────────────────────────────────────────────────
// 사업자등록을 «어디에» 붙이는지가 갈린다(2026-09-30 두 번 고침).
//
//   ✅ 계약·결제 — 「계약은 사업자등록을 확인한 업체와만」
//      사실이고 코드로 막혀 있다: contractGate 가 company.verified 아니면
//      결제 화면과 결제 승인 서버(api/confirm-payment) 둘 다에서 거절한다(A안 · 대표 확정 09-24).
//      결국 돈이 오가는 자리에는 사업자등록 업체만 남는다.
//
//   ❌ 견적·입찰 — 「사업자등록을 확인한 업체가 견적을 보낸다」
//      사실이 아니다. 가입만 한 업체도 300만원까지 입찰한다(partnerTier LIMITS.NONE).
//      작은 수리(수전·실리콘·필름) 1인 파트너를 받으려고 일부러 열어 둔 칸이다.
//
// 이 문장은 title·description·OG·프리렌더·llms.txt 에 실려 색인되므로,
// «견적·입찰에 붙은 사업자등록»만 막는다. (SafePaymentScreen 의 구간별 요건표는 그 구간에서 사실이라 예외)
// ─────────────────────────────────────────────────────
const BANNED_BID_CLAIM = /사업자등록을? 확인한? 업체[^.]{0,24}(견적을? 보|견적을? 받|입찰)|확인 업체만 견적/;

test("견적·입찰에 없는 검증을 붙이지 않는다 — 제목·설명·FAQ", () => {
  const banned = BANNED_BID_CLAIM;
  for (const beta of [true, false]) {
    for (const [path, seo] of Object.entries(pageSeo(beta))) {
      assert.ok(!banned.test(seo.title), `${path} 제목(beta=${beta})`);
      assert.ok(!banned.test(seo.description), `${path} 설명(beta=${beta})`);
    }
    for (const { q, a } of consumerFaq(beta)) {
      assert.ok(!banned.test(q) && !banned.test(a), `의뢰인 FAQ: ${q}`);
    }
  }
  for (const { q, a } of partnerFaq()) {
    assert.ok(!banned.test(q) && !banned.test(a), `파트너 FAQ: ${q}`);
  }
});

test("랜딩 여정 문구에도 견적에 붙은 없는 검증이 없다", () => {
  const landing = read("../screens/LandingScreen.jsx");
  const journey = landing.slice(landing.indexOf("const JOURNEY"), landing.indexOf("const FAQ_ITEMS"));
  assert.ok(!BANNED_BID_CLAIM.test(journey));
});

// 반대로 «계약은 사업자등록 확인 업체와만» 은 우리만 할 수 있는 말이고 코드로 막혀 있다.
// 지우면 경쟁 앱과 구분되는 자리를 스스로 버리는 것이라, 남아 있는지도 같이 지킨다.
test("계약 단계의 사업자등록 확인은 계속 말한다", () => {
  const CONTRACT_CLAIM = /계약은 사업자등록을 확인한 업체와만/;
  const home = pageSeo(true)["/"];
  assert.ok(CONTRACT_CLAIM.test(home.description), "홈 설명에서 사라졌다");
  assert.ok(CONTRACT_CLAIM.test(pageSeo(false)["/"].description), "홈 설명(정식)에서 사라졌다");
  assert.ok(consumerFaq(true).some(({ a }) => CONTRACT_CLAIM.test(a)), "의뢰인 FAQ 에서 사라졌다");
  // 랜딩 화면은 대표가 그대로 두라고 했다(2026-09-30) — 검색·스토어 쪽만 지킨다.
  // 말만 있고 막는 코드가 없으면 그게 더 나쁘다 — 게이트가 살아 있는지도 본다
  const gate = read("../lib/contractGate.js");
  assert.ok(/company\.verified === true/.test(gate), "contractGate 가 사업자 확인을 안 본다");
  assert.ok(/contractGate/.test(read("../../api/confirm-payment.js")), "결제 승인 서버가 게이트를 안 쓴다");
});

// ─────────────────────────────────────────────────────
// /download — 비공개 사전체험판 동안에는 «웹 먼저».
// 공유 카드·QR 로 온 사람에게 3단계 + 구글 계정 등록을 먼저 들이밀면 대부분 빠져나간다.
// Play 참여 경로는 지우지 않고 아래에 둔다.
// ─────────────────────────────────────────────────────
test("/download: 사전체험판이면 웹 시작이 Play 참여보다 먼저 나온다", () => {
  const s = read("../screens/DownloadScreen.jsx");
  const web = s.indexOf("웹에서 바로 시작하기");
  const app = s.indexOf("앱으로 받고 싶다면");
  assert.ok(web > 0, "웹 시작 버튼이 없다");
  assert.ok(app > 0, "앱 안내 구분이 없다");
  assert.ok(web < app, "웹 시작이 앱 안내보다 뒤에 있다");
  // Play 참여 경로를 지우지 않았다
  assert.ok(s.includes("plan.buttons.map"), "스토어 버튼 경로가 사라졌다");
  assert.ok(s.includes("테스터 신청 보내기"), "테스터 신청 폼이 사라졌다");
});
