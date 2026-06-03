// ─────────────────────────────────────────────────────
// richText — 라운지 운영(SEO) 장문 콘텐츠 렌더링
//   본문에 마크다운 느낌의 구조 표기를 쓰면 소제목/목록으로 렌더한다.
//     "## 제목"  → H2 느낌 소제목
//     "### 제목" → H3 느낌 소제목
//     "- 항목"   → 글머리 목록
//     빈 줄       → 문단 간격
//     그 외       → 일반 문단
//   일반 사용자 글(마커 없음)은 그대로 문단으로 자연스럽게 렌더된다.
// ─────────────────────────────────────────────────────
import { C, S } from '../constants';

// 카드 미리보기용 — 마커/줄바꿈 제거한 한 줄 요약 텍스트
export function plainExcerpt(content = '') {
  return String(content)
    .replace(/^#{1,6}\s+/gm, '')   // 소제목 마커 제거
    .replace(/^[-•]\s+/gm, '')      // 목록 마커 제거
    .replace(/\*\*(.+?)\*\*/g, '$1') // 굵게 마커 제거
    .replace(/\s*\n+\s*/g, ' ')     // 줄바꿈 → 공백
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 인라인 **굵게** 처리
function renderInline(text, keyBase) {
  const parts = String(text).split(/(\*\*.+?\*\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*(.+?)\*\*$/);
    if (m) return <strong key={`${keyBase}-b${i}`} style={{ fontWeight: 800, color: C.text1 }}>{m[1]}</strong>;
    return <span key={`${keyBase}-t${i}`}>{p}</span>;
  });
}

export function RichContent({ content = '', baseSize = 14 }) {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let bullets = [];

  const flushBullets = (key) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`} style={{ margin: '6px 0 14px', paddingLeft: 20, color: C.text2, fontSize: baseSize, lineHeight: 1.8 }}>
        {bullets.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{renderInline(b, `li-${key}-${i}`)}</li>)}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushBullets(idx);
      blocks.push(
        <div key={idx} style={{ fontSize: baseSize + 1, fontWeight: 700, color: C.text1, margin: '16px 0 6px', lineHeight: 1.5 }}>
          {line.replace(/^###\s+/, '')}
        </div>
      );
    } else if (/^##\s+/.test(line)) {
      flushBullets(idx);
      blocks.push(
        <div key={idx} style={{ fontSize: baseSize + 3, fontWeight: 800, color: C.text1, margin: '22px 0 8px', lineHeight: 1.45, letterSpacing: '-0.3px' }}>
          {line.replace(/^##\s+/, '')}
        </div>
      );
    } else if (/^[-•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-•]\s+/, ''));
    } else if (line.trim() === '') {
      flushBullets(idx);
      blocks.push(<div key={idx} style={{ height: S.sm }} />);
    } else {
      flushBullets(idx);
      blocks.push(
        <p key={idx} style={{ fontSize: baseSize, color: C.text2, lineHeight: 1.8, margin: '0 0 10px' }}>
          {renderInline(line, `p-${idx}`)}
        </p>
      );
    }
  });
  flushBullets('end');

  return <div>{blocks}</div>;
}
