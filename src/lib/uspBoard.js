// USP 12 «사용 → 전환» 기록(2026-10-01 · docs/USP-2026-10-01.md · SQL 187 admin_usp_board).
//
//   «사용»  — 그 USP 가 실제로 쓰였다. 화면에서만 일어나는 것(비교표·시세를 봄 · 공유)은 앱이 activity_logs 에
//             action «usp_<번호>» 로 남기고(trackUsp), 나머지는 이미 DB 에 있는 사실(사진 붙은 요청 · 포함 항목 적은 입찰 …)로 센다.
//   «전환»  — 그 다음 단계로 넘어갔다(요청 · 입찰 받음 · 업체 선택 · 계약 · 다시 방문 · 초대 가입). 전부 서버가 DB 사실로 센다.
//   «비교»  — 그 USP 를 «안 쓴 쪽»의 전환율. 차이가 USP 의 힘이다(없으면 —).
// 순수 JS — React·DB 없음(화면·테스트가 같이 쓴다).

export const USP_LIST = [
  { id: 1,  who: "고객", label: "30초 요청서",        used: "랜딩에서 고르고 로그인",       conv: "3일 안에 요청 보냄",        base: "새 가입자의 요청률" },
  { id: 2,  who: "고객", label: "현장 사진",          used: "사진 붙은 요청",               conv: "입찰 1곳 이상 받음",        base: "사진 없는 요청" },
  { id: 3,  who: "고객", label: "견적 나란히 비교표",  used: "비교표를 본 요청",             conv: "업체 선택",                 base: "견적 2곳+ · 표 안 본 요청" },
  { id: 4,  who: "고객", label: "우리 동네 평당 시세", used: "시세 줄을 본 요청",            conv: "업체 선택",                 base: "견적 1곳+ · 시세 안 본 요청" },
  { id: 5,  who: "고객", label: "증빙 배지",          used: "증빙 1개+ 업체의 입찰",         conv: "선택됨",                    base: "증빙 없는 업체의 입찰" },
  { id: 6,  who: "고객", label: "사업자 확인 업체와만 계약", used: "업체를 고른 요청",       conv: "계약 기록까지",             base: null },
  { id: 7,  who: "고객", label: "포함 항목 · 추가금 기록", used: "포함 항목을 적은 입찰",     conv: "선택됨",                    base: "포함 항목 안 적은 입찰" },
  { id: 8,  who: "고객", label: "공사 기록 · 집 관리 수첩", used: "수첩에 적은 사람",         conv: "다른 날 다시 방문",         base: null },
  { id: 9,  who: "업체", label: "월요일 동네 요청 알림", used: "알림 받은 업체",              conv: "7일 안에 입찰",             base: null },
  { id: 10, who: "업체", label: "«고객이 내 견적 확인» 알림", used: "알림 받은 업체",         conv: "14일 안에 다른 요청에 입찰", base: null },
  { id: 11, who: "업체", label: "증빙만큼 커지는 한도", used: "승인된 서류가 있는 업체",      conv: "기간 안에 입찰",            base: "승인 서류 없는 업체" },
  { id: 12, who: "업체", label: "공유(페이지·카드·QR·초대)", used: "공유한 사람",              conv: "초대로 1명+ 가입",          base: null },
  // 공간라운지(docs/LOUNGE-USP-2026-10-01.md 5절 · SQL 188 admin_lounge_usp_rows)
  { id: 13, who: "라운지", label: "라운지 → 견적",      used: "글에서 견적 링크 누른 사람",   conv: "3일 안 요청",               base: null },
  { id: 14, who: "라운지", label: "사람이 쓴 글",        used: "라운지 글",                    conv: "사람 글(운영 글 아님)",     base: null },
  { id: 15, who: "라운지", label: "업체 참여",          used: "글·답을 쓴 업체",              conv: "미니 포트폴리오가 열린 업체", base: null },
];

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
export const rate = (conv, used) => {
  const c = num(conv), u = num(used);
  return c == null || !u ? null : Math.round((c / u) * 100);
};

// 서버 결과(배열 [{ usp, used, converted, base_used, base_converted }]) → 화면 줄 12개.
//   서버에 없는 줄(그 표가 운영에 없음 · 계산 실패)은 숫자 대신 «—»(null).
export function uspRows(data) {
  const byId = new Map((Array.isArray(data) ? data : []).map((r) => [Number(r?.usp), r]));
  return USP_LIST.map((u) => {
    const r = byId.get(u.id) ?? {};
    const used = num(r.used), converted = num(r.converted);
    const baseRate = u.base ? rate(r.base_converted, r.base_used) : null;
    const r1 = rate(converted, used);
    return {
      id: u.id, who: u.who, label: u.label,
      usedLabel: u.used, convLabel: u.conv, baseLabel: u.base,
      used, converted, rate: r1, baseRate,
      baseUsed: u.base ? num(r.base_used) : null,
      // 비교가 있으면 몇 %p 차이인지 — USP 가 힘이 있는지 한눈에
      lift: r1 != null && baseRate != null ? r1 - baseRate : null,
    };
  });
}

// 표 위 한 줄 — 가장 강한 것·약한 것(표본 5 이상만 · 지어낸 판단 없이 숫자로만)
export function uspSummary(rows, minSample = 5) {
  // 라운지 줄(13~15)은 «전환»이 아니라 건강 지표(사람 글 비율 등)라 강·약 비교에서 뺀다
  const ok = (rows ?? []).filter((r) => r.who !== "라운지" && r.rate != null && (r.used ?? 0) >= minSample);
  if (!ok.length) return "아직 표본이 적어요 — USP 마다 «사용» 5건이 넘으면 강한 것·약한 것을 보여 드려요.";
  const sorted = [...ok].sort((a, b) => b.rate - a.rate);
  const top = sorted[0], low = sorted[sorted.length - 1];
  return top === low
    ? `${top.label} — 전환 ${top.rate}%`
    : `가장 잘 넘어가는 것: ${top.label} ${top.rate}% · 가장 약한 것: ${low.label} ${low.rate}%`;
}

// 같은 화면을 여러 번 열어도 한 번만 남긴다(USP · 대상 · 한국 날짜)
export function uspDedupKey(uspId, targetId = null, now = Date.now()) {
  const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  return `gonggan_usp:${uspId}:${targetId ?? "-"}:${day}`;
}

// 앱이 직접 남기는 USP(나머지는 DB 사실로 센다)
export const TRACKED_USPS = [1, 3, 4, 12, 13, 15];
export const uspAction = (uspId) => `usp_${Number(uspId)}`;
