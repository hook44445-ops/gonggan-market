import { useState, useEffect, useRef } from "react";
import { C, R, S, PHOTOS } from "../constants";
import { fmtMoney, calculateCustomerTotal, calculateCompanyReceive, calculateStagePayments } from "../utils/calculations";
import EscrowCalculator from "../components/EscrowCalculator";
import { supabase } from "../lib/supabase";

// Stage status values:
// 'done'             — payment released
// 'company_todo'     — waiting for company to act
// 'pending_customer' — company acted, waiting for customer confirmation
// 'locked'           — not yet reachable

async function uploadPhotoToStorage(file) {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `escrow/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await supabase.storage.from("construction-photos").upload(path, file, { upsert: true });
    const { data } = supabase.storage.from("construction-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return URL.createObjectURL(file);
  }
}

function CountdownTimer({ deadlineMs }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadlineMs - Date.now()));
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        const n = Math.max(0, deadlineMs - Date.now());
        if (n <= 0) clearInterval(id);
        return n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);
  const total = Math.floor(remaining / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pct = Math.min(100, ((72 * 3600 * 1000 - remaining) / (72 * 3600 * 1000)) * 100);
  const pad = n => String(n).padStart(2, "0");
  return (
    <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}`, marginBottom: S.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>⏰ 자동 승인까지</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: C.brand, fontVariantNumeric: "tabular-nums" }}>
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
      <div style={{ background: `${C.brand}22`, borderRadius: R.full, height: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.brand, borderRadius: R.full, transition: "width 1s linear" }} />
      </div>
      <div style={{ fontSize: 11, color: C.text3, marginTop: S.xs }}>72시간 내 미확인 시 자동 승인됩니다</div>
    </div>
  );
}

