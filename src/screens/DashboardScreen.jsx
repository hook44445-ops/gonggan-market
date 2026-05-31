import { useState, useEffect } from "react";
import { C, R, S, SHADOW } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";
import { TempBadge, LeafSprig } from "../components/common";
import BidCard from "../components/BidCard";
import { getCompanyEscrowJobs, getCompletedEscrowByCompany, getReviews } from "../lib/supabase";

const PAID_BY_STEP = { 1: 10, 2: 10, 3: 30, 4: 70, 5: 100 };

const TX_META = {
  CONTRACTED:    { label: "착공대기", color: "#E8A51B", bucket: "waiting_start", nextAction: "착공 사진 업로드 필요" },
  STARTED:       { label: "착공진행", color: C.brand,   bucket: "in_progress",   nextAction: "고객 착공 확인 대기" },
  MID_INSPECTION:{ label: "공사진행", color: "#9B59B6", bucket: "in_progress",   nextAction: "중간/완료 사진 업로드 필요" },
  DISPUTE:       { label: "분쟁중",   color: "#E74C3C", bucket: "in_progress",   nextAction: "분쟁 처리 중" },
};

const STEP_INFO = {
  1: { label: "착공대기", color: "#E8A51B", paid: 10 },
  2: { label: "착공진행", color: C.brand,   paid: 10 },
  3: { label: "공사진행", color: "#9B59B6", paid: 30 },
  4: { label: "완료대기", color: "#27AE60", paid: 70 },
};


const normalizeEscrowRow = (row) => {
  const step   = Math.min(4, Math.max(1, row.current_step ?? 1));
  const info   = STEP_INFO[step];
  const txMeta = TX_META[row.transaction_status] ?? info;
  const created = new Date(row.created_at);
  const daysElapsed = Math.floor((Date.now() - created) / 864e5);
  return {
    id:          row.id,
    bid:         null,
    client:      row.requests?.area ?? "의뢰인",
    area:        row.requests?.area ?? "",
    type:        row.requests?.space_type ?? "",
    status:      txMeta.label,
    statusColor: txMeta.color,
    paid:        PAID_BY_STEP[step] ?? info.paid,
    dDay:        Math.max(0, 30 - daysElapsed),
    total:       row.total_amount ?? 0,
    txStatus:    row.transaction_status ?? "CONTRACTED",
    dashboardBucket: txMeta.bucket ?? "in_progress",
    nextAction:  txMeta.nextAction ?? "에스크로 상세 →",
  };
};

const normalizeCompanyJob = ({ bid, request, escrow }) => {
  const txStatus = escrow?.transaction_status ?? "CONTRACTED";
  const step     = Math.min(4, Math.max(1, escrow?.current_step ?? 1));
  const txMeta   = TX_META[txStatus] ?? STEP_INFO[step];
  const createdAt = escrow?.created_at ?? bid?.createdAt ?? Date.now();
  const daysElapsed = Math.floor((Date.now() - new Date(createdAt)) / 864e5);
  const total = escrow?.total_amount ?? bid?.price ?? 0;
  return {
    id:          bid?.id ?? escrow?.id ?? request?.id,
    bid,
    client:      request?.area || request?.type || "의뢰인",
    area:        request?.area || "",
    type:        request?.type || request?.space_type || "인테리어",
    status:      txMeta.label,
    statusColor: txMeta.color,
    paid:        PAID_BY_STEP[step] ?? txMeta.paid ?? 10,
    dDay:        Math.max(0, 30 - daysElapsed),
    total,
    txStatus,
    dashboardBucket: txMeta.bucket ?? "in_progress",
    nextAction:  txMeta.nextAction ?? "에스크로 상세 →",
  };
};

const normalizeCompletedJob = (row) => {
  const req = row.requests;
  return {
    id:        row.id,
    area:      req?.area || "",
    type:      req?.type || req?.space_type || "인테리어",
    total:     row.total_amount ?? 0,
    settled:   row.transaction_status === "SETTLED",
    txStatus:  row.transaction_status,
    date:      row.created_at,
    requestId: row.request_id,
  };
};

