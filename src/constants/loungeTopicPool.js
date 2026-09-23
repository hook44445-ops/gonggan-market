// ════════════════════════════════════════════════════════════════════
// 공간라운지 주제 풀 — 2026-09-23
//
// 왜 생겼나: 자동 글쓰기가 «맨날 같은 글»을 썼다. 원인은 둘이었다.
//   ① 주제가 여섯 개(폭우·폭염·부동산 대책·한파·전세사기·장마)로 고정돼 매 호출마다 같은 목록이 돌아왔다.
//   ② 그 주제마저 날씨·사건 위주라, 정작 인테리어 수요자·공급자가 찾는 말이 아니었다.
//
// 그래서 여기에 «사람이 검색창에 실제로 치는 말»을 모은다. 두 손님을 모두 본다 —
//   · 수요자(집을 고치려는 사람): 비용·순서·하자·계약·자재
//   · 공급자(업체 사장님): 고객 매칭·견적서·광고비·현장·분쟁
// 그리고 가끔 우리 이야기(공간마켓·PRUBI)를 정보 형태로 한 번씩 섞는다(광고 문장이 아니라 쓰는 법으로).
//
// GEO: region 이 붙으면 제목·본문·태그에 지역명이 들어간다(「부평구 32평…」).
// 회전: 날짜를 씨앗으로 매일 다른 묶음이 나온다 — 같은 날은 같은 결과(예측 가능·중복검사 친화).
// ⚠️ 새 표·API 없음. 순수 데이터 + 순수 함수.
// ════════════════════════════════════════════════════════════════════

/** audience: 'consumer' 수요자 · 'partner' 공급자 · 'brand' 우리 이야기 */
export const LOUNGE_TOPIC_POOL = [
  // ── 수요자: 돈 ────────────────────────────────────────────────
  { topic: "32평 아파트 전체 리모델링 비용", angle: "32평 전체 리모델링, 지금 얼마쯤 드나요?", category: "quote_worry", audience: "consumer", geo: true },
  { topic: "욕실 리모델링 비용", angle: "욕실 하나 고치는 데 얼마나 드나요?", category: "quote_worry", audience: "consumer", geo: true },
  { topic: "주방 상부장 교체 비용", angle: "주방만 부분 시공하면 얼마나 아낄 수 있나요?", category: "quote_worry", audience: "consumer", geo: true },
  { topic: "견적서 항목 읽는 법", angle: "견적서에서 꼭 확인해야 할 항목은 무엇인가요?", category: "quote_worry", audience: "consumer" },
  { topic: "견적 3곳 비교 기준", angle: "견적 세 곳을 받았는데 무엇으로 고르나요?", category: "quote_worry", audience: "consumer" },
  { topic: "추가 공사비 분쟁", angle: "공사 중 추가비가 생기면 어디까지 내야 하나요?", category: "quote_worry", audience: "consumer" },
  // ── 수요자: 순서·준비 ─────────────────────────────────────────
  { topic: "인테리어 공정 순서", angle: "철거부터 입주까지, 공정은 어떤 순서로 가나요?", category: "interior", audience: "consumer" },
  { topic: "입주 전 체크리스트", angle: "입주 전에 꼭 확인해야 할 것들", category: "move_in", audience: "consumer", geo: true },
  { topic: "이사 날짜와 공사 일정 맞추기", angle: "이사 날짜와 공사 일정, 어떻게 맞추나요?", category: "move_in", audience: "consumer" },
  { topic: "셀프 시공과 업체 시공 경계", angle: "어디까지 셀프로 하고 어디부터 맡겨야 하나요?", category: "interior", audience: "consumer" },
  // ── 수요자: 하자·안전 ─────────────────────────────────────────
  { topic: "시공 하자 A/S 기간", angle: "시공 하자, 언제까지 무상으로 고쳐 주나요?", category: "review", audience: "consumer" },
  { topic: "곰팡이와 결로", angle: "곰팡이와 결로, 고칠 때 무엇부터 봐야 하나요?", category: "daily", audience: "consumer" },
  { topic: "계약서에 꼭 넣을 문장", angle: "인테리어 계약서에 꼭 넣어야 할 문장", category: "quote_worry", audience: "consumer" },
  { topic: "공사 사진 기록", angle: "공사 사진을 남겨 두면 무엇이 달라지나요?", category: "review", audience: "consumer" },
  // ── 수요자: 취향·자재 ─────────────────────────────────────────
  { topic: "바닥재 고르기", angle: "강마루·강화마루·장판, 무엇이 다른가요?", category: "interior", audience: "consumer" },
  { topic: "작은 집 넓어 보이게", angle: "작은 집을 넓어 보이게 만드는 다섯 가지", category: "room_deco", audience: "consumer" },
  { topic: "조명 색온도", angle: "조명 색만 바꿔도 집이 달라 보이는 이유", category: "room_deco", audience: "consumer" },
  { topic: "카페 창업 인테리어", angle: "카페 인테리어, 평당 얼마부터 생각해야 하나요?", category: "startup", audience: "consumer", geo: true },
  { topic: "사무실 이전 인테리어", angle: "사무실 이전, 공사 기간은 얼마나 잡아야 하나요?", category: "startup", audience: "consumer", geo: true },
  // ── 공급자(업체 사장님) ───────────────────────────────────────
  { topic: "고객 매칭", angle: "제대로 된 고객을 만나는 업체는 무엇이 다른가요?", category: "staff-talk", audience: "partner", geo: true },
  { topic: "견적서 쓰는 법", angle: "고객이 바로 이해하는 견적서는 어떻게 쓰나요?", category: "staff-talk", audience: "partner" },
  { topic: "광고비 대비 실계약률", angle: "광고비는 느는데 계약은 그대로일 때", category: "staff-talk", audience: "partner" },
  { topic: "현장 사진 관리", angle: "현장 사진을 남기는 업체가 재계약이 많은 이유", category: "staff-talk", audience: "partner" },
  { topic: "하자 클레임 응대", angle: "하자 연락이 왔을 때 첫 한 마디", category: "staff-talk", audience: "partner" },
  { topic: "공정별 인건비", angle: "요즘 공정별 인건비, 어떻게 잡고 계신가요?", category: "staff-talk", audience: "partner" },
  { topic: "계약금 분쟁 예방", angle: "계약금 단계에서 분쟁을 줄이는 방법", category: "staff-talk", audience: "partner" },
  { topic: "후기 요청 타이밍", angle: "후기를 부탁하기 좋은 순간은 언제인가요?", category: "staff-talk", audience: "partner" },
  // ── 우리 이야기(정보형) — 빈도 제한을 받는다 ──────────────────
  { topic: "비교견적 이용법", angle: "업체를 찾아다니지 않고 견적을 비교하는 방법", category: "quote_worry", audience: "brand", brand: "market" },
  { topic: "공사 기록 남기기", angle: "계약부터 공사 사진까지 한곳에 기록해 두면 생기는 일", category: "review", audience: "brand", brand: "market" },
  { topic: "현장 메모 정리", angle: "현장에서 적은 메모가 다음 견적을 돕는 방법", category: "staff-talk", audience: "brand", brand: "prubi" },
  { topic: "공간 기록 습관", angle: "집을 고치는 동안 하루 한 줄씩 남겨 두면", category: "daily", audience: "brand", brand: "prubi" },
];

