import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { fmtMoney } from "../utils/calculations";
import { getBidsForRequest } from "../lib/supabase";

// ─────────────────────────────────────────────────────
// Ownership — 내 공간 기록 (락인 구조)
//   내정보(마이) 탭에서 사용. 기존 데이터(요청/에스크로/입찰/관심업체)를
//   재구성해 "버리기 아까운 자산" 으로 보여준다.
//   섹션: 1) 내 공간 기록  2) 받은 견적 기록  3) 관심 업체  4) 보호 기록
// 디자인: 아이보리 배경 / 딥그린 포인트 / 카드형(radius 12) / 14px+ / lh 1.8
// ─────────────────────────────────────────────────────

const DEEP_GREEN = "#1E3D2F";

// 관심 업체 메모/알림 — DB 스키마 변경 없이 localStorage 로 보존(복구 가능)
const memoKey  = (uid, cid) => `gm_fav_memo:${uid}:${cid}`;
const alertKey = (uid, cid) => `gm_fav_alert:${uid}:${cid}`;
const loadStr  = (k, def = "") => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };

function fmtYearMonth(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: "16px 18px",
      border: `1px solid ${C.bgWarm}`, marginBottom: S.sm, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: S.md, marginTop: S.xl }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.8 }}>{icon} {title}</div>
      {sub && <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8 }}>{sub}</div>}
    </div>
  );
}

export default function OwnershipHistory({
  userId, myRequests = [], myRequestsEscrow = {}, savedCompanies = [],
  onOpenContract, onOpenCompany,
}) {
  const [bidsByReq, setBidsByReq] = useState({}); // { [requestId]: bid[] }

  // 받은 견적 기록 — 사용자의 모든 요청에 대한 입찰 내역 조회(보존용)
  useEffect(() => {
    let alive = true;
    const ids = myRequests.map(r => r.id).filter(id => id && !String(id).startsWith("tmp-"));
    Promise.all(ids.map(id => getBidsForRequest(id).then(({ data }) => [id, data ?? []]).catch(() => [id, []])))
      .then(pairs => { if (alive) setBidsByReq(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [myRequests]);

  // 완료(정산) 계약 — 보호 기록/공간 기록 소스
  const settled = myRequests.filter(r => {
    const tx = myRequestsEscrow[r.id]?.escrow?.transaction_status;
    return tx === "SETTLED" || r.status === "completed";
  });
  const protectedTotal = settled.reduce((sum, r) => {
    const total = myRequestsEscrow[r.id]?.escrow?.total_amount ?? 0;
    return sum + (Number(total) || 0);
  }, 0);

  return (
    <div style={{ background: C.ivory, borderRadius: 12, padding: "18px 16px", marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: DEEP_GREEN, lineHeight: 1.8 }}>📁 내 공간 기록</div>
      <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8, marginBottom: S.sm }}>
        쌓인 기록은 다음 공사에서 그대로 자산이 됩니다
      </div>

      {/* 1) 내 공간 기록 — 완료 계약 카드 */}
      {settled.length === 0 ? (
        <Card style={{ background: C.surface, textAlign: "center", padding: "22px 18px" }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>🏠</div>
          <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.8 }}>아직 완료된 공사 기록이 없어요</div>
          <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8 }}>첫 시공을 마치면 이곳에 기록이 쌓입니다</div>
        </Card>
      ) : (
        settled.map(r => {
          const esc = myRequestsEscrow[r.id]?.escrow ?? null;
          const total = esc?.total_amount ?? 0;
          return (
            <Card key={r.id}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, lineHeight: 1.8 }}>
                {fmtYearMonth(r.createdAt)} {r.area} {r.type}
              </div>
              <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.8 }}>
                정산 내역 {total > 0 ? fmtMoney(total) : "—"}
              </div>
              <button onClick={() => onOpenContract?.(r)}
                style={{ marginTop: 8, padding: "8px 16px", borderRadius: R.full, border: `1px solid ${C.brandM}`,
                  background: C.brandL, color: DEEP_GREEN, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                계약·시공 기록 보기 →
              </button>
            </Card>
          );
        })
      )}

      {/* 2) 받은 견적 기록 */}
      <SectionTitle icon="📋" title="받은 견적 기록" sub="다음 공사 때 참고용으로 보관됩니다" />
      {myRequests.filter(r => (bidsByReq[r.id]?.length ?? 0) > 0).length === 0 ? (
        <Card style={{ background: C.surface }}>
          <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8 }}>아직 받은 견적 기록이 없어요</div>
        </Card>
      ) : (
        myRequests.filter(r => (bidsByReq[r.id]?.length ?? 0) > 0).map(r => (
          <Card key={r.id}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, lineHeight: 1.8, marginBottom: 4 }}>
              {r.area} {r.type}
            </div>
            {bidsByReq[r.id].map(b => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 14, color: b.selected ? DEEP_GREEN : C.text2, fontWeight: b.selected ? 800 : 400, lineHeight: 1.8 }}>
                <span>{b.selected ? "✅ " : ""}{fmtMoney(b.price)} · {b.period_days ?? "-"}일</span>
                {b.selected && <span style={{ fontSize: 13, color: DEEP_GREEN, fontWeight: 800 }}>선택</span>}
              </div>
            ))}
          </Card>
        ))
      )}

      {/* 3) 관심 업체 */}
      <SectionTitle icon="❤️" title="관심 업체" sub={`${savedCompanies.length}곳`} />
      {savedCompanies.length === 0 ? (
        <Card style={{ background: C.surface }}>
          <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8 }}>관심 업체를 저장하면 여기서 한눈에 비교할 수 있어요</div>
        </Card>
      ) : (
        savedCompanies.map(co => <SavedCompanyCard key={co.id} co={co} userId={userId} onOpenCompany={onOpenCompany} />)
      )}

      {/* 4) 보호 기록 */}
      <SectionTitle icon="🛡️" title="공간안전결제 보호 기록" />
      {settled.length === 0 ? (
        <Card style={{ background: C.surface }}>
          <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8 }}>안전결제로 완료한 거래가 이곳에 기록됩니다</div>
        </Card>
      ) : (
        <Card>
          {settled.map(r => {
            const total = myRequestsEscrow[r.id]?.escrow?.total_amount ?? 0;
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.text2, lineHeight: 1.8 }}>
                <span>{fmtYearMonth(r.createdAt)} {r.area} {r.type}</span>
                <span style={{ color: DEEP_GREEN, fontWeight: 800 }}>{total > 0 ? fmtMoney(total) : "—"} 안전 완료 ✅</span>
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${C.bgWarm}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14, lineHeight: 1.8 }}>
            <span style={{ fontWeight: 800, color: C.text1 }}>총 보호 완료 금액</span>
            <span style={{ fontWeight: 800, color: DEEP_GREEN }}>{fmtMoney(protectedTotal)}</span>
          </div>
          <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.8 }}>분쟁 없음: {settled.length}건 ✅</div>
        </Card>
      )}
    </div>
  );
}

