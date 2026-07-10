// ════════════════════════════════════════════════════════════════════
// 공간라운지 Cron Run-Guard — KST(Asia/Seoul) 5분 슬롯 계산 (Phase 39)
//
//   외부 스케줄러가 5분마다 호출할 때, 응답/로깅용 idempotent 슬롯 키를 만든다.
//   ⚠️ 실제 중복 방지는 이 키가 아니라 DB 상태로 보장한다:
//      · 생성 중복 방지 → filterNewTopics(ai_topic 48h 중복 제거) + 하루 목표 상한
//      · 발행 중복 방지 → publish_status='scheduled' 인 행만 published 로 전환(재실행해도 무해)
//   따라서 서버측 영속 저장(=DB 스키마 변경) 없이도 재호출이 자연히 idempotent 하다.
//   ⚠️ 서버 안전(브라우저 API/ localStorage 미사용). Regression Zero.
// ════════════════════════════════════════════════════════════════════

const KST_OFFSET_MS = 9 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, "0");

// KST 벽시계를 UTC 필드로 담은 Date(계산 편의용 — getUTC* 로 KST 값을 읽는다).
export function kstWall(now = Date.now()) {
  return new Date(now + KST_OFFSET_MS);
}

export function kstParts(now = Date.now()) {
  const d = kstWall(now);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
  };
}

// KST 날짜 키(YYYY-MM-DD).
export function kstDateKey(now = Date.now()) {
  const p = kstParts(now);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

// KST 5분 슬롯 키(YYYY-MM-DDTHH:MMKST, MM 은 0/5/10.. 로 내림).
export function slotKey(now = Date.now()) {
  const p = kstParts(now);
  const slot5 = Math.floor(p.mi / 5) * 5;
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(slot5)}KST`;
}

// KST 자정에 해당하는 UTC ISO(오늘 생성분 집계용 경계).
export function kstMidnightUtcIso(now = Date.now()) {
  const d = kstWall(now);
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) - KST_OFFSET_MS;
  return new Date(ms).toISOString();
}

// KST 시각을 +09:00 표기 ISO 문자열로(응답 표시용).
export function kstIso(now = Date.now()) {
  const d = kstWall(now);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+09:00`;
}