function fmtTs(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STAGE_META = [
  { id: 1, label: "전액 예치",   sub: "고객이 총 금액을 공간마켓에 예치",           icon: "🔒", pct: 0,  confirmLabel: null },
  { id: 2, label: "착공 · 선금", sub: "착공 시작 확인 후 공간마켓→업체 30% 지급",   icon: "💰", pct: 30, confirmLabel: "착공 확정" },
  { id: 3, label: "중간 점검",   sub: "50% 공정 확인 후 업체에 40% 지급",           icon: "🔍", pct: 40, confirmLabel: "중간점검 확정" },
  { id: 4, label: "완료 확인",   sub: "시공 완료 확인 후 업체에 잔금 30% 지급",     icon: "✅", pct: 30, confirmLabel: "완료 확정" },
];

const TIMELINE_ICONS = { contract: "📝", photo: "📸", confirm: "✅", dispute: "⚠️" };

export default function EscrowScreen({ onBack, mode, selectedBid }) {
  console.log("render EscrowScreen", { selectedBid: selectedBid?.id, mode });
  const isConsumer = mode === "consumer";
  const bidAmount   = selectedBid?.price ?? 0;
  const customerTotal = bidAmount > 0 ? calculateCustomerTotal(bidAmount) : 0;
  const stages      = bidAmount > 0 ? calculateStagePayments(bidAmount) : [];

  const [stageStatus, setStageStatus] = useState({
    1: "done",
    2: "company_todo",
    3: "locked",
    4: "locked",
  });

  // Per-stage photos uploaded by company { 2: [], 3: [], 4: [] }
  const [stagePhotos, setStagePhotos]     = useState({ 2: [], 3: [], 4: [] });
  const [uploadingStage, setUploadingStage] = useState(null);
  const [stageDeadlines, setStageDeadlines] = useState({});

  // One ref per uploadable stage
  const fileInputRef2 = useRef(null);
  const fileInputRef3 = useRef(null);
  const fileInputRef4 = useRef(null);
  const fileInputRefs = { 2: fileInputRef2, 3: fileInputRef3, 4: fileInputRef4 };

  // Shared timeline
  const [timeline, setTimeline] = useState([
    { id: 1, type: "contract", label: "계약 완료", ts: Date.now() - 2 * 24 * 3600 * 1000 },
  ]);

  const [confirmStage, setConfirmStage]         = useState(null);
  const [showDispute, setShowDispute]           = useState(false);
  const [disputeReason, setDisputeReason]       = useState("");
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);

  const addTimeline = (type, label) =>
    setTimeline(prev => [...prev, { id: Date.now() + Math.random(), type, label, ts: Date.now() }]);

  const advanceStage = (stageId) => {
    setStageStatus(prev => ({
      ...prev,
      [stageId]: "done",
      ...(stageId < 4 ? { [stageId + 1]: "company_todo" } : {}),
    }));
    setConfirmStage(null);
    const labels = { 2: "착공 확정", 3: "중간점검 확정", 4: "완료 확정" };
    addTimeline("confirm", labels[stageId]);
  };

  const reportComplete = (stageId) => {
    setStageStatus(prev => ({ ...prev, [stageId]: "pending_customer" }));
    setStageDeadlines(prev => ({ ...prev, [stageId]: Date.now() + 72 * 3600 * 1000 }));
    const labels = { 2: "착공 사진 업로드", 3: "중간점검 사진 업로드", 4: "완료 사진 업로드" };
    addTimeline("photo", labels[stageId]);
  };

  const handleFileChange = async (e, stageId) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingStage(stageId);
    e.target.value = "";
    const current = stagePhotos[stageId] ?? [];
    const remaining = 6 - current.length;
    const urls = await Promise.all(files.slice(0, remaining).map(f => uploadPhotoToStorage(f)));
    setStagePhotos(prev => ({ ...prev, [stageId]: [...(prev[stageId] ?? []), ...urls].slice(0, 6) }));
    setUploadingStage(null);
  };

  const removePhoto = (stageId, photoIdx) =>
    setStagePhotos(prev => ({ ...prev, [stageId]: prev[stageId].filter((_, i) => i !== photoIdx) }));

  const paid = STAGE_META.filter(s => stageStatus[s.id] === "done" && s.pct > 0).reduce((a, s) => a + s.pct, 0);

  const headerSub = selectedBid
    ? `${selectedBid.company?.name ?? "—"} · ${bidAmount > 0 ? fmtMoney(isConsumer ? customerTotal : bidAmount) : "금액 미정"}`
    : "에스크로 안전 정산";

  const statusColor = (sid) => {
    const st = stageStatus[sid];
    if (st === "done") return C.green;
    if (st === "company_todo" || st === "pending_customer") return C.brand;
    return C.text4;
  };

  const statusIcon = (sid) => {
    const st = stageStatus[sid];
    if (st === "done") return "✓";
    return STAGE_META.find(s => s.id === sid)?.icon ?? "○";
  };

  const isActive = (sid) => stageStatus[sid] === "company_todo" || stageStatus[sid] === "pending_customer";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* Header */}
      <div style={{ background: C.surface, padding: "14px 20px", borderBottom: `1px solid ${C.bgWarm}`, position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: S.md }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>에스크로 안전 정산</div>
          <div style={{ fontSize: 12, color: C.text3 }}>{headerSub}</div>
        </div>
        <div style={{ marginLeft: "auto", background: C.navyL, borderRadius: R.full, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: C.navy }}>🛡 보호중</div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 40px` }}>

        {/* Role banner */}
        <div style={{
          background: isConsumer ? C.brandL : C.surface2,
          border: `1px solid ${isConsumer ? C.brandM : C.bgWarm}`,
          borderRadius: R.lg, padding: `${S.sm}px ${S.lg}px`,
          marginBottom: S.lg, display: "flex", alignItems: "center", gap: S.sm,
        }}>
          <span style={{ fontSize: 16 }}>{isConsumer ? "👤" : "🏗"}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: isConsumer ? C.brand : C.text2 }}>
            {isConsumer
              ? "각 단계를 확인하고 승인하시면 업체에 지급됩니다"
              : "단계별로 완료 신고 후 고객 확인 시 입금됩니다"}
          </span>
        </div>

        {/* Amount card */}
        <div style={{ background: `linear-gradient(135deg,${C.navy},${C.navyM})`, borderRadius: R.xl, padding: S.xxl, marginBottom: S.xl, color: "#fff" }}>
          {isConsumer ? (
            <>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>총 예치 금액 (시공비 + 에스크로 수수료 3%)</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>{fmtMoney(customerTotal)}</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: S.xl }}>고객 예치 완료 · 단계별로 업체에 지급됩니다</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>총 계약 금액 (공간마켓 보관중)</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>{fmtMoney(bidAmount)}</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: S.xl }}>고객 예치 완료 · 단계별 완료 신고 후 입금됩니다</div>
            </>
          )}
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: R.full, height: 8, marginBottom: 6 }}>
            <div style={{ width: `${paid}%`, height: "100%", background: C.brand, borderRadius: R.full, transition: "width 0.6s ease", boxShadow: `0 0 8px ${C.brand}88` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.7 }}>
            <span>업체 지급 완료 {paid}%</span>
            {bidAmount > 0 && <span>보관 중 {fmtMoney(Math.round(bidAmount * (100 - paid) / 100))}</span>}
          </div>
        </div>

        {/* Stage steps */}
        <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.xl }}>정산 단계</div>
          {STAGE_META.map((s, i) => {
            const status  = stageStatus[s.id];
            const stage   = stages[i - 1];
            const active  = isActive(s.id);
            const done    = status === "done";
            const col     = statusColor(s.id);
            const photos  = stagePhotos[s.id] ?? [];
            const isUploading = uploadingStage === s.id;
            const deadline = stageDeadlines[s.id];

            return (
              <div key={s.id} style={{ display: "flex", gap: S.md, marginBottom: i < STAGE_META.length - 1 ? S.xl : 0 }}>
                {/* Timeline dot */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: R.full,
                    background: done ? C.green : active ? C.brand : C.bgWarm,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    boxShadow: active ? `0 0 0 4px ${C.brand}33` : "none",
                    border: active ? `2px solid ${C.brand}` : "none",
                    color: (done || active) ? "#fff" : C.text4,
                  }}>
                    {statusIcon(s.id)}
                  </div>
                  {i < STAGE_META.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 20, marginTop: 4, background: done ? C.green : C.bgWarm }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: done ? C.green : active ? C.brand : C.text3 }}>{s.label}</div>
                    {stage && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: done ? C.green : active ? C.brand : C.text4 }}>
                          {isConsumer
                            ? fmtMoney(stage.amount)
                            : <>{fmtMoney(stage.amount)}<span style={{ fontSize: 11, marginLeft: 4 }}>→실수령 {fmtMoney(stage.companyReceiveAmount)}</span></>
                          }
                        </div>
                        {!isConsumer && (
                          <div style={{ fontSize: 11, color: col }}>
                            {done ? "✓ 입금완료" : status === "pending_customer" ? "⏳ 고객 확인 대기" : active ? "● 신고 대기" : "미지급"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5, marginBottom: active ? S.md : 0 }}>{s.sub}</div>

                  {/* ── Company: photo upload UI per stage ── */}
                  {!isConsumer && status === "company_todo" && s.id > 1 && (
                    <div style={{ marginTop: S.sm }}>
                      <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📸 공사 사진 업로드</div>
                        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: S.md }}>
                          {s.id === 2 && "착공 사진을 업로드하고 고객에게 전송하세요."}
                          {s.id === 3 && `중간점검 사진 업로드 후 고객이 확인하면 ${stage ? fmtMoney(stage.amount) : "40%"} 지급이 진행됩니다.`}
                          {s.id === 4 && "완료 사진을 업로드하고 고객 최종 확인을 받으세요."}
                        </div>

                        {photos.length > 0 ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: S.sm, marginBottom: S.md }}>
                            {photos.map((src, pi) => (
                              <div key={pi} style={{ position: "relative", aspectRatio: "1", borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.background = C.bgWarm; }} />
                                <button onClick={() => removePhoto(s.id, pi)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: R.full, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                              </div>
                            ))}
                            {photos.length < 6 && (
                              <button onClick={() => fileInputRefs[s.id]?.current?.click()} style={{ aspectRatio: "1", background: C.bg, border: `2px dashed ${C.bgWarm}`, borderRadius: R.md, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <span style={{ fontSize: 20, color: C.text4 }}>+</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => fileInputRefs[s.id]?.current?.click()} disabled={isUploading}
                            style={{ width: "100%", padding: "18px", background: C.bg, border: `2px dashed ${C.bgWarm}`, borderRadius: R.lg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.sm, cursor: "pointer", marginBottom: S.md, boxSizing: "border-box" }}>
                            <span style={{ fontSize: 28 }}>{isUploading ? "⏳" : "📷"}</span>
                            <span style={{ fontSize: 13, color: C.text3, fontWeight: 600 }}>{isUploading ? "업로드 중..." : "사진을 선택하세요"}</span>
                            <span style={{ fontSize: 11, color: C.text4 }}>JPG, PNG · 최대 6장</span>
                          </button>
                        )}

                        <div style={{ display: "flex", gap: S.sm }}>
                          <button onClick={() => fileInputRefs[s.id]?.current?.click()} disabled={isUploading}
                            style={{ flex: 1, padding: "11px", background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                            📁 사진 선택
                          </button>
                          <button onClick={() => reportComplete(s.id)} disabled={isUploading || photos.length === 0}
                            style={{ flex: 2, padding: "11px", borderRadius: R.lg, fontWeight: 800, fontSize: 14, border: "none", cursor: photos.length > 0 && !isUploading ? "pointer" : "not-allowed", background: photos.length > 0 ? C.brand : C.bgWarm, color: photos.length > 0 ? "#fff" : C.text4, boxShadow: photos.length > 0 ? `0 4px 14px ${C.brand}44` : "none" }}>
                            {isUploading ? "업로드 중..." : "고객에게 전송하기"}
                          </button>
                        </div>
                        <input ref={fileInputRefs[s.id]} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFileChange(e, s.id)} />
                      </div>
                    </div>
                  )}

                  {/* Company: waiting for customer */}
                  {!isConsumer && status === "pending_customer" && (
                    <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>⏳</span>
                      <span style={{ fontSize: 13, color: C.brand, fontWeight: 700 }}>고객 확인 대기중 · 72시간 내 자동 승인</span>
                    </div>
                  )}

                  {/* Company: done */}
                  {!isConsumer && status === "done" && s.pct > 0 && (
                    <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>입금 완료 · {fmtMoney(stage?.companyReceiveAmount ?? 0)}</span>
                    </div>
                  )}

                  {/* ── Customer confirmation UI ── */}
                  {isConsumer && status === "pending_customer" && (
                    <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}`, marginTop: S.sm }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.brand, marginBottom: S.sm }}>
                        {s.id === 2 && "🏗 업체가 착공을 시작했습니다"}
                        {s.id === 3 && "📸 중간 점검 사진을 확인하고 승인해주세요"}
                        {s.id === 4 && "🏁 업체가 시공 완료를 신고했습니다"}
                      </div>

                      {deadline && <CountdownTimer deadlineMs={deadline} />}

                      {/* Photos uploaded by company */}
                      {photos.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.md }}>
                          {photos.map((src, pi) => (
                            <div key={pi} style={{ borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.brandM}`, aspectRatio: "4/3" }}>
                              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.background = C.bgWarm; }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {(s.id === 2 || s.id === 4) && (
                        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: S.md }}>
                          {s.id === 2 && <>선금 <b>{stage ? fmtMoney(stage.amount) : "30%"}</b>을 업체에 지급하시겠습니까?</>}
                          {s.id === 4 && <>잔금 <b>{stage ? fmtMoney(stage.amount) : "30%"}</b>을 업체에 지급하시겠습니까?</>}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: S.sm }}>
                        <button onClick={() => setShowDispute(true)} style={{ flex: 1, padding: "11px", background: C.surface, color: C.red, border: `1px solid ${C.red}33`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>⚠️ 이의 신청</button>
                        <button onClick={() => setConfirmStage(s.id)} style={{ flex: 2, padding: "11px", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${C.brand}44` }}>
                          ✅ {s.confirmLabel}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Customer: confirmed */}
                  {isConsumer && status === "done" && s.pct > 0 && (
                    <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>확정 완료 · {fmtMoney(stage?.amount ?? 0)} 지급됨</span>
                    </div>
                  )}

                  {/* Customer: dispute submitted */}
                  {isConsumer && disputeSubmitted && status === "pending_customer" && (
                    <div style={{ background: "#FFF0F0", borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, border: `1px solid ${C.red}22`, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>⚠️</span>
                      <div>
                        <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>이의 신청 접수됨</div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>공간마켓 중재팀이 검토 후 연락드립니다 (영업일 1~2일)</div>
                      </div>
                    </div>
                  )}

                  {/* Locked stage */}
                  {status === "locked" && (
                    <div style={{ fontSize: 12, color: C.text4, marginTop: 4 }}>이전 단계 완료 후 활성화됩니다</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shared Timeline */}
        <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>📅 진행 타임라인</div>
          {timeline.map((ev, i) => (
            <div key={ev.id} style={{ display: "flex", gap: S.md, marginBottom: i < timeline.length - 1 ? S.md : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: R.full,
                  background: ev.type === "confirm" ? C.greenL : ev.type === "dispute" ? "#FFF0F0" : C.brandL,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>
                  {TIMELINE_ICONS[ev.type] ?? "●"}
                </div>
                {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 12, marginTop: 4, background: C.bgWarm }} />}
              </div>
              <div style={{ flex: 1, paddingTop: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: ev.type === "confirm" ? C.green : ev.type === "dispute" ? C.red : C.text1 }}>{ev.label}</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>{fmtTs(ev.ts)}</div>
              </div>
            </div>
          ))}
        </div>

        <EscrowCalculator />

        {/* Warranty info */}
        <div style={{ background: C.navyL, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.trustM}`, display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>🛡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 4 }}>하자보수 보증 안내</div>
            <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7 }}>완료 확인 후 <b style={{ color: C.navy }}>1년간 무상 AS</b> 보장</div>
          </div>
        </div>

        {/* Deposit info */}
        <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🏦 예치금 보관 안내</div>
          {[["보관", "공간마켓 법인 신탁 계좌"], ["환급", "탈퇴 7일 내 전액"], ["분쟁", "중재 후 판정 지급"], ["향후", "은행 신탁 연계 예정"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: `${S.xs}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize: 12, color: C.text3 }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Consumer confirm modal ── */}
      {confirmStage && isConsumer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: S.xxl }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>💸</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>
                {confirmStage === 2 && "업체에게 선금을 지급할까요?"}
                {confirmStage === 3 && "업체에게 중도금을 지급할까요?"}
                {confirmStage === 4 && "업체에게 잔금을 지급할까요?"}
              </div>
              <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
                공간마켓이 보관 중인 금액에서<br />
                <b style={{ color: C.text1 }}>{fmtMoney(stages[confirmStage - 2]?.amount ?? 0)}</b>을 업체에 지급합니다
              </div>
            </div>
            {stages.length > 0 && (
              <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, marginBottom: S.xl }}>
                {stages.map(({ name, percent, amount }, idx) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: `${S.sm}px 0`, borderBottom: idx < stages.length - 1 ? `1px solid ${C.bgWarm}` : "none" }}>
                    <span style={{ fontSize: 13, color: idx === 0 ? C.text3 : C.text2, fontWeight: 600 }}>{name} ({percent}%)</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: idx === 0 ? C.text4 : C.text1, textDecoration: idx === 0 ? "line-through" : "none" }}>{fmtMoney(amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => setConfirmStage(null)} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>취소</button>
              <button onClick={() => advanceStage(confirmStage)} style={{ flex: 2, padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 16px ${C.brand}44` }}>
                ✅ {STAGE_META.find(s => s.id === confirmStage)?.confirmLabel ?? "승인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dispute sheet ── */}
      {showDispute && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}
          onClick={e => { if (e.target === e.currentTarget) setShowDispute(false); }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>⚠️ 이의 신청</div>
            <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: S.xl }}>시공 상태가 계약 내용과 다를 경우 이의를 신청하세요.<br />공간마켓 중재팀이 검토 후 연락드립니다.</div>
            <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
              placeholder="이의 사유를 입력하세요 (예: 타일 줄눈 마감이 계약서 기준 미달)"
              style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, background: C.surface2, fontSize: 13, color: C.text1, resize: "none", height: 100, boxSizing: "border-box", marginBottom: S.xl, outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => setShowDispute(false)} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>취소</button>
              <button
                onClick={() => {
                  if (!disputeReason.trim()) return;
                  setShowDispute(false);
                  setDisputeSubmitted(true);
                  addTimeline("dispute", "이의 신청");
                }}
                style={{ flex: 2, padding: S.xl, background: disputeReason.trim() ? C.red : C.bgWarm, color: disputeReason.trim() ? "#fff" : C.text4, border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: disputeReason.trim() ? "pointer" : "not-allowed" }}>
                이의 신청하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