// 관심 업체 카드 — 메모 + 새 포트폴리오 알림(localStorage 보존)
function SavedCompanyCard({ co, userId, onOpenCompany }) {
  const [memo, setMemo] = useState(() => loadStr(memoKey(userId, co.id)));
  const [editing, setEditing] = useState(false);
  const [alertOn, setAlertOn] = useState(() => loadStr(alertKey(userId, co.id), "0") === "1");

  const saveMemo = () => { try { localStorage.setItem(memoKey(userId, co.id), memo); } catch { /* noop */ } setEditing(false); };
  const toggleAlert = () => {
    const next = !alertOn; setAlertOn(next);
    try { localStorage.setItem(alertKey(userId, co.id), next ? "1" : "0"); } catch { /* noop */ }
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => onOpenCompany?.(co)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
            fontSize: 14, fontWeight: 800, color: C.text1, lineHeight: 1.8, fontFamily: "inherit" }}>
          🏠 {co.name} →
        </button>
        <button onClick={toggleAlert}
          style={{ flexShrink: 0, padding: "5px 10px", borderRadius: R.full, cursor: "pointer", fontSize: 13, fontWeight: 700,
            border: `1px solid ${alertOn ? DEEP_GREEN : C.bgWarm}`, background: alertOn ? C.brandL : C.surface, color: alertOn ? DEEP_GREEN : C.text3 }}>
          {alertOn ? "🔔 알림 켜짐" : "🔕 알림 받기"}
        </button>
      </div>
      {editing ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 강서구 욕실 잘한다고 함"
            style={{ flex: 1, padding: "9px 12px", borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, fontSize: 14, color: C.text1, background: C.surface, outline: "none", fontFamily: "inherit" }} />
          <button onClick={saveMemo} style={{ padding: "9px 14px", borderRadius: R.lg, border: "none", background: DEEP_GREEN, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>저장</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", textAlign: "left",
            fontSize: 14, color: memo ? C.text2 : C.text4, lineHeight: 1.8, fontFamily: "inherit" }}>
          📝 {memo || "메모 추가하기"}
        </button>
      )}
    </Card>
  );
}
