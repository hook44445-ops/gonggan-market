import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvidencePrintHtml, escrowDateRows } from "./evidencePrint.js";

const row = {
  area: "강서구 · 아파트 부분", request_id: "a3980578-0000", customer: { name: "김태웅" }, company: { name: "테스트업체" },
  escrow: { id: "c1", transaction_status: "COMPLETED", step1_deposited_at: "2026-09-20T01:00:00Z", step4_approved_at: "2026-09-25T02:00:00Z", created_at: "2026-09-19T00:00:00Z" },
  checkpoints: [{ id: "cp1", checkpoint_type: "착공", captured_at: "2026-09-21T00:00:00Z", lat: 37.5, lng: 126.8, road_address: "서울 강서구", accuracy: 12, captured_by: "u1", photos: ["documents/a.jpg"] }],
  direct_deal_reports: [{ detected_at: "2026-09-22T00:00:00Z", trigger_type: "keyword", status: "open" }],
};

test("증빙 한 장 — 요약·단계·GPS·사진·채팅·신고가 모두 들어간다", () => {
  const html = buildEvidencePrintHtml({
    row, timeline: [{ label: "계약", on: true }, { label: "정산", on: false }], fin: { gmv: 3000000, feeTotal: 132000, companyPayout: 2868000 },
    money: (n) => `₩${n.toLocaleString()}`, photoUrls: { cp1: ["https://x/signed.jpg"] },
    chat: { count: 2, last: "2026-09-22T00:00:00Z", recent: [{ sender_type: "customer", created_at: "2026-09-22T00:00:00Z", text: "010-1234 계좌로 보낼게요" }], kw: ["계좌"] },
  });
  for (const s of ["공간마켓 공사 증빙 기록", "₩3,000,000", "에스크로 결제(입금)", "완료 확인", "서울 강서구", "https://x/signed.jpg", "계좌로 보낼게요", "직거래 의심 키워드", "keyword", "✓ 계약"]) assert.ok(html.includes(s), s);
  assert.ok(html.indexOf("계약 생성") < html.indexOf("에스크로 결제(입금)"), "단계는 시간순");
});

test("채팅 글은 HTML 로 해석되지 않는다", () => {
  const html = buildEvidencePrintHtml({ row, chat: { count: 1, recent: [{ text: "<script>alert(1)</script><img src=x onerror=1>" }], kw: [] } });
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("에스크로 날짜 칸만 시간순", () => {
  assert.deepEqual(escrowDateRows({ a: 1, step4_approved_at: "2026-09-25", step1_deposited_at: "2026-09-20", x_at: null }).map((r) => r.key), ["step1_deposited_at", "step4_approved_at"]);
});
