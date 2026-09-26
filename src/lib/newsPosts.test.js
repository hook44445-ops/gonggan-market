import { test } from "node:test";
import assert from "node:assert/strict";
import { composeTrendRoundup, composeNewsPost, composeWeatherPost, isSensitive, hookFor } from "./newsPosts.js";
import { parseGoogleTrendsRss } from "./trendSources.js";

const NOW = Date.UTC(2026, 8, 26, 3, 0); // KST 09-26 12:00
const rss = `<rss><channel><item><title>아시안 게임</title><ht:approx_traffic>1000+</ht:approx_traffic>
<ht:news_item><ht:news_item_title>14살 보더의 도전 &amp; 응원</ht:news_item_title><ht:news_item_url>https://news.kbs.co.kr/a</ht:news_item_url><ht:news_item_source>KBS 뉴스</ht:news_item_source></ht:news_item></item>
<item><title>장마 끝</title><ht:approx_traffic>500+</ht:approx_traffic><ht:news_item><ht:news_item_title>장마 끝나고 곰팡이 주의</ht:news_item_title><ht:news_item_url>https://example.com/b</ht:news_item_url><ht:news_item_source>예시일보</ht:news_item_source></ht:news_item></item>
<item><title>교통사고 사망</title><ht:news_item><ht:news_item_title>x</ht:news_item_title><ht:news_item_url>https://example.com/c</ht:news_item_url></ht:news_item></item>
<item><title>가을 여행</title><ht:news_item><ht:news_item_title>단풍 명소</ht:news_item_title><ht:news_item_url>https://example.com/d</ht:news_item_url><ht:news_item_source>여행신문</ht:news_item_source></ht:news_item></item></channel></rss>`;

test("구글 트렌드 RSS 를 키워드·검색량·기사로 읽는다", () => {
  const t = parseGoogleTrendsRss(rss);
  assert.equal(t.length, 4);
  assert.equal(t[0].keyword, "아시안 게임");
  assert.equal(t[0].traffic, "1000+");
  assert.deepEqual(t[0].news[0], { title: "14살 보더의 도전 & 응원", url: "https://news.kbs.co.kr/a", source: "KBS 뉴스" });
});

test("트렌드 모음 — 사건·사고는 빼고, 출처 링크를 달고, 집과 닿는 키워드가 있으면 그 고리를 쓴다", () => {
  const p = composeTrendRoundup(parseGoogleTrendsRss(rss), { now: NOW });
  assert.ok(p);
  assert.equal(p.category, "daily");
  assert.equal(p.ai_topic, "트렌드 모음 2026-09-26");
  assert.match(p.title, /^오늘의 트렌드 9월 26일 — 아시안 게임 외 2개$/);
  assert.ok(!p.content.includes("교통사고"));
  assert.ok(p.content.includes("[14살 보더의 도전 & 응원](https://news.kbs.co.kr/a) (KBS 뉴스)"));
  assert.ok(p.content.includes("곰팡이") || p.content.includes("배수구"));
  assert.ok(p.content.includes("출처: Google 트렌드"));
});

test("트렌드가 3개보다 적으면 글을 쓰지 않는다", () => {
  assert.equal(composeTrendRoundup([{ keyword: "a", news: [] }], { now: NOW }), null);
});

test("공간 뉴스 — 집과 닿는 기사만, 본문 없이 제목·링크·체크포인트", () => {
  assert.equal(composeNewsPost({ title: "야구 결승전 결과", url: "https://a.com/1" }, { now: NOW }), null);
  assert.equal(composeNewsPost({ title: "전세 사기 피해자 늘어", url: "https://a.com/2" }, { now: NOW }), null); // 민감어
  assert.equal(composeNewsPost({ title: "리모델링 수요 증가", url: "javascript:alert(1)" }, { now: NOW }), null);
  const p = composeNewsPost({ title: "가을 이사철 도배 수요 늘어", url: "https://a.com/3", source: "a.com" }, { now: NOW });
  assert.equal(p.category, "move_in");
  assert.ok(p.content.includes("[가을 이사철 도배 수요 늘어](https://a.com/3) (a.com)"));
  assert.ok(p.content.includes("## 공간마켓 체크포인트"));
});

test("날씨와 집 — 평범한 날은 쓰지 않고, 한파면 수치 그대로", () => {
  assert.equal(composeWeatherPost({ date: "20261227", tmn: 2, tmx: 8, pop: 20 }), null);
  const p = composeWeatherPost({ date: "20261227", tmn: -8, tmx: -1, pop: 10, place: "서울" });
  assert.match(p.title, /12월 27일 서울 최저 -8℃/);
  assert.ok(p.content.includes("최저 -8℃ · 최고 -1℃ · 강수확률 10%"));
  assert.ok(p.content.includes("출처: 기상청"));
});

test("민감어·고리 판정", () => {
  assert.ok(isSensitive("국회 본회의"));
  assert.ok(!isSensitive("아시안 게임"));
  assert.equal(hookFor("층간소음 갈등")?.category, "interior");
  assert.equal(hookFor("아시안 게임"), null);
});
