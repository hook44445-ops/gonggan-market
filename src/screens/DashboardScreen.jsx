import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";
import BidCard from "../components/BidCard";
import { getCompanyEscrowJobs } from "../lib/supabase";

const STEP_INFO = {
  1: { paid: 0,  label: "예치완료", color: "#8B9B8E" },
  2: { paid: 10, label: "착공준비", color: C.brand   },
  3: { paid: 30, label: "중간점검", color: "#E8A51B" },
  4: { paid: 70, label: "완료대기", color: "#27AE60" },
};

const IS_DEBUG = true;

// 진행중 판정(종료/완료 제외)은 Home의 companyJobs fetch 단계에서 이미 처리됩니다.
// 대시보드는 그 결과를 동일 소스로 사용합니다.

const normalizeEscrowRow = (row) => {
  const step = Math.min(4, Math.max(1, row.current_step ?? 1));
  const info = STEP_INFO[step];
  const created = new Date(row.created_at);
  const daysElapsed = Math.floor((Date.now() - created) / 864e5);
  return {
    id:          row.id,
    bid:         null,
    client:      row.requests?.area ?? "의뢰인",
    area:        row.requests?.area ?? "",
    type:        row.requests?.space_type ?? "",
    status:      info.label,
    statusColor: info.color,
    paid:        info.paid,
    dDay:        Math.max(0, 30 - daysElapsed),
    total:       row.total_amount ?? 0,
  };
};

// Home과 동일한 companyJobs 결과({ bid, request, escrow })를 대시보드 카드 형태로 변환
const normalizeCompanyJob = ({ bid, request, escrow }) => {
  const step = Math.min(4, Math.max(1, escrow?.current_step ?? 1));
  const info = STEP_INFO[step];
  const createdAt = escrow?.created_at ?? bid?.createdAt ?? Date.now();
  const daysElapsed = Math.floor((Date.now() - new Date(createdAt)) / 864e5);
  // total_amount(만원) 우선, 없으면 bid.price(만원) — fmtMoney와 동일 단위
  const total = escrow?.total_amount ?? bid?.price ?? 0;
  return {
    id:          bid?.id ?? escrow?.id ?? request?.id,
    bid,
    client:      request?.area || request?.type || "의뢰인",
    area:        request?.area || "",
    type:        request?.type || request?.space_type || "인테리어",
    status:      info.label,
    statusColor: info.color,
    paid:        info.paid,
    dDay:        Math.max(0, 30 - daysElapsed),
    total,
  };
};

