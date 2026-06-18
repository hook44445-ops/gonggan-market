import { useEffect, useMemo, useState } from "react";
import { C, R, S, SHADOW } from "../constants";
import { getRepresentativePhotosByContracts } from "../lib/supabase";

// ════════════════════════════════════════════════════════════════════════════
// SpaceHistoryScreen — "공간 이력"(Space History · Additive · 읽기 전용)
//   거래가 끝나는 것이 아니라 공간의 기억이 시작되는 구조.
//   · 기존 데이터만 재사용: myRequests / myRequestsEscrow / companies / phase_photos
//   · 완료(정산) 프로젝트만 시간순 타임라인으로 표시. Mock/더미 금지.
//   · 데이터 없으면 "아직 공간 이력이 없습니다."
//   표시: 공사일(완료일) · 공사 종류 · 업체명 · 상태 · 대표 시공사진 1장 · 리뷰 여부 · 프로젝트 보기
// ════════════════════════════════════════════════════════════════════════════

const DEEP_GREEN = "#1E3D2F";

const fmtYearMonth = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// 완료(정산) 판정 — 홈/마이의 isRequestSettled 와 동일 신호만 사용(분류 전용, 결제 로직 무관).
const isSettled = (r, escrowData) => {
  if (r?.hasReview === true) return true;
  const escrow = escrowData?.escrow ?? null;
  if (escrow) {
    const tx = escrow.transaction_status;
    if (tx === "SETTLED" || tx === "COMPLETED") return true;
    const payout4 = (escrowData?.payouts ?? []).find((p) => p.stage === 4);
    if (payout4?.status === "APPROVED") return true;
  }
  return r?.status === "completed" || r?.status === "settled";
};

// 완료일 추정 — 완료 단계 승인 시각 → 정산 시각 → 요청 생성일 순(실데이터만).
const completedAt = (r, escrowData) => {
  const escrow = escrowData?.escrow ?? null;
  const payout4 = (escrowData?.payouts ?? []).find((p) => p.stage === 4);
  return (
    escrow?.step4_approved_at ||
    payout4?.approved_at ||
    escrow?.updated_at ||
    r?.createdAt ||
    null
  );
};

export default function SpaceHistoryScreen({
  myRequests = [], myRequestsEscrow = {}, companies = [], onBack, onOpenContract,
}) {
  const [photoMap, setPhotoMap] = useState({}); // { [contractId]: 대표사진URL }

  // 완료 프로젝트만 시간순(과거→현재) 정렬
  const items = useMemo(() => {
    return myRequests
      .map((r) => {
        const escrowData = myRequestsEscrow[r.id] ?? null;
        return { r, escrowData, at: completedAt(r, escrowData) };
      })
      .filter(({ r, escrowData }) => isSettled(r, escrowData))
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  }, [myRequests, myRequestsEscrow]);

  // 업체명 — escrow/선택입찰의 company_id(=users.id) 를 companies 목록에서 매칭(추가 쿼리 없음).
  const companyName = (r, escrowData) => {
    const cid =
      escrowData?.escrow?.company_id ||
      (r.bids ?? []).find((b) => b.selected || b.status === "selected")?.company_id ||
      null;
    if (!cid) return null;
    const co = (companies ?? []).find((c) => c.id === cid || c.ownerId === cid);
    return co?.name ?? null;
  };

  // 대표 시공사진 — 완료 계약들의 contract_id 로 한 번에 조회(읽기 전용, 1쿼리).
  useEffect(() => {
    let alive = true;
    const contractIds = items
      .map(({ escrowData }) => escrowData?.escrow?.id)
      .filter(Boolean);
    if (contractIds.length === 0) { setPhotoMap({}); return; }
    getRepresentativePhotosByContracts(contractIds)
      .then((map) => { if (alive) setPhotoMap(map ?? {}); })
      .catch(() => { if (alive) setPhotoMap({}); });
    return () => { alive = false; };
  }, [items]);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
        <button onClick={onBack} aria-label="뒤로가기"
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>공간 이력</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>완료된 공사가 공간의 기억으로 쌓입니다</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ background: C.ivory, borderRadius: R.xl, padding: "48px 20px",
          textAlign: "center", border: `1px solid ${C.bgWarm}`, boxShadow: SHADOW.soft }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 6 }}>아직 공간 이력이 없습니다.</div>
          <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.7 }}>
            첫 시공을 완료하면 공사 이력이 이곳에 자동으로 쌓입니다.
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {items.map(({ r, escrowData }, i) => {
            const cid = escrowData?.escrow?.id ?? null;
            const photo = cid ? photoMap[cid] : null;
            const name = companyName(r, escrowData);
            const reviewed = r?.hasReview === true || (r?.reviews?.length ?? 0) > 0;
            const last = i === items.length - 1;
            return (
              <div key={r.id} style={{ display: "flex", gap: S.md }}>
                {/* 타임라인 레일 */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
                  <div style={{ width: 12, height: 12, borderRadius: R.full, background: C.brand, marginTop: 6, border: `2px solid ${C.brandL}` }} />
                  {!last && <div style={{ width: 2, flex: 1, background: C.bgWarm, marginTop: 4 }} />}
                </div>

                {/* 이력 카드 */}
                <div style={{ flex: 1, background: C.surface, borderRadius: R.xl, overflow: "hidden",
                  border: `1px solid ${C.bgWarm}`, marginBottom: S.lg, boxShadow: SHADOW.soft }}>
                  {photo && (
                    <img src={photo} alt="시공 사진" loading="lazy"
                      style={{ width: "100%", height: 168, objectFit: "cover", display: "block" }} />
                  )}
                  <div style={{ padding: `${S.md}px ${S.lg}px ${S.lg}px` }}>
                    <div style={{ fontSize: 12, color: C.brand, fontWeight: 800, marginBottom: 4 }}>
                      {fmtYearMonth(completedAt(r, escrowData)) || "완료"}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
                      {[r.area, r.type].filter(Boolean).join(" · ") || "시공 완료"}
                    </div>
                    {name && (
                      <div style={{ fontSize: 12.5, color: C.text3, marginBottom: S.sm }}>💼 {name}</div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.md }}>
                      <span style={{ background: C.brandL, color: DEEP_GREEN, borderRadius: R.full,
                        padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>✓ 완료</span>
                      <span style={{ background: reviewed ? C.brandL : C.bgWarm,
                        color: reviewed ? DEEP_GREEN : C.text3, borderRadius: R.full,
                        padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        {reviewed ? "⭐ 리뷰 작성됨" : "리뷰 미작성"}
                      </span>
                    </div>
                    <button onClick={() => onOpenContract?.(r)}
                      style={{ width: "100%", padding: "10px 16px", borderRadius: R.full,
                        border: `1px solid ${C.brandM}`, background: C.brandL, color: DEEP_GREEN,
                        fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      프로젝트 보기 →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
