// 오늘의 집 관리 한 줄(대표 09-29 「1등 재방문」) — 홈에서 매일 바뀐다. 같은 날엔 모두 같은 팁(한국 날짜로 고른다).
//   months: 이 팁이 맞는 달(없으면 사계절). 그 달에 맞는 팁 중에서 날짜 순서대로 돈다.
//   tag: 있으면 «이 공사 견적 받기»로 이어진다(요청서 칩은 라운지 글과 같은 규칙 lib/loungeToRequest 로 제목·본문에서 뽑는다). 광고 문구는 쓰지 않는다.
//   사실만 쓴다 — 법·수치가 필요한 말(보조금·세율 등)은 넣지 않는다.

export const DAILY_TIPS = [
  // ── 가을·겨울(9~2월) ──
  { months: [9, 10, 11], title: "보일러 켜기 전 3가지", body: "난방수 압력계(보통 1~2 사이)·배관 밑 물 샘·배기통 이음새를 먼저 보세요. 첫 가동 때 소리가 크면 공기 빼기를 해 주세요.", tag: null },
  { months: [10, 11, 12], title: "창틀 실리콘 틈 확인", body: "창틀 실리콘이 갈라지면 외풍과 결로가 같이 옵니다. 손을 대 봐서 바람이 느껴지면 겨울 전에 다시 쏘는 게 좋아요.", tag: "실리콘" },
  { months: [11, 12, 1, 2], title: "결로 닦는 시간", body: "아침에 창에 맺힌 물은 바로 닦고 5분만 맞바람 환기를 해 주세요. 매일 두면 벽지 곰팡이로 번집니다.", tag: "곰팡이" },
  { months: [12, 1, 2], title: "수도 동파 막기", body: "영하 10도 아래로 내려가는 밤엔 수도를 아주 가늘게 틀어 배관 동파를 막으세요. 계량기함 안은 헌 옷으로 채우면 좋아요.", tag: "배관" },
  { months: [12, 1, 2], title: "베란다 배수구 얼음", body: "베란다 배수구가 얼면 녹은 물이 거실로 넘쳐 누수가 됩니다. 한파 전 배수구 주변 물기를 치워 두세요.", tag: "누수" },
  { months: [9, 10], title: "방충망 걷기 전 청소", body: "여름 끝난 창문 방충망은 떼기 전에 물 뿌려 먼지를 털면 내년에 새것처럼 씁니다. 찢어진 곳은 보수 테이프로.", tag: "창문" },
  { months: [10, 11], title: "외풍 찾는 법", body: "촛불이나 향을 창틀·콘센트 앞에 대 보세요. 연기가 흔들리는 곳이 외풍 구멍입니다.", tag: "창문" },
  { months: [11, 12, 1], title: "가습기 둘 자리", body: "가습기는 벽에서 50cm 이상 떨어뜨리세요. 벽 가까이 두면 벽지 뒤에 곰팡이가 핍니다.", tag: "곰팡이" },
  // ── 봄(3~5월) ──
  { months: [3, 4], title: "겨울 지난 실리콘 점검", body: "욕실·주방 실리콘이 검게 변했으면 곰팡이가 속까지 들어간 겁니다. 표면 세제로 안 빠지면 재시공이 답이에요.", tag: "실리콘" },
  { months: [3, 4, 5], title: "베란다 방수 확인", body: "베란다 바닥 모서리에 하얀 가루(백화)가 보이면 물이 스미는 신호입니다. 장마 전에 확인해 두세요.", tag: "방수" },
  { months: [4, 5], title: "에어컨 첫 가동 전", body: "필터를 먼저 씻고, 30분 송풍만 돌려 냄새를 확인하세요. 배수 호스 끝이 막혀 있으면 물이 샙니다.", tag: null },
  { months: [3, 4, 5], title: "봄맞이 줄눈 보기", body: "욕실 타일 줄눈이 깨지거나 빠지면 그 틈으로 물이 들어갑니다. 작은 부분은 줄눈 보수제로 막을 수 있어요.", tag: "줄눈" },
  { months: [4, 5], title: "방충망 달기 전", body: "창문 방충망 틀이 휘었는지, 롤 방충망이 잘 감기는지 미리 보세요. 모기 나오기 전에 고치는 게 싸요.", tag: "창문" },
  // ── 여름(6~8월) ──
  { months: [6, 7], title: "장마 전 실리콘", body: "창틀 바깥쪽 실리콘이 떨어지면 비가 벽 안으로 들어옵니다. 장마 전 한 번만 둘러보세요.", tag: "실리콘" },
  { months: [6, 7, 8], title: "누수 첫 신호", body: "천장 벽지가 누렇게 번지거나 들뜨면 위층·배관 누수 신호입니다. 사진을 찍어 날짜와 함께 남겨 두세요.", tag: "누수" },
  { months: [7, 8], title: "곰팡이 막는 환기", body: "비 오는 날에도 하루 두 번, 10분씩 창을 마주 열어 주세요. 제습기는 문 닫고 돌려야 효과가 납니다.", tag: "곰팡이" },
  { months: [6, 7, 8], title: "배수구 냄새", body: "욕실 배수구 냄새는 트랩(물 고이는 부분)이 말라서일 때가 많아요. 물을 한 바가지 부어 보세요.", tag: "배관" },
  { months: [7, 8], title: "에어컨 물 샘", body: "실내기에서 물이 떨어지면 배수 호스가 꺾였거나 막힌 겁니다. 호스 끝을 확인해 보세요.", tag: null },
  // ── 사계절 ──
  { title: "견적은 같은 조건으로", body: "업체마다 범위가 다르면 금액 비교가 안 됩니다. 평수·자재·철거 포함 여부를 같게 적어 받으세요.", tag: null },
  { title: "공사 전 사진 남기기", body: "공사 전 벽·바닥·문을 사진으로 남겨 두세요. 끝난 뒤 흠집이 생겼을 때 기준이 됩니다.", tag: null },
  { title: "수전 물 샘", body: "수전 아래로 물이 한 방울씩 떨어지면 속 부품(카트리지)이 닳은 겁니다. 수전 전체보다 싸게 고칠 수 있어요.", tag: "수전" },
  { title: "변기 물 계속 흐름", body: "변기 물이 계속 졸졸 흐르면 물통 안 고무마개(플래퍼)가 닳은 경우가 많아요. 한 달 물세가 달라집니다.", tag: "변기" },
  { title: "문이 끌릴 때", body: "방문이 바닥에 끌리면 경첩 나사가 풀린 경우가 많아요. 윗 경첩 나사부터 조여 보세요.", tag: "문" },
  { title: "콘센트가 뜨거우면", body: "콘센트나 멀티탭이 손대기 뜨거우면 바로 뽑으세요. 오래된 콘센트는 교체가 안전합니다.", tag: "전기" },
  { title: "타일 들뜸 확인", body: "타일을 톡톡 두드려 빈 소리가 나면 들뜬 겁니다. 깨지기 전에 부분 보수로 막을 수 있어요.", tag: "타일" },
  { title: "도배 전 벽 확인", body: "벽에 곰팡이나 물자국이 있으면 도배 전에 원인을 먼저 잡아야 합니다. 새 벽지도 금방 번져요.", tag: "도배" },
  { title: "장판 들뜸", body: "장판이 부풀면 아래에 습기가 찼을 수 있어요. 가구를 옮겨 바닥이 숨 쉬게 해 주세요.", tag: "장판" },
  { title: "욕실 환풍기", body: "샤워 후 환풍기를 30분 더 돌리세요. 천장 곰팡이의 대부분이 여기서 시작됩니다.", tag: "욕실" },
  { title: "싱크대 아래 확인", body: "한 달에 한 번 싱크대 아래 문을 열어 배관 이음새에 물기가 없는지 보세요.", tag: "주방" },
  { title: "몰딩 틈", body: "몰딩과 벽 사이 틈이 벌어지면 벽이 움직였거나 습기 때문입니다. 작은 틈은 실리콘으로 메울 수 있어요.", tag: "몰딩" },
  { title: "조명 교체 전", body: "등을 바꿀 땐 두꺼비집(차단기)을 먼저 내리세요. 스위치만 끄는 건 안전하지 않습니다.", tag: "조명" },
  { title: "현관 중문 소음", body: "중문이 덜컹거리면 하부 레일 먼지와 바퀴 높이를 먼저 보세요. 조정만으로 조용해지기도 합니다.", tag: "중문" },
  { title: "계약서에 남길 것", body: "공사 범위·자재 이름·기간·대금 나누는 단계·하자 기간을 적어 두세요. 말로 한 약속은 남지 않아요.", tag: null },
  { title: "하자 기간 챙기기", body: "공사 끝난 날과 업체가 약속한 하자 기간을 달력에 적어 두세요. 그 안에 생긴 문제는 알리면 됩니다.", tag: null },
  { title: "작은 수리 모아 한 번에", body: "수전·실리콘·문손잡이처럼 작은 수리는 모아서 한 번에 부르면 출장비를 아낄 수 있어요.", tag: null },
  { title: "창호 레일 청소", body: "창이 뻑뻑하면 레일 먼지부터 치워 보세요. 붓으로 쓸고 물티슈로 닦으면 훨씬 가벼워집니다.", tag: "창문" },
];

