// 결제대행사(PG) 지급대행 입점 심사에서 걸리는 것만 지킨다.
//
// 근거: 나이스정보통신 2026-10-01 회신 «📑 홈페이지 내 필수 확인 사항»
//   ① 중개 서비스로 인지할 수 있는 상품
//   ② 이용약관 내 「중개 사업자」임을 확인할 수 있는 약관
//   ③ 이용약관 또는 홈페이지 내 서비스 제공자에게 재정산 지급 시점(소요기간)
//   ④ 홈페이지 내 「면책조항」 확인 시 입점 불가
//      — 전자상거래법 제20조의3(통신판매중개자는 불만·분쟁 해결을 위해 필요한 조치를
//        신속히 시행하여야 한다) 위반으로 보기 때문이다.
//
// ②③ 이 빠지면 지급대행 심사를 접수조차 못 한다. ④ 는 있으면 반려된다.
// 문구를 다듬는 것은 자유지만, 아래 세 가지가 사라지면 PG 입점이 막힌다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const legal = readFileSync(fileURLToPath(new URL("../screens/LegalScreen.jsx", import.meta.url)), "utf-8");

test("② 약관이 「통신판매중개자」임을 밝힌다", () => {
  assert.ok(/통신판매중개자/.test(legal), "약관에 「통신판매중개자」가 없다 — 지급대행 심사 접수 불가");
  assert.ok(/전자상거래 등에서의 소비자보호에 관한 법률/.test(legal), "근거 법률을 적지 않았다");
});

test("③ 업체에 언제 지급하는지(소요기간)를 적는다", () => {
  assert.ok(/제\d+조 공간파트너에 대한 대금 지급 시점/.test(legal), "대금 지급 시점 조문이 없다");
  assert.ok(/영업일 기준 \d+일 이내에 해당 단계의 대금을 공간파트너에게 지급/.test(legal),
    "«며칠 안에 지급하는지»가 없다 — 단계만 적으면 심사에서 걸린다");
});

test("③ 단계 비율을 약관에 박지 않는다 — 금액 구간마다 다르다", () => {
  const i = legal.indexOf("제9조 공간파트너에 대한 대금 지급 시점");
  const clause = legal.slice(i, i + 1200);
  assert.ok(!/10%|20%|40%|30%/.test(clause),
    "약관에 비율을 박으면 SafePaymentScreen·서버 escrow_stage_plan 과 갈라진다");
  assert.ok(/공사 금액 구간에 따라 다르며/.test(clause), "구간마다 다르다는 말이 있어야 한다");
});

test("④ 「면책조항」이라는 조문 제목을 쓰지 않는다", () => {
  assert.ok(!/h: "제\d+조 면책조항"/.test(legal),
    "조문 제목이 「면책조항」이면 제목만으로 PG 심사에서 걸린다");
});

test("④ 거래 책임을 지지 않는다고 쓰지 않는다 — 전자상거래법 20조의3", () => {
  const banned = /(거래|상품정보|공사)[^.\n]{0,40}책임(을)?\s*지지\s*않습니다/;
  assert.ok(!banned.test(legal), "거래에 책임지지 않는다는 문구가 있으면 입점 불가다");
  // 대신 «무엇을 하는지»가 있어야 한다
  assert.ok(/원인과 피해를 파악하고 해결에 필요한 조치를 신속히 시행/.test(legal),
    "분쟁 해결 조치를 시행한다는 약속이 없다");
});
