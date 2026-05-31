// ─────────────────────────────────────────────────────
// 테스트/더미 데이터 필터링 유틸 (DB 직접 삭제 대신 노출 단계에서 차단)
// - is_test / is_sample 플래그 우선
// - 깨진/무의미 텍스트(자모 깨짐, 숫자만 제목, 모음 없는 난수 문자열) 차단
// ─────────────────────────────────────────────────────

// 깨진/더미 텍스트 여부
export function isJunkText(s) {
  if (s == null) return false;
  const t = String(s).trim();
  if (!t) return false;
  // 한글 자모(ㄱ-ㅎ, ㅏ-ㅣ)만으로 구성 — 정상 단어 아님 (예: "ㅁㄴㅇㄹ")
  if (/^[㄰-㆏\s]+$/.test(t)) return true;
  // 숫자만 (예: 라운지 제목 "11")
  if (/^\d+$/.test(t)) return true;
  // 모음 비율이 비정상적으로 낮은 긴 영문 (예: "Rntjrjrjj")
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiou]/gi) || []).length;
    if (vowels / letters.length < 0.15) return true;
  }
  return false;
}

// 테스트/샘플 플래그
export function isTestRecord(row) {
  return !!(row && (row.is_test || row.is_sample || row.isTest || row.isSample));
}

// 후기 노출 가능 여부 (테스트 플래그 / 깨진 텍스트 차단)
export function isDisplayableReview(row) {
  if (isTestRecord(row)) return false;
  const text = typeof row === "string" ? row : (row?.content ?? row?.text ?? "");
  return !isJunkText(text);
}

// 라운지 글 노출 가능 여부 (테스트 플래그 / 깨진 제목·내용 차단)
export function isDisplayableLoungePost(post) {
  if (isTestRecord(post)) return false;
  if (isJunkText(post?.title)) return false;
  return true;
}

// 견적/입찰 금액(만원) 노출 가능 여부 — 1,000원(=0.1만원) 미만 더미 제외
export function isDisplayableBidAmount(priceManwon) {
  const n = Number(priceManwon);
  if (!Number.isFinite(n)) return false;
  return n >= 0.1;
}
