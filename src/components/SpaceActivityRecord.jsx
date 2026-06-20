import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { getSpaceActivityRecord } from "../lib/spaceActivity";

// ════════════════════════════════════════════════════════════════════════════
// SpaceActivityRecord — "공간 활동기록" 읽기 전용 UI (v5.4.0 · Additive)
//   라운지 프로필 / 업체 상세 / 업체 대시보드에서 재사용.
//   · 실데이터만 표시(Mock 금지). 데이터 없으면 빈 상태 안내 문구.
//   · 등급/랭킹/TOP/순위/레벨/배틀 표현 금지 — 성장·기록 중심.
//   props:
//     - ownerId   : 라운지 작성자(users.id) — 라운지 답변/시공사례 집계용
//     - companyId : 업체(companies.id) — 프로젝트 완료/견적 응답/리뷰 집계용
//     - title     : 섹션 제목(기본 "공간 활동기록")
//     - selfView  : 업체 본인 화면이면 안내 문구를 본인 시점으로
//     - compact   : 입찰/요약용 한 줄 표기
// ════════════════════════════════════════════════════════════════════════════

const daysAgoLabel = (iso) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "오늘";
  if (d === 1) return "어제";
  if (d < 30) return `${d}일 전`;
  if (d < 365) return `${Math.floor(d / 30)}개월 전`;
  return `${Math.floor(d / 365)}년 전`;
};

const ymdLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default function SpaceActivityRecord({
  ownerId = null, companyId = null, title = "공간 활동기록", selfView = false, compact = false,
}) {
  const [rec, setRec] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!ownerId && !companyId) { setRec({ loaded: true, isEmpty: true }); return; }
    getSpaceActivityRecord({ ownerId, companyId, countsOnly: compact })
      .then((r) => { if (alive) setRec(r); })
      .catch(() => { if (alive) setRec({ loaded: true, isEmpty: true }); });
    return () => { alive = false; };
  }, [ownerId, companyId, compact]);

  // ── compact(입찰 카드 요약) ────────────────────────────────────────────────
  if (compact) {
    if (!rec?.loaded || rec.isEmpty) return null; // 실데이터 없으면 표기 생략(꾸미지 않음)
    const parts = [];
    if (rec.projectsCompleted) parts.push(`프로젝트 ${rec.projectsCompleted}`);
    if (rec.bidResponses) parts.push(`견적응답 ${rec.bidResponses}`);
    if (rec.reviews) parts.push(`리뷰 ${rec.reviews}`);
    if (!parts.length) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.text3, fontWeight: 600 }}>
        <span style={{ color: C.brand, fontWeight: 800 }}>공간 활동</span>
        <span>{parts.join(" · ")}</span>
      </div>
    );
  }

  const wrap = {
    background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl,
    padding: S.xl, marginBottom: S.lg,
  };

  if (!rec?.loaded) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 6 }}>📌 {title}</div>
        <div style={{ fontSize: 13, color: C.text3, padding: "10px 0" }}>불러오는 중...</div>
      </div>
    );
  }

  // ── 빈 상태(실데이터 없음) — 숫자 꾸미지 않고 안내만 ──────────────────────────
  if (rec.isEmpty) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 8 }}>📌 {title}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text2, marginBottom: 6 }}>
          아직 활동기록이 없습니다.
        </div>
        <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.7 }}>
          {selfView ? "첫 견적 응답부터 활동기록이 쌓입니다." : "첫 견적 응답부터 활동기록이 쌓입니다."}<br />
          프로젝트 완료, 리뷰, 라운지 답변이 쌓이면 이곳에 표시됩니다.
        </div>
      </div>
    );
  }

  // Phase 4-1: 시공 활동 / 커뮤니티 활동 두 그룹으로 구분(표시만 · 집계 로직 동일).
  const constructionMetrics = [
    ["프로젝트 완료", rec.projectsCompleted, "건"],
    ["견적 응답",     rec.bidResponses,      "회"],
    ["리뷰",          rec.reviews,           "개"],
    ["시공사례",      rec.constructionCases, "건"],
  ];
  const communityMetrics = [
    ["라운지 답변",   rec.loungeAnswers,     "개"],
    ["라운지 게시글", rec.loungePosts ?? 0,  "개"],
    ["받은 좋아요",   rec.likesReceived ?? 0, "개"],
  ];

  // 전문가(업체) 부가 정보 — 전문가 계정(companyId)일 때, 실데이터가 있을 때만 표시.
  const hasExpertInfo = (rec.avgRating != null) || ((rec.specialties?.length ?? 0) > 0);
  // 공통 메타 — 가입일/최근 활동일(실데이터 있을 때만)
  const metaBits = [];
  if (rec.joinedAt) metaBits.push(`가입 ${ymdLabel(rec.joinedAt)}`);
  if (rec.lastActivityAt) metaBits.push(`최근 활동 ${daysAgoLabel(rec.lastActivityAt)}`);

  return (
    <div style={wrap}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>📌 {title}</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: metaBits.length ? 4 : S.md, lineHeight: 1.6 }}>
        {selfView
          ? "성실한 활동이 기록으로 쌓이고, 더 많은 상담과 프로젝트로 이어집니다."
          : "순위가 아닌 활동 기록입니다. 성실한 활동이 신뢰가 됩니다."}
        {selfView && <><br />꾸준한 활동은 업체 신뢰도와 추천 품질 향상에 도움이 됩니다.</>}
      </div>
      {metaBits.length > 0 && (
        <div style={{ fontSize: 11.5, color: C.text4, marginBottom: S.md }}>{metaBits.join(" · ")}</div>
      )}

      {/* 전문가 추가 정보 — 평균 평점 · 전문분야 (실데이터만, 전문가 계정 한정) */}
      {hasExpertInfo && (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
          background: C.brandL, borderRadius: R.lg, padding: `${S.sm}px ${S.md}px`, marginBottom: S.md,
        }}>
          {rec.avgRating != null && (
            <span style={{ fontSize: 12.5, fontWeight: 800, color: C.brand }}>
              ⭐ 평균 {rec.avgRating.toFixed(1)}점
            </span>
          )}
          {(rec.specialties?.length ?? 0) > 0 && rec.avgRating != null && (
            <span style={{ fontSize: 11, color: C.text4 }}>·</span>
          )}
          {(rec.specialties ?? []).slice(0, 4).map((s) => (
            <span key={s} style={{
              fontSize: 11, fontWeight: 700, color: C.text2, background: C.surface,
              border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "2px 9px",
            }}>#{s}</span>
          ))}
        </div>
      )}

      {/* 지표 타일 — 🏗 시공 활동 / 🤝 커뮤니티 활동 (집계 동일 · 그룹 표시만) */}
      {(() => {
        const Tile = ([label, val, unit]) => (
          <div key={label} style={{
            background: C.surface2 ?? C.bgWarm, borderRadius: R.lg,
            padding: `${S.md}px ${S.sm}px`, textAlign: "center", border: `1px solid ${C.bgWarm}`,
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>
              {val}<span style={{ fontSize: 11, fontWeight: 700, color: C.text3 }}>{unit}</span>
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{label}</div>
          </div>
        );
        const GroupTitle = ({ children }) => (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text2, margin: `${S.sm}px 0 6px` }}>{children}</div>
        );
        return (
          <div style={{ marginBottom: S.md }}>
            <GroupTitle>🏗 시공 활동</GroupTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: S.sm }}>
              {constructionMetrics.map(Tile)}
            </div>
            <GroupTitle>🤝 커뮤니티 활동</GroupTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: S.sm }}>
              {communityMetrics.map(Tile)}
            </div>
          </div>
        );
      })()}

      {/* 최근 활동 */}
      {rec.recent?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text2, margin: `${S.sm}px 0 6px` }}>최근 활동</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rec.recent.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: C.brand, flexShrink: 0 }}>✔</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, color: C.brand, background: C.brandL,
                  borderRadius: R.full, padding: "2px 8px", flexShrink: 0,
                }}>{it.type}</span>
                <span style={{ fontSize: 12.5, color: C.text2, flex: 1, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                <span style={{ fontSize: 11, color: C.text4, flexShrink: 0 }}>{daysAgoLabel(it.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