export default function DashboardScreen({ onBack, onEscrow, onOpenJob, companyJobs, companyJobsDebug, allRequests: allRequestsProp, currentUser, submittedBids }) {
  const allRequests = allRequestsProp ?? [];
  const jobsFromHome = companyJobs ?? [];
  const [tab, setTab] = useState("active");
  const [escrowJobs, setEscrowJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // 보조 경로: companyJobs가 비어있을 때만 사용하는 escrow 직접 조회 (fallback)
  useEffect(() => {
    if (!currentUser?.id) return;
    setJobsLoading(true);
    getCompanyEscrowJobs(currentUser.id)
      .then(({ data }) => {
        if (data) setEscrowJobs(data.map(normalizeEscrowRow));
      })
      .finally(() => setJobsLoading(false));
  }, [currentUser?.id]);

  // 진행중 판정: Home companyJobs를 1순위 소스로 사용. 비어있으면 escrow fallback.
  const activeJobs = jobsFromHome.length > 0
    ? jobsFromHome.map(normalizeCompanyJob)
    : escrowJobs;
  const jobsSource = jobsFromHome.length > 0 ? "companyJobs" : "dashboardLocal";

  const thisMonthRevenue = activeJobs.reduce((sum, j) => sum + Math.round(j.total * j.paid / 100), 0);
  const pendingAmount    = activeJobs.reduce((sum, j) => sum + Math.round(j.total * (100 - j.paid) / 100), 0);

  const temp            = currentUser?.temp            ?? 70;
  const completedJobs   = currentUser?.completedJobs   ?? 0;
  const recontractRate  = currentUser?.recontractRate  ?? 0;
  const asRate          = currentUser?.asRate          ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: C.surface, padding: "14px 20px 0", borderBottom: `1px solid ${C.bgWarm}`,
        position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>안녕하세요, {currentUser?.name ?? ""}님</div>
          <div style={{ marginLeft: "auto" }}>
            <TempBadge temp={temp} />
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {[["active","진행중"],["bids","입찰"],["stats","통계"]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ flex: 1, padding: "10px 0", border: "none", background: "transparent",
                fontWeight: tab === v ? 800 : 500, fontSize: 14,
                color: tab === v ? C.brand : C.text3,
                borderBottom: `2.5px solid ${tab === v ? C.brand : "transparent"}`,
                cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 40px` }}>

        {tab === "active" && (
          <div>
            {IS_DEBUG && (
              <div style={{ margin:"0 0 12px", background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:1.9, fontFamily:"monospace", maxHeight:280, overflowY:"auto" }}>
                [DEV:dashboard]<br/>
                <span style={{color: jobsSource === "companyJobs" ? "#0f0" : "#ff0"}}>
                  source: {jobsSource}
                </span><br/>
                raw_bids: {companyJobsDebug?.raw_bids ?? "?"} | request_count: {companyJobsDebug?.request_count ?? "?"}<br/>
                request_ids: [{companyJobsDebug?.request_ids ?? "?"}]<br/>
                request_statuses: {companyJobsDebug?.request_statuses ?? companyJobsDebug?.statuses ?? "?"}<br/>
                join_mode: {companyJobsDebug?.join_mode ?? "?"} | escrow_direct: {companyJobsDebug?.escrow_direct_found ?? "?"} | pay_orders: {companyJobsDebug?.payment_orders_found ?? "?"}<br/>
                <span style={{color:"#9cf"}}>
                  raw_count: {companyJobsDebug?.raw_count ?? "?"} → deduped_count: {companyJobsDebug?.deduped_count ?? "?"} → displayed: {companyJobsDebug?.displayed_dashboard_count ?? "?"}
                </span><br/>
                excluded_reason: <span style={{color:"#fc8"}}>{companyJobsDebug?.excluded_reason ?? "?"}</span><br/>
                <span style={{color: (companyJobsDebug?.displayed_jobs ?? 0) > 0 ? "#0f0" : "#f88"}}>
                  active_jobs_count(home): {companyJobsDebug?.displayed_jobs ?? "?"}
                </span><br/>
                <span style={{color: activeJobs.length > 0 ? "#0f0" : "#f88"}}>
                  displayed_dashboard_count: {activeJobs.length}
                </span><br/>
                escrow_fallback_count: {escrowJobs.length}
              </div>
            )}
            <div style={{ background: `linear-gradient(135deg,${C.brand},${C.brandD})`,
              borderRadius: R.xl, padding: S.xxl, marginBottom: S.xl, color: "#fff" }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>이번 달 정산 수익</div>
              <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>
                {thisMonthRevenue > 0 ? `${thisMonthRevenue.toLocaleString()}만원` : "—"}
              </div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                진행중 {activeJobs.length}건 · 단계 확인 후 입금 예정 {pendingAmount > 0 ? `${pendingAmount.toLocaleString()}만원` : "—"}
              </div>
            </div>

            {jobsLoading && activeJobs.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 14 }}>
                로딩 중...
              </div>
            )}

            {!jobsLoading && activeJobs.length === 0 && (
              <div style={{ background: C.surface, borderRadius: R.xl, padding: "40px 20px",
                textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 6 }}>아직 진행 중인 공사가 없어요</div>
                <div style={{ fontSize: 12, color: C.text3 }}>새로운 견적 요청을 확인해보세요</div>
              </div>
            )}

            {activeJobs.map(job => (
              <div key={job.id} onClick={() => job.bid && onOpenJob ? onOpenJob(job.bid) : onEscrow()}
                style={{ background: C.surface, borderRadius: R.xl, overflow: "hidden",
                  marginBottom: S.md, border: `1px solid ${C.bgWarm}`,
                  boxShadow: "0 2px 8px rgba(28,23,18,0.06)", cursor: "pointer" }}>
                <div style={{ height: 3, background: job.statusColor }} />
                <div style={{ padding: S.xl }}>
                  <div style={{ display: "flex", gap: S.md, alignItems: "flex-start" }}>
                    <div style={{ width: 56, height: 56, borderRadius: R.md, background: C.bgWarm,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                      🏗
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{job.client}</div>
                        <span style={{ background: `${job.statusColor}18`, color: job.statusColor,
                          borderRadius: R.full, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                          {job.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.sm }}>
                        📍 {job.area} · {job.type}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text3, marginBottom: 4 }}>
                          <span>에스크로 {job.paid}% 지급됨</span>
                          <span>D-{job.dDay}</span>
                        </div>
                        <div style={{ background: C.bgWarm, borderRadius: R.full, height: 5, overflow: "hidden" }}>
                          <div style={{ width: `${job.paid}%`, height: "100%",
                            background: job.statusColor, borderRadius: R.full }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{job.total.toLocaleString()}만원</div>
                        <div style={{ fontSize: 12, color: C.brand, fontWeight: 700 }}>에스크로 상세 →</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "bids" && (
          <div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>
              오늘 새로운 견적 요청 <b style={{ color: C.brand }}>{allRequests.length}건</b>
            </div>
            {allRequests.map(r => <BidCard key={r.id} r={r} currentUser={currentUser} />)}
          </div>
        )}

        {tab === "stats" && (
          <div>
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
              marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.xl }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>🌡 공간온도</div>
                <TempBadge temp={temp} lg />
              </div>
              {[
                ["완료 건수",   `${completedJobs}건`,    "✅"],
                ["재계약률",   `${recontractRate}%`,     "🔄"],
                ["AS 처리율",  `${asRate}%`,             "🛠"],
                ["평균 별점",  "—",                      "⭐"],
              ].map(([label, val, icon]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: `${S.sm}px 0`,
                  borderBottom: `1px solid ${C.bgWarm}` }}>
                  <span style={{ fontSize: 13, color: C.text3 }}>{icon} {label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
              marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.md }}>💸 수수료 구조 안내</div>
              {[
                ["에스크로 이용료", "고객 3% (VAT 별도)", "고객 예치금에 포함"],
                ["플랫폼 수수료",   "업체 4% (VAT 별도)", "정산 시 자동 차감"],
                ["보증금 비율",     "보험 미가입 30%", "보험 가입 시 20%"],
              ].map(([label, val, sub]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: `${S.sm}px 0`,
                  borderBottom: `1px solid ${C.bgWarm}` }}>
                  <div>
                    <div style={{ fontSize: 13, color: C.text2, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, color: C.text4 }}>{sub}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop: S.sm, fontSize: 11, color: C.text4 }}>
                * 수수료는 VAT 별도 (부가세 10% 추가)
              </div>
              {thisMonthRevenue > 0 && (
                <div style={{ marginTop: S.sm, background: C.brandL, borderRadius: R.md,
                  padding: `${S.sm}px ${S.md}px`, fontSize: 12, color: C.brand, fontWeight: 700 }}>
                  💡 이번 달 수수료 추산: {Math.round(thisMonthRevenue * 0.044).toLocaleString()}만원 차감 (VAT 포함)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