export default function DashboardScreen({
  onBack, onEscrow, onOpenJob,
  companyJobs, companyJobsDebug,
  allRequests: allRequestsProp,
  currentUser, submittedBids,
  userId,
}) {
  const allRequests  = allRequestsProp ?? [];
  const jobsFromHome = companyJobs ?? [];
  const [tab, setTab]                     = useState("active");
  const [escrowJobs, setEscrowJobs]       = useState([]);
  const [completedEscrow, setCompletedEscrow] = useState([]);
  const [statsData, setStatsData]         = useState(null);
  const [jobsLoading, setJobsLoading]     = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    setJobsLoading(true);
    getCompanyEscrowJobs(currentUser.id)
      .then(({ data }) => { if (data) setEscrowJobs(data.map(normalizeEscrowRow)); })
      .finally(() => setJobsLoading(false));
  }, [currentUser?.id]);

  useEffect(() => {
    const ownerId = userId ?? currentUser?.ownerId ?? null;
    const compId  = currentUser?.id ?? null;
    if (!ownerId && !compId) return;

    Promise.all([
      ownerId ? getCompletedEscrowByCompany(ownerId) : Promise.resolve({ data: [] }),
      compId  ? getReviews(compId)                   : Promise.resolve({ data: [] }),
    ]).then(([completedRes, reviewsRes]) => {
      const completed = completedRes.data ?? [];
      const reviews   = reviewsRes.data   ?? [];

      setCompletedEscrow(completed.map(normalizeCompletedJob));

      const avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length) * 10) / 10
        : null;

      const userCounts = {};
      for (const e of completed) {
        const uid = e.requests?.user_id;
        if (uid) userCounts[uid] = (userCounts[uid] ?? 0) + 1;
      }
      const repeatCustomers = Object.values(userCounts).filter(c => c >= 2).length;
      const totalCustomers  = Object.keys(userCounts).length;
      const repeatRate = totalCustomers > 0
        ? Math.round((repeatCustomers / totalCustomers) * 100)
        : 0;

      setStatsData({
        completed_count:       completed.length,
        review_count:          reviews.length,
        avg_rating:            avgRating,
        repeat_rate:           repeatRate,
        repeat_customer_count: repeatCustomers,
        total_customers:       totalCustomers,
      });
    }).catch(() => {});
  }, [userId, currentUser?.id, currentUser?.ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeJobs = jobsFromHome.length > 0
    ? jobsFromHome.map(normalizeCompanyJob)
    : escrowJobs;
  const jobsSource = jobsFromHome.length > 0 ? "companyJobs" : "dashboardLocal";

  const thisMonthRevenue = activeJobs.reduce((sum, j) => sum + Math.round(j.total * j.paid / 100), 0);
  const pendingAmount    = activeJobs.reduce((sum, j) => sum + Math.round(j.total * (100 - j.paid) / 100), 0);

  const temp            = currentUser?.temp ?? 36.5;
  const completedCount  = statsData?.completed_count  ?? currentUser?.completedJobs  ?? 0;
  const recontractRate  = statsData?.repeat_rate       ?? currentUser?.recontractRate ?? 0;
  const avgRating       = statsData?.avg_rating;
  const reviewCount     = statsData?.review_count      ?? 0;

  const tabs = [["active","진행중"],["bids","입찰"],["stats","통계"],["completed","완료"]];

  // [ContractMapping] 진단 — 업체 진행중/완료 계약 매핑 (production 미노출)
  useEffect(() => {
    if (!SHOW_DEBUG_UI) return;
    (jobsFromHome ?? []).forEach(j => {
      // eslint-disable-next-line no-console
      console.log("[ContractMapping]", {
        screen: "company_active", role: "company",
        request_id: j.request?.id ?? j.bid?.requestId ?? null,
        contract_id: j.escrow?.id ?? null,
        bid_id: j.bid?.id ?? null,
        company_id: j.bid?.companyId ?? j.bid?.company_id ?? j.escrow?.company_id ?? null,
        consumer_id: j.request?.user_id ?? null,
        title: j.request?.type ?? j.request?.space_type ?? null,
        region: j.request?.area ?? null,
        amount: j.escrow?.total_amount ?? j.bid?.price ?? null,
        request_status: j.request?.status ?? null,
        contract_status: j.escrow?.transaction_status ?? null,
        escrow_status: j.escrow?.transaction_status ?? null,
        source: "companyJobs(bid.request_id join)",
      });
    });
    completedEscrow.forEach(job => {
      // eslint-disable-next-line no-console
      console.log("[ContractMapping]", {
        screen: "company_completed", role: "company",
        request_id: job.requestId ?? null, contract_id: job.id ?? null,
        bid_id: null, company_id: null, consumer_id: null,
        title: job.type ?? null, region: job.area ?? null, amount: job.total ?? null,
        request_status: null, contract_status: job.txStatus ?? null,
        escrow_status: job.txStatus ?? null, source: "getCompletedEscrowByCompany(escrow.request_id)",
      });
    });
  }, [jobsFromHome, completedEscrow]);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* ── 헤더 ───────────────────────────────────────────── */}
      <div style={{ background:C.surface, padding:"14px 20px 0",
        borderBottom:`1px solid ${C.bgWarm}`, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:14 }}>
          <button onClick={onBack}
            style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
          <div style={{ fontSize:16, fontWeight:700, color:C.text1, flex:1 }}>
            {currentUser?.name ?? ""} 님
          </div>
          <TempBadge temp={temp} />
        </div>
        <div style={{ display:"flex" }}>
          {tabs.map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ flex:1, padding:"10px 0", border:"none", background:"transparent",
                fontWeight: tab === v ? 700 : 500, fontSize:13,
                color: tab === v ? C.brand : C.text3,
                borderBottom:`2.5px solid ${tab === v ? C.brand : "transparent"}`,
                cursor:"pointer" }}>{l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>

        {/* ── 진행중 ──────────────────────────────────────────── */}
        {tab === "active" && (
          <div>
            {SHOW_DEBUG_UI && (
              <div style={{ margin:"0 0 12px", background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:1.9, fontFamily:"monospace", maxHeight:320, overflowY:"auto" }}>
                [DEV:dashboard]<br/>
                <span style={{color: jobsSource === "companyJobs" ? "#0f0" : "#ff0"}}>source: {jobsSource}</span><br/>
                raw_bids: {companyJobsDebug?.raw_bids ?? "?"} | request_count: {companyJobsDebug?.request_count ?? "?"}<br/>
                request_ids: [{companyJobsDebug?.request_ids ?? "?"}]<br/>
                request_statuses: {companyJobsDebug?.request_statuses ?? companyJobsDebug?.statuses ?? "?"}<br/>
                join_mode: {companyJobsDebug?.join_mode ?? "?"} | escrow_direct: {companyJobsDebug?.escrow_direct_found ?? "?"} | pay_orders: {companyJobsDebug?.payment_orders_found ?? "?"}<br/>
                <span style={{color:"#9cf"}}>
                  raw_count: {companyJobsDebug?.raw_count ?? "?"} → deduped: {companyJobsDebug?.deduped_count ?? "?"} → displayed: {companyJobsDebug?.displayed_dashboard_count ?? "?"}
                </span><br/>
                excluded_reason: <span style={{color:"#fc8"}}>{companyJobsDebug?.excluded_reason ?? "?"}</span><br/>
                <span style={{color: activeJobs.length > 0 ? "#0f0" : "#f88"}}>
                  active_jobs_count(home): {companyJobsDebug?.displayed_jobs ?? "?"} | displayed_dashboard_count: {activeJobs.length}
                </span><br/>
                escrow_fallback_count: {escrowJobs.length}<br/>
                {activeJobs.map((j, i) => (
                  <span key={i} style={{color:"#4ff"}}>
                    job[{i}]: txStatus={j.txStatus} bucket={j.dashboardBucket} paid={j.paid}% area={j.area || "—"}<br/>
                  </span>
                ))}
              </div>
            )}

            {/* Revenue card */}
            <div style={{ background:`linear-gradient(150deg,${C.brand},${C.brandD})`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff" }}>
              <div style={{ fontSize:11, opacity:0.7, letterSpacing:"0.3px", marginBottom:6 }}>
                이번 달 정산 수익
              </div>
              <div style={{ fontSize:32, fontWeight:800, marginBottom:6, letterSpacing:"-0.5px" }}>
                {thisMonthRevenue > 0 ? `${thisMonthRevenue.toLocaleString()}만원` : "—"}
              </div>
              <div style={{ display:"flex", gap:S.md, fontSize:12, opacity:0.75 }}>
                <span>진행 {activeJobs.length}건</span>
                <span>·</span>
                <span>입금 예정 {pendingAmount > 0 ? `${pendingAmount.toLocaleString()}만원` : "—"}</span>
              </div>
            </div>

            {jobsLoading && activeJobs.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 0", color:C.text3, fontSize:14 }}>로딩 중...</div>
            )}

            {!jobsLoading && activeJobs.length === 0 && (
              <div style={{ background:C.surface, borderRadius:R.xl, padding:"40px 20px",
                textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:6 }}>진행 중인 공사가 없습니다</div>
                <div style={{ fontSize:12, color:C.text3 }}>새로운 견적 요청을 확인해보세요</div>
              </div>
            )}

            {/* Job cards */}
            {activeJobs.map(job => (
              <div key={job.id} onClick={() => job.bid && onOpenJob ? onOpenJob(job.bid) : onEscrow()}
                style={{ display:"flex", background:C.surface, borderRadius:R.xl, overflow:"hidden",
                  marginBottom:S.md, border:`1px solid ${C.bgWarm}`,
                  boxShadow:SHADOW.card, cursor:"pointer" }}>
                <div style={{ width:4, background:job.statusColor, flexShrink:0 }} />
                <div style={{ flex:1, padding:S.xl }}>
                  <div style={{ display:"flex", gap:S.md, alignItems:"flex-start" }}>
                    <div style={{ width:44, height:44, borderRadius:R.md,
                      background:`${job.statusColor}14`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:20, flexShrink:0 }}>
                      {job.txStatus === "CONTRACTED" ? "📋" : job.txStatus === "DISPUTE" ? "⚠️" : "🏗"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>{job.client}</div>
                        <span style={{ background:`${job.statusColor}14`, color:job.statusColor,
                          borderRadius:R.full, padding:"2px 9px", fontSize:11, fontWeight:700,
                          flexShrink:0, marginLeft:8 }}>
                          {job.status}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>
                        {job.area}{job.type ? ` · ${job.type}` : ""}
                      </div>
                      <div style={{ marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.text3, marginBottom:4 }}>
                          <span>에스크로 {job.paid}% 지급</span>
                          <span>D-{job.dDay}</span>
                        </div>
                        <div style={{ background:C.bgWarm, borderRadius:R.full, height:4, overflow:"hidden" }}>
                          <div style={{ width:`${job.paid}%`, height:"100%", background:job.statusColor, borderRadius:R.full }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>
                          {job.total > 0 ? `${job.total.toLocaleString()}만원` : "—"}
                        </div>
                        <div style={{ fontSize:11, color:job.statusColor, fontWeight:600 }}>{job.nextAction}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 입찰 ──────────────────────────────────────────────── */}
        {tab === "bids" && (
          <div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
              오늘 견적 요청 <b style={{ color:C.brand }}>{allRequests.length}건</b>
            </div>
            {allRequests.map(r => <BidCard key={r.id} r={r} currentUser={currentUser} />)}
          </div>
        )}

        {/* ── 통계 ──────────────────────────────────────────────── */}
        {tab === "stats" && (
          <div>
            {SHOW_DEBUG_UI && statsData && (
              <div style={{ margin:"0 0 12px", background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:1.9, fontFamily:"monospace" }}>
                [DEV:stats]<br/>
                completed_count: {statsData.completed_count}<br/>
                review_count: {statsData.review_count} | avg_rating: {statsData.avg_rating ?? "null"}<br/>
                repeat_customer_count: {statsData.repeat_customer_count} / total_customers: {statsData.total_customers}<br/>
                repeat_rate: {statsData.repeat_rate}%<br/>
                <span style={{color:"#888"}}>as_count: 0 (no disputes table) | as_rate: null</span>
              </div>
            )}

            {/* 공간온도 카드 */}
            <div style={{ position:"relative", background:C.ivory, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, boxShadow:SHADOW.soft, overflow:"hidden" }}>
              <LeafSprig size={80} color={C.brand} opacity={0.06}
                style={{ position:"absolute", right:-12, bottom:-16, transform:"rotate(-20deg)" }} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.lg }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>공간온도</div>
                <TempBadge temp={temp} lg />
              </div>

              {/* Temperature progress bar */}
              <div style={{ marginBottom:S.xl }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.text4, marginBottom:5 }}>
                  <span>36.5°</span>
                  <span style={{ fontWeight:700, color:C.brand }}>{temp}°</span>
                  <span>99°</span>
                </div>
                <div style={{ background:C.bgWarm, borderRadius:R.full, height:6 }}>
                  <div style={{
                    width:`${Math.min(100, Math.max(0, (temp - 36.5) / (99 - 36.5) * 100))}%`,
                    height:"100%",
                    background:`linear-gradient(90deg,${C.brandM},${C.brand})`,
                    borderRadius:R.full,
                  }} />
                </div>
                <div style={{ fontSize:11, color:C.text4, marginTop:5 }}>
                  완료, 리뷰, 재계약으로 올라갑니다
                </div>
              </div>

              {/* Metrics */}
              {[
                ["완료 건수",  completedCount > 0 ? `${completedCount}건` : "0건"],
                ["재계약률",   recontractRate > 0 ? `${recontractRate}%` : "0%"],
                ["AS 처리율",  "—"],
                ["평균 별점",  avgRating != null ? `★ ${avgRating} (${reviewCount}건)` : "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:`${S.sm}px 0`,
                  borderBottom:`1px solid ${C.bgWarm}` }}>
                  <span style={{ fontSize:13, color:C.text3 }}>{label}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:C.text1 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* 수수료 구조 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text2, marginBottom:S.md }}>수수료 구조</div>
              {[
                ["에스크로 이용료", "고객 3% (VAT 별도)", "고객 예치금에 포함"],
                ["플랫폼 수수료",   "업체 4% (VAT 별도)", "정산 시 자동 차감"],
                ["보증금 비율",     "보험 미가입 30%",    "보험 가입 시 20%"],
              ].map(([label, val, sub]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:`${S.sm}px 0`,
                  borderBottom:`1px solid ${C.bgWarm}` }}>
                  <div>
                    <div style={{ fontSize:13, color:C.text2, fontWeight:600 }}>{label}</div>
                    <div style={{ fontSize:11, color:C.text4 }}>{sub}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:C.brand }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop:S.sm, fontSize:11, color:C.text4 }}>* VAT 10% 별도</div>
              {thisMonthRevenue > 0 && (
                <div style={{ marginTop:S.sm, background:C.brandL, borderRadius:R.md,
                  padding:`${S.sm}px ${S.md}px`, fontSize:12, color:C.brand, fontWeight:600 }}>
                  이번 달 수수료 추산: {Math.round(thisMonthRevenue * 0.044).toLocaleString()}만원 차감 (VAT 포함)
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 완료 ──────────────────────────────────────────────── */}
        {tab === "completed" && (
          <div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
              완료 계약 <b style={{ color:C.brand }}>{completedEscrow.length}건</b>
            </div>

            {completedEscrow.length === 0 && (
              <div style={{ background:C.surface, borderRadius:R.xl, padding:"40px 20px",
                textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:6 }}>아직 완료된 계약이 없습니다</div>
                <div style={{ fontSize:12, color:C.text3 }}>공사를 완료하면 여기에 표시됩니다</div>
              </div>
            )}

            {completedEscrow.map(job => {
              const dateStr = job.date
                ? new Date(job.date).toLocaleDateString("ko-KR", { year:"numeric", month:"short", day:"numeric" })
                : "—";
              const accentColor = job.settled ? C.green : "#27AE60";
              return (
                <div key={job.id} style={{ display:"flex", background:C.surface, borderRadius:R.xl, overflow:"hidden",
                  marginBottom:S.md, border:`1px solid ${C.bgWarm}`,
                  boxShadow:"0 1px 4px rgba(28,23,18,0.04)" }}>
                  <div style={{ width:4, background:accentColor, flexShrink:0 }} />
                  <div style={{ flex:1, padding:S.xl }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>
                          {job.area || "공사 완료"}
                        </div>
                        <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                          {job.area || "—"} · {job.type}
                        </div>
                      </div>
                      <span style={{
                        background:`${accentColor}14`, color:accentColor,
                        borderRadius:R.full, padding:"2px 9px", fontSize:11, fontWeight:700,
                        flexShrink:0, marginLeft:8,
                      }}>
                        {job.settled ? "정산완료" : "완료대기"}
                      </span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>
                        {job.total > 0 ? `${job.total.toLocaleString()}만원` : "—"}
                      </div>
                      <div style={{ fontSize:11, color:C.text4 }}>{dateStr}</div>
                    </div>
                    <button onClick={() => onEscrow()}
                      style={{ width:"100%", padding:"9px", background:C.surface2,
                        color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                        fontWeight:600, fontSize:13, cursor:"pointer" }}>
                      상세 보기
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
