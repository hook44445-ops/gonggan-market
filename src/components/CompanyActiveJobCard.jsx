import { useState } from "react";
import { C, R, S } from "../constants";

const STEPS = ["실측예약", "GPS체크인", "현장견적", "플랫폼견적서"];

function getStepIndex(siteVisit) {
  if (!siteVisit) return -1;
  const s = siteVisit.status;
  if (s === "scheduled") return 0;
  if (s === "checked_in") return 1;
  if (s === "completed") return 2;
  if (s === "estimate_submitted") return 3;
  return -1;
}

function useDueCountdown(dueAt) {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return { text: "기한 초과", overdue: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { text: `${h}시간 ${m}분 남음`, overdue: false };
}

export default function CompanyActiveJobCard({ job, onAction }) {
  const { bid, request, siteVisit, estimate } = job;
  const [devOpen, setDevOpen] = useState(false);

  const stepIdx = getStepIndex(siteVisit);
  const dueCd = useDueCountdown(siteVisit?.estimate_due_at);

  const spaceType = request?.space_type ?? request?.type ?? "";
  const size = request?.size ?? "";
  const area = request?.area ?? "";
  const customerId = request?.user_id ?? "";

  const statusLabel = () => {
    if (!siteVisit) return { label: "실측 미예약", color: C.text3, bg: C.bg };
    const s = siteVisit.status;
    if (s === "scheduled") return { label: "실측 예약됨", color: C.brand, bg: C.brandL };
    if (s === "checked_in") return { label: "GPS 체크인 완료", color: "#B08040", bg: "#FBF5E8" };
    if (s === "completed") return { label: "현장견적 완료", color: C.brand, bg: C.brandL };
    if (s === "estimate_submitted") return { label: "견적서 제출완료", color: C.green, bg: "#EAF2EE" };
    return { label: s, color: C.text3, bg: C.bg };
  };

  const badge = statusLabel();

  const renderCTA = () => {
    if (!siteVisit) {
      return (
        <button onClick={() => onAction("schedule", job)}
          style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
          📅 실측 일정 잡기
        </button>
      );
    }
    const s = siteVisit.status;
    if (s === "scheduled") {
      return (
        <div>
          <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>
            방문 예정: {new Date(siteVisit.scheduled_at).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"numeric", minute:"2-digit" })}
          </div>
          <button onClick={() => onAction("checkin", job)}
            style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
            📍 GPS 체크인
          </button>
        </div>
      );
    }
    if (s === "checked_in") {
      return (
        <button onClick={() => onAction("field_estimate", job)}
          style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
          📝 현장견적 입력 & 실측 완료
        </button>
      );
    }
    if (s === "completed") {
      return (
        <div>
          {dueCd && (
            <div style={{ background: dueCd.overdue ? "#FFF0F0" : C.brandL, borderRadius:R.md, padding:"8px 12px", marginBottom:S.sm, fontSize:12, fontWeight:700, color: dueCd.overdue ? C.red : C.brand }}>
              {dueCd.overdue ? "⚠️ 견적서 제출 기한이 지났습니다" : `⏰ 견적서 제출 기한: ${dueCd.text}`}
            </div>
          )}
          <button onClick={() => onAction("platform_estimate", job)}
            style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
            📋 플랫폼 견적서 작성
          </button>
        </div>
      );
    }
    if (s === "estimate_submitted") {
      if (estimate?.status === "accepted") {
        return (
          <button onClick={() => onAction("escrow", job)}
            style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
            💰 에스크로 결제 진행
          </button>
        );
      }
      return (
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:"12px", fontSize:13, fontWeight:700, color:C.brand, textAlign:"center" }}>
          ✅ 견적서 제출완료 — 에스크로 대기
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
      <div style={{ height:3, background:C.brand }} />
      <div style={{ padding:S.xl }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.md }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{spaceType} {size}</div>
            <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>📍 {area}</div>
            {customerId && <div style={{ fontSize:11, color:C.text4, marginTop:2 }}>의뢰인: {customerId.slice(0, 8)}...</div>}
          </div>
          <span style={{ background:badge.bg, color:badge.color, borderRadius:R.full, padding:"4px 10px", fontSize:11, fontWeight:700, flexShrink:0 }}>
            {badge.label}
          </span>
        </div>

        <div style={{ display:"flex", gap:0, marginBottom:S.xl }}>
          {STEPS.map((label, i) => {
            const done = i <= stepIdx;
            const active = i === stepIdx + 1;
            return (
              <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:"100%", display:"flex", alignItems:"center" }}>
                  <div style={{ flex:1, height:2, background: i === 0 ? "transparent" : done ? C.brand : C.bgWarm }} />
                  <div style={{ width:16, height:16, borderRadius:"50%", background: done ? C.brand : active ? C.brandL : C.bgWarm, border: active ? `2px solid ${C.brand}` : "none", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {done && <div style={{ width:6, height:6, borderRadius:"50%", background:"#fff" }} />}
                  </div>
                  <div style={{ flex:1, height:2, background: i === STEPS.length - 1 ? "transparent" : done ? C.brand : C.bgWarm }} />
                </div>
                <div style={{ fontSize:9, color: done ? C.brand : active ? C.brand : C.text4, fontWeight: done || active ? 700 : 400, textAlign:"center", whiteSpace:"nowrap" }}>{label}</div>
              </div>
            );
          })}
        </div>

        {renderCTA()}

        <div style={{ marginTop:S.md }}>
          <button onClick={() => setDevOpen(v => !v)}
            style={{ background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.sm, padding:"3px 8px", fontSize:10, color:C.text4, fontWeight:700, cursor:"pointer" }}>
            {devOpen ? "▲" : "▼"} DEV
          </button>
          {devOpen && (
            <div style={{ marginTop:S.sm, background:C.bg, borderRadius:R.md, padding:S.md, fontSize:10, color:C.text3, fontFamily:"monospace", lineHeight:1.8 }}>
              <div>request_id: {bid?.request_id ?? "-"}</div>
              <div>bid_id: {bid?.id ?? "-"}</div>
              <div>visit_status: {siteVisit?.status ?? "-"}</div>
              <div>scheduled_at: {siteVisit?.scheduled_at ?? "-"}</div>
              <div>checked_in_at: {siteVisit?.checked_in_at ?? "-"}</div>
              <div>estimate_due_at: {siteVisit?.estimate_due_at ?? "-"}</div>
              <div>estimate_id: {estimate?.id ?? "-"}</div>
              <div>estimate_status: {estimate?.status ?? "-"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