/** GEO 회전용 지역 — 서비스가 실제로 도는 곳부터. */
export const LOUNGE_TOPIC_REGIONS = [
  "서울 강서구", "서울 마포구", "서울 송파구", "서울 노원구", "서울 은평구",
  "인천 부평구", "인천 계양구", "인천 서구",
  "경기 성남시", "경기 고양시", "경기 부천시", "경기 수원시",
];

/** 날짜 문자열(YYYY-MM-DD) → 정수 씨앗. 같은 날은 같은 값. */
export function seedFromDate(date = new Date()) {
  const d = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) { h ^= d.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/**
 * 오늘의 주제 묶음. 매일 시작점이 밀려 같은 글이 반복되지 않는다.
 *   · brand(우리 이야기)는 한 번에 최대 1개 — 라운지가 광고판이 되지 않게.
 *   · geo:true 주제에는 지역을 돌려 붙인다(부평구 → 다음 날 성남시).
 */
export function pickDailyTopics(count = 5, date = new Date()) {
  const seed = seedFromDate(date);
  const normal = LOUNGE_TOPIC_POOL.filter(t => t.audience !== "brand");
  const brand  = LOUNGE_TOPIC_POOL.filter(t => t.audience === "brand");
  const out = [];
  const step = 7; // 서로 이웃한 주제가 한꺼번에 나오지 않도록 성큼성큼
  for (let i = 0; i < Math.max(0, count - 1); i++) {
    const t = normal[(seed + i * step) % normal.length];
    out.push(withRegion(t, seed + i));
  }
  if (count > 0) out.push(withRegion(brand[seed % brand.length], seed));
  return out;
}

function withRegion(t, n) {
  if (!t) return t;
  const region = t.geo ? LOUNGE_TOPIC_REGIONS[n % LOUNGE_TOPIC_REGIONS.length] : null;
  return { ...t, region };
}
