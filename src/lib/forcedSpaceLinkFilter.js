// ════════════════════════════════════════════════════════════════════
// 공간라운지 Forced Space Link Filter (Phase 8)
//
//   Space is Everything 은 플랫폼의 "철학"이지 모든 문장에 붙이는 상투구가 아니다.
//   "결국 이것도 공간입니다" / "연애도 공간에서 시작됩니다" / "주식도 공간과 연결됩니다"
//   같은 억지 연결 문장을 감지하고, 자연스럽지 않으면 제거한다.
//
//   결정론적 · 순수 함수 · 저장/Migration 없음. 생성기(writer)와 관리자 미리보기가 함께 쓴다.
// ════════════════════════════════════════════════════════════════════

// 억지 공간 연결로 판정하는 패턴들(상투적 끼워맞춤 문장).
const FORCED_PATTERNS = [
  /결국\s*(이것도|이 역시|모든\s*것은|우리)?\s*공간/,
  /이것도\s*결국\s*공간/,
  /(도|역시)\s*공간(에서|에서부터)\s*시작/,
  /공간(과|와)\s*(연결|맞닿|이어져|통한다|통합니다)/,
  /사실\s*.*공간.*(맞닿|이야기)/,
  /공간이?\s*(라는\s*)?관점에서\s*다시\s*보/,
  /공간의?\s*(문제|이야기)로\s*(돌아|귀결|이어)/,
  /남의?\s*이야기가?\s*아니라.*공간/,
  /space\s+is\s+everything/i,
];

const SENTENCE_SPLIT = /(?<=[.!?。…])\s+/;

function isForcedSentence(sentence) {
  const s = String(sentence ?? "");
  if (!s.includes("공간") && !/space is everything/i.test(s)) return false;
  return FORCED_PATTERNS.some((re) => re.test(s));
}

// 본문에서 억지 공간 연결 문장/헤딩을 찾아낸다. 반환: [{ line, text }]
export function detectForcedSpaceLinks(text = "") {
  const found = [];
  const lines = String(text).split("\n");
  lines.forEach((line, i) => {
    const bare = line.replace(/^#{1,6}\s+/, "").trim();
    if (!bare) return;
    // 헤딩 자체가 억지 연결이거나, 문장 중 하나가 억지 연결이면 수집.
    if (isForcedSentence(bare)) { found.push({ line: i, text: bare }); return; }
    for (const sent of bare.split(SENTENCE_SPLIT)) {
      if (isForcedSentence(sent)) { found.push({ line: i, text: sent.trim() }); break; }
    }
  });
  return found;
}

// 억지 공간 연결 문장을 제거하고 정리한 본문을 돌려준다.
//   헤딩이 억지 연결이면 그 헤딩 줄을 통째로 제거, 문단 안이면 해당 문장만 제거.
//   반환: { text, removed }
export function stripForcedSpaceLinks(text = "") {
  let removed = 0;
  const out = [];
  for (const line of String(text).split("\n")) {
    const isHeading = /^#{1,6}\s+/.test(line);
    const bare = line.replace(/^#{1,6}\s+/, "");
    if (isHeading && isForcedSentence(bare.trim())) { removed += 1; continue; } // 억지 헤딩 제거
    if (!line.trim()) { out.push(line); continue; }

    const kept = [];
    for (const sent of line.split(SENTENCE_SPLIT)) {
      if (sent.trim() && isForcedSentence(sent)) { removed += 1; continue; }
      kept.push(sent);
    }
    const rebuilt = kept.join(" ").replace(/\s{2,}/g, " ").trimEnd();
    if (rebuilt.trim() || isHeading) out.push(rebuilt);
  }
  // 연속 빈 줄 정리.
  const text2 = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: text2, removed };
}

// 억지 연결 강도(0~100, 높을수록 나쁨) — 문장 수 대비 억지 연결 비율.
export function forcedLinkSeverity(text = "") {
  const total = String(text).split(SENTENCE_SPLIT).filter((s) => s.trim()).length || 1;
  const forced = detectForcedSpaceLinks(text).length;
  return Math.min(100, Math.round((forced / total) * 100) + forced * 8);
}
