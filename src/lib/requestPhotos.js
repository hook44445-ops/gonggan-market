// 요청서 현장 사진 — 고객이 «지금 이 상태»를 찍어 올린 사진.
//
// 왜(대표 2026-09-30):
//   업체는 평수·예산·공종 태그·메모 몇 줄만 보고 입찰 금액을 던져 왔다. 요청서에
//   **고객이 자기 집을 찍어 올리는 칸이 아예 없었다.** 그러니 현장에 가면 금액이 달라질
//   수밖에 없고, 그 차이는 업체 탓이 아니라 요청서 탓이다.
//   (대표: 채팅에 사진을 올리게 해 둔 이유도 이것이다 — 다만 채팅은 «입찰한 뒤»라 늦다.)
//
// 어디에 담나: 새 칸·새 SQL 없이 requests.desc 안에 담는다.
//   desc 는 이미 «태그, 태그 — 메모» 모양을 쓰고 있고(splitDesc),
//   채팅 사진도 같은 방식으로 text 에 마커를 붙여 보낸다(CHAT_PHOTO_PREFIX "[[photo]]").
//   그 관습을 그대로 따른다 — 「앱 먼저(없으면 예전 방식) → SQL 나중」.
//   나중에 requests.photos 칸이 생기면 이 파일만 바꾸면 된다.
//
// 순수 JS — React·DOM 없음.

export const PHOTO_MARK = "[[photo]]";
export const MAX_REQUEST_PHOTOS = 5;   // 폰에서 한 줄에 보이는 수 · 업로드가 오래 걸리지 않는 수

const isPhotoLine = (l) => l.startsWith(PHOTO_MARK);
const urlOf = (l) => l.slice(PHOTO_MARK.length).trim();

// desc → { text(사람이 읽는 글), photos(주소 배열) }
// 마커 줄은 어디에 섞여 있어도 걷어낸다(업체 화면에 날주소가 보이면 안 된다).
export function splitPhotos(desc) {
  const lines = String(desc ?? "").split("\n");
  const photos = [];
  const rest = [];
  for (const l of lines) {
    const t = l.trim();
    if (isPhotoLine(t)) { const u = urlOf(t); if (u) photos.push(u); }
    else rest.push(l);
  }
  return { text: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim(), photos };
}

// { text, photos } → desc. 사진이 없으면 글 그대로(마커를 남기지 않는다).
export function joinPhotos(text, photos = []) {
  const body = String(text ?? "").trim();
  const list = (Array.isArray(photos) ? photos : [])
    .map(u => String(u ?? "").trim()).filter(Boolean).slice(0, MAX_REQUEST_PHOTOS);
  if (list.length === 0) return body;
  return [body, ...list.map(u => `${PHOTO_MARK}${u}`)].filter(Boolean).join("\n");
}

// 받침에 맞는 조사 — 「평수이(가)」처럼 적으면 사람이 쓴 글로 안 읽힌다.
export function josa(word, withBatchim, withoutBatchim) {
  const last = String(word ?? "").trim().slice(-1);
  const code = last.charCodeAt(0);
  if (!last || Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return withoutBatchim;
  return (code - 0xac00) % 28 === 0 ? withoutBatchim : withBatchim;
}

// ── 요청서가 얼마나 채워졌나 ────────────────────────────────────────────────
// 「견적이 왜 벌어지나」를 업체 탓으로 돌리지 않으려면, 고객에게 먼저 보여 줘야 한다.
// 점수를 매기지 않는다 — 「무엇이 비었는지」와 「채우면 무엇이 좋아지는지」만 말한다.
export function requestGaps(req = {}, photoCount = null) {
  const request = req ?? {};   // null 이 와도 깨지지 않게(기본값은 undefined 일 때만 걸린다)
  const { photos } = splitPhotos(request.desc ?? request.description ?? "");
  const n = photoCount == null ? photos.length : photoCount;
  const note = String(request.desc ?? request.description ?? "");
  const { text } = splitPhotos(note);

  const gaps = [];
  if (n === 0) gaps.push({ key: "photo", label: "현장 사진", why: "사진이 있으면 업체가 현장을 보지 않고도 훨씬 가깝게 잡습니다" });
  if (text.replace(/[^가-힣a-zA-Z0-9]/g, "").length < 10)
    gaps.push({ key: "scope", label: "어디를 어떻게", why: "「어디를 어디까지」가 적혀 있으면 빠진 공정이 줄어듭니다" });
  if (!request.size && !request.area) gaps.push({ key: "size", label: "평수", why: "평수는 금액을 가르는 첫 숫자입니다" });

  const labels = gaps.map(g => g.label).join(" · ");
  return {
    photoCount: n,
    gaps,
    filled: gaps.length === 0,
    // 고객에게 보일 한 줄 — 겁주지 않고, 다음에 할 일만
    line: gaps.length === 0
      ? "요청서가 잘 채워져 있어요. 업체가 같은 조건을 보고 견적을 냅니다."
      : `${labels}${josa(labels, "이", "가")} 비어 있어요. 채우면 견적이 서로 가까워집니다.`,
  };
}