// 한국 날짜 기준 «그 날의 팁» — 그 달에 맞는 팁(사계절 포함) 중에서 날짜 순서대로
export function pickDailyTip(now = Date.now(), tips = DAILY_TIPS) {
  const k = new Date(now + 9 * 3600000);
  const month = k.getUTCMonth() + 1;
  const dayIndex = Math.floor((now + 9 * 3600000) / 86400000);
  const pool = tips.filter((t) => !t.months || t.months.includes(month));
  return pool[((dayIndex % pool.length) + pool.length) % pool.length];
}

// 출석 보상(서버 162 와 같아야 한다 — dailyTips.test.js 가 대조) — 매일 +1, 7일 연속마다 +5
export const CHECKIN_REWARD = { daily: 1, weeklyBonus: 5, bonusEvery: 7 };
export function checkinEarn(streak) {
  const s = Math.max(1, Number(streak) || 1);
  return CHECKIN_REWARD.daily + (s % CHECKIN_REWARD.bonusEvery === 0 ? CHECKIN_REWARD.weeklyBonus : 0);
}
// «보너스까지 N일» — 0 이면 오늘이 보너스 날
export function daysToBonus(streak) {
  const s = Math.max(0, Number(streak) || 0);
  return (CHECKIN_REWARD.bonusEvery - (s % CHECKIN_REWARD.bonusEvery)) % CHECKIN_REWARD.bonusEvery;
}

// 팁 → 견적 요청서 미리 채우기(칩은 라운지 글과 같은 규칙) — 팁에 tag 가 없거나 칩이 안 나오면 null
export function tipRequestPrefill(tip, prefillFromPost) {
  if (!tip?.tag || typeof prefillFromPost !== "function") return null;
  const p = prefillFromPost({ title: tip.title, content: tip.body });
  if (!p) return null;
  return { ...p, desc: p.desc.replace(/라운지 글 «([^»]*)» 보고 요청해요/, "오늘의 집 관리 «$1» 보고 요청해요") };
}
