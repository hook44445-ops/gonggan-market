// ════════════════════════════════════════════════════════════════════
// 조명 — 견적 요청부터 공사 진행까지 (09-26 대표 「견적 요청하고 진행하는 과정에서 조명 추가」)
//
//   · 요청서: 「조명·전기」를 고르면 «어떤 조명?»을 칩으로 더 고른다 → 요청 설명에 「조명: 매입등·간접조명」 한 줄.
//     (요청 설명 첫 줄 「도배, 바닥 — …」 모양은 그대로 — 업체 화면·견적 칩(finalQuote) 이 읽는 모양을 안 바꾼다)
//   · 업체 최종 견적: 공정 칩에 «조명»이 기본으로(예전엔 «전기»만) · 요청에 간접조명·매입등이 있으면 그 칩도.
//   · 공사 진행: 요청에 조명이 있으면 착공·중간·완료 확인 때 «조명 확인 포인트»를 보여 준다
//     — 조명은 천장이 닫히면 위치를 못 바꾼다. 중간 점검이 마지막 기회라는 걸 고객이 알게.
//   ⚠️ 순수 데이터·함수. 가격·효과 단정 없음.
// ════════════════════════════════════════════════════════════════════

export const LIGHT_OPTIONS = ["매입등", "간접조명", "펜던트", "레일조명", "등 교체만", "스위치·콘센트", "스마트 조명"];

/** 천장 목공이 함께 들어가기 쉬운 것 — 요청서에서 한 줄 안내 */
export const LIGHT_NEEDS_CARPENTRY = ["매입등", "간접조명"];

const LINE_RE = /^조명:\s*([^\n]*)\n?/;

/** 요청 설명의 «더 알려 줄 것» 부분에서 조명 줄을 떼어 낸다 → { light: [...], rest } */
export function splitLight(note) {
  const s = String(note ?? "");
  const m = s.match(LINE_RE);
  if (!m) return { light: [], rest: s };
  const light = m[1].split(/,\s*/).map((x) => x.trim());
  return { light: LIGHT_OPTIONS.filter((o) => light.includes(o)), rest: s.slice(m[0].length) };
}

/** 조명 줄 + 나머지 메모 → «더 알려 줄 것» */
export function joinLight(light = [], rest = "") {
  const r = String(rest ?? "").trim();
  if (!light.length) return r;
  return `조명: ${light.join(", ")}${r ? `\n${r}` : ""}`;
}

/** 요청(설명·공사 유형)에 조명 공사가 있나 */
export function requestHasLighting(request) {
  const hay = [request?.description, request?.desc, request?.detail, request?.work_types, request?.space_type]
    .flat().filter(Boolean).join(" ");
  return /조명|매입등|간접조명|펜던트|레일조명|다운라이트/.test(hay);
}

/** 단계 번호(3 착공 · 4 중간 · 5 완료) → 고객이 볼 조명 확인 포인트 */
export const LIGHT_CHECK = {
  3: ["조명 위치·개수를 업체와 한 번 더 맞추기(천장 타공 전)", "스위치로 켤 묶음(거실 전체 / 식탁만 등) 정하기", "색온도(전구색·주백색·주광색)를 공간별로 정하기"],
  4: ["천장이 닫히기 전 마지막 확인 — 배선·타공 위치가 원하는 자리인지", "스위치·콘센트 위치와 높이", "간접조명 라인·매입등 간격이 도면과 같은지"],
  5: ["모든 등이 켜지는지, 깜빡임·소음이 없는지", "같은 공간의 색온도가 섞이지 않았는지", "스위치가 맞는 등을 켜는지 · 밝기 조절(디머)·스마트 조명 동작", "등기구 보증서·여분 부품 받기"],
};
