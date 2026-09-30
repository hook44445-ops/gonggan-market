// 운영 정책(09-30 대표 확인): 업체·회원·라운지 저장/좋아요·알림·푸시 설정 등은 «토큰의 사용자 = 주인»만 쓰기.
// anon 전용 정책은 없다 → 앱은 토큰 연결(userDb · 토큰 없으면 예전 연결)로 읽고 쓴다. 조용한 실패를 막는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
const WRITE_T = ["companies","users","lounge_saves","lounge_post_likes","request_reposts","site_visits","direct_deal_reports","space_tokens","space_token_logs","reviews","payment_orders","notifications","push_preferences","fcm_tokens","activity_logs","lounge_comments","review_rewards","seed_reviews"];
const OWNREAD_T = ["notifications","push_preferences","fcm_tokens","lounge_saves","lounge_post_likes","payment_orders","request_reposts"];

test("주인만 쓰는 표에 anon 으로 쓰지 않는다", () => {
  for (const t of WRITE_T) {
    const re = new RegExp(`\\bsupabase\\s*\\.from\\("${t}"\\)[\\s\\S]{0,400}?\\.(select|insert|update|upsert|delete)\\(`, "g");
    for (const m of lib.matchAll(re)) {
      assert.equal(m[1], "select", `${t}: anon ${m[1]}`);
      assert.ok(!OWNREAD_T.includes(t), `${t}: 본인만 읽는 표를 anon 으로 읽음`);
    }
  }
});

test("업체 가입: 토큰 먼저 받고 그 토큰으로 업체 저장", () => {
  const ob = readFileSync(new URL("../screens/CompanyOnboarding.jsx", import.meta.url), "utf8");
  const tokenAt = ob.indexOf("const sessionToken = await exchangeSignupTicket();");
  const upsertAt = ob.indexOf("await upsertCompany({");
  assert.ok(tokenAt > 0 && upsertAt > tokenAt);
  assert.match(ob, /\}, authedDb\(userRow\.id\) \?\? supabase\);/);
});
