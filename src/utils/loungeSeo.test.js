// 라운지 글 SEO·AEO — AI 생성기(composeBody)가 쓴 본문을 검색엔진용 화면이 제대로 읽는지.
// 생성기 형식이 바뀌면 여기서 먼저 깨진다(검색 설명문·FAQ 구조화 데이터가 조용히 사라지지 않게).
import { test } from "node:test";
import assert from "node:assert/strict";
import { seoOutline, buildPostMeta, renderSeoBodyHtml, buildPostStructuredData } from "./loungeSeo.js";
import { composeBody } from "../constants/aiDraftWriter.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const body = composeBody({ topic: "견적서 쓰는 법", angle: "고객이 바로 이해하는 견적서는 어떻게 쓰나요", where: "", cat: "quote_worry", variant: 5 });

test("AI 글에서 한 줄 답 · FAQ 세 쌍을 읽는다(뒤 안내 문장은 답에 섞이지 않는다)", () => {
  const o = seoOutline(body);
  assert.ok(o.answer && !o.answer.includes("**"), "한 줄 답");
  assert.equal(o.faq.length, 3);
  for (const { q, a } of o.faq) {
    assert.ok(q.endsWith("?"), q);
    assert.ok(a.length > 5 && !a.includes("라운지에서 함께"), a);
  }
});

test("검색 설명문은 「한 줄 답」 — 별표·마크다운 없이, 150자 안", () => {
  const m = buildPostMeta({ title: "제목", content: body });
  const o = seoOutline(body);
  assert.ok(m.description.startsWith(o.answer.slice(0, 20)), m.description);
  assert.ok(!/\*\*|##|\|/.test(m.description));
  assert.ok(m.description.length <= 151);
});

test("한 줄 답이 없는 일반 글은 첫 문단을 설명문으로", () => {
  const m = buildPostMeta({ title: "t", content: "안녕하세요\n\n욕실 타일을 새로 깔았는데 줄눈 색이 고민입니다. 추천 부탁드려요." });
  assert.ok(m.description.startsWith("욕실 타일을"), m.description);
});

test("검색엔진용 본문 — 소제목·목록·표가 태그로, 날것 마크다운이 남지 않는다", () => {
  const html = renderSeoBodyHtml(body, esc);
  assert.ok(html.includes("<h2>자주 묻는 질문</h2>"));
  assert.ok(html.includes("<h3>"));
  assert.ok(!/(^|>)\s*##/.test(html) && !/<p>\|/.test(html));
  assert.ok(html.includes("<strong>한 줄 답</strong>"));
  const withTable = renderSeoBodyHtml("## 비교\n| 가 | 나 |\n|---|---|\n| 1 | 2 |\n\n- 하나\n- 둘\n1. 첫째", esc);
  assert.ok(withTable.includes("<table><thead><tr><th>가</th><th>나</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"));
  assert.ok(withTable.includes("<ul><li>하나</li><li>둘</li></ul>") && withTable.includes("<ol><li>첫째</li></ol>"));
  assert.ok(renderSeoBodyHtml("<script>x</script>", esc).includes("&lt;script&gt;"), "이스케이프");
});

test("구조화 데이터 — Article(분류·지역·언어) + 빵부스러기 + FAQ", () => {
  const post = { title: "제목", content: body, category: "quote_worry", region: "강서구", created_at: "2026-09-25T00:00:00Z" };
  const meta = buildPostMeta(post);
  const list = buildPostStructuredData({ post, site: "https://x", canonical: "https://x/p", meta, ogImageUrl: "https://x/o.png" });
  const types = list.map((d) => d["@type"]);
  assert.deepEqual(types, ["Article", "BreadcrumbList", "FAQPage"]);
  assert.equal(list[0].inLanguage, "ko-KR");
  assert.equal(list[0].contentLocation.name, "강서구");
  assert.ok(list[0].articleSection);
  assert.equal(list[1].itemListElement.length, 3);
  assert.equal(list[2].mainEntity.length, 3);
});

test("문답이 없는 글엔 FAQ 를 만들지 않는다", () => {
  const post = { title: "t", content: "그냥 이야기입니다. 오늘 이사했어요." };
  const list = buildPostStructuredData({ post, site: "https://x", canonical: "https://x/p", meta: buildPostMeta(post), ogImageUrl: "o" });
  assert.deepEqual(list.map((d) => d["@type"]), ["Article", "BreadcrumbList"]);
});
