import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { pageSeo, consumerFaq, partnerFaq, isBetaServer } from "./siteSeo.js";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf-8");

// ─────────────────────────────────────────────────────
// 「사업자등록을 확인한 업체가 견적을 보낸다」는 사실이 아니다.
// 새 정책에서는 가입만 한 업체도 300만원까지 입찰한다(partnerTier LIMITS.NONE).
// 이 문장은 title·description·OG·프리렌더·llms.txt 에 실려 색인되므로 막는다.
// (SafePaymentScreen 의 금액 구간별 «요건표»는 그 구간에서 사실이라 예외)
// ─────────────────────────────────────────────────────
test("없는 검증을 광고하지 않는다 — 제목·설명·FAQ", () => {
  const banned = /사업자등록을? 확인한? 업체/;
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

test("랜딩 여정 문구에도 없는 검증이 없다", () => {
  const landing = read("../screens/LandingScreen.jsx");
  const journey = landing.slice(landing.indexOf("const JOURNEY"), landing.indexOf("const FAQ_ITEMS"));
  assert.ok(!/사업자등록을 확인한 업체/.test(journey));
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
