// 라운지 글 → 견적 요청서 미리 채우기(09-28). 라운지 상세의 «이 동네 시공 사례» 칸 아래 작은 링크에서만 쓴다
// (라운지는 대화 우선 · 광고형 견적 CTA 는 두지 않는다 — Lounge CTA Simplification 결정 유지).
//   글 제목·본문의 낱말 → 요청서 공사 칩(RequestModalBeta WORK_TAGS/MORE_WORK_TAGS 와 같은 이름).
//   칩 이름은 요청서가 «칩, 칩 — 설명» 모양으로만 알아본다(splitDesc) — 여기서도 같은 모양으로 만든다.

// [요청서 칩 이름, 글에서 찾을 낱말들]
const RULES = [
  ["수전·세면대", ["수전", "세면대", "수도꼭지"]],
  ["변기", ["변기"]],
  ["실리콘", ["실리콘", "곰팡이"]],
  ["문 손잡이·경첩", ["손잡이", "경첩", "도어락"]],
  ["욕실", ["욕실", "화장실", "샤워"]],
  ["주방", ["주방", "싱크", "상판"]],
  ["필름", ["필름", "시트지"]],
  ["도배", ["도배", "벽지"]],
  ["바닥", ["바닥", "마루", "장판"]],
  ["타일", ["타일"]],
  ["줄눈", ["줄눈"]],
  ["누수·배관", ["누수", "배관", "물샘", "물이 새"]],
  ["방수", ["방수"]],
  ["페인트", ["페인트", "도장"]],
  ["조명·전기", ["조명", "전등", "콘센트", "스위치"]],
  ["창호", ["창호", "샷시", "새시", "창문"]],
  ["중문", ["중문"]],
  ["몰딩", ["몰딩", "걸레받이"]],
  ["단열", ["단열", "결로", "외풍"]],
];
const SMALL = new Set(["수전·세면대", "변기", "실리콘", "문 손잡이·경첩", "줄눈"]);

// 글에서 칩 고르기 — 최대 3개(요청서가 무거워지지 않게), 규칙 순서대로
export function tagsFromPost(post = {}) {
  const hay = `${post.title ?? ""} ${post.content ?? ""}`;
  const tags = [];
  for (const [tag, words] of RULES) {
    if (words.some(w => hay.includes(w))) tags.push(tag);
    if (tags.length >= 3) break;
  }
  return tags;
}

// 요청서 미리 채울 값(initialData) — 칩이 하나도 없으면 null(링크를 보이지 않는다)
export function requestPrefillFromPost(post = {}) {
  const tags = tagsFromPost(post);
  if (!tags.length) return null;
  const small = tags.every(t => SMALL.has(t));
  const title = String(post.title ?? "").trim().slice(0, 30);
  return {
    desc: `${tags.join(", ")} — ${title ? `라운지 글 «${title}» 보고 요청해요` : "라운지 글 보고 요청해요"}`,
    ...(small ? { size: "평수 무관(작은 수리)", budget: "50만원 이하" } : {}),
  };
}
