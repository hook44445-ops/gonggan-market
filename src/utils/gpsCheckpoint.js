// ─────────────────────────────────────────────────────
// GPS 체크포인트 증빙 상태 — 읽기/표시/검증 보강(무스키마 변경).
//
//   · GPS 누락 사유는 기존 project_checkpoints.note 컬럼에 마커로 기록한다
//     (DB 구조 변경/마이그레이션 없음 — note text 컬럼은 032/034 에 이미 존재).
//   · gps_status / 증빙 결합상태는 저장값이 아니라 읽을 때 파생한다.
//   · GPS·사진·시간은 같은 checkpoint row(lat/lng/photos/captured_at)에 묶여 있다.
// ─────────────────────────────────────────────────────

export const GPS_MISSING_PREFIX = "[GPS_MISSING]";

// 사유를 note 에 구조적으로 기록(파싱 가능한 접두어 + 자유 사유).
export const buildGpsMissingNote = (reason) =>
  `${GPS_MISSING_PREFIX} ${String(reason ?? "").trim()}`.trim();

// note 에서 GPS 누락 사유만 추출(없으면 null).
export const parseGpsMissingReason = (note) => {
  if (typeof note !== "string") return null;
  const i = note.indexOf(GPS_MISSING_PREFIX);
  if (i < 0) return null;
  const r = note.slice(i + GPS_MISSING_PREFIX.length).trim();
  return r || null;
};

export const hasGpsCoords = (cp) => !!cp && cp.lat != null && cp.lng != null;

// photos(text[]) 또는 photo_urls 둘 다 대응(조회 경로별 필드명 차이 흡수).
export const checkpointPhotoCount = (cp) =>
  Array.isArray(cp?.photos) ? cp.photos.length
  : Array.isArray(cp?.photo_urls) ? cp.photo_urls.length
  : 0;

// 단일 체크포인트의 증빙 상태(읽기 전용 파생).
//   gpsStatus : recorded | missing_with_reason | missing_without_reason
//   combined  : complete(GPS+사진) | gps_only | photo_only | none
export const checkpointEvidenceStatus = (cp) => {
  const gps = hasGpsCoords(cp);
  const photos = checkpointPhotoCount(cp);
  const reason = parseGpsMissingReason(cp?.note);
  const gpsStatus = gps ? "recorded" : (reason ? "missing_with_reason" : "missing_without_reason");
  let combined;
  if (gps && photos > 0) combined = "complete";
  else if (gps && photos === 0) combined = "gps_only";
  else if (!gps && photos > 0) combined = "photo_only";
  else combined = "none";
  return { gps, photos, reason, gpsStatus, combined };
};

// 관리자 증빙 라벨(✅/⚠️/❌) — 결합상태 + 사유 유무 반영.
export const checkpointEvidenceBadge = (cp) => {
  const { combined, reason } = checkpointEvidenceStatus(cp);
  switch (combined) {
    case "complete":   return { icon: "✅", label: "GPS+사진 완료", tone: "ok" };
    case "gps_only":   return { icon: "⚠️", label: "GPS 있음 / 사진 없음", tone: "warn" };
    case "photo_only": return { icon: "⚠️", label: "GPS 없음 / 사진 있음", tone: "warn" };
    default:           return reason
      ? { icon: "⚠️", label: "GPS 누락 / 사유 있음", tone: "warn" }
      : { icon: "❌", label: "GPS 누락 / 사유 없음", tone: "bad" };
  }
};
