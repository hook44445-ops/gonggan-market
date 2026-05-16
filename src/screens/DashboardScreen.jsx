import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";
import BidCard from "../components/BidCard";
import { getCompanyActiveJobs } from "../lib/supabase";

const STEP_INFO = {
  1: { paid: 0,  label: "예치완료", color: "#8B9B8E" },
  2: { paid: 10, label: "착공준비", color: C.brand   },
  3: { paid: 30, label: "중간점검", color: "#E8A51B" },
  4: { paid: 70, label: "완료대기", color: "#27AE60" },
};

const normalizeJob = (row) => {
  const step = Math.min(4, Math.max(1, row.current_step ?? 1));
  const info = STEP_INFO[step];
  const created = new Date(row.created_at);
  const daysElapsed = Math.floor((Date.now() - created) / 864e5);
  return {
    id:          row.id,
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

export default function DashboardScreen({ onBack, onEscrow, allRequests: allRequestsProp, currentUser, submittedBids }) {
  const allRequests = allRequestsProp ?? [];
  const [tab, setTab] = useState("active");
  const [activeJobs, setActiveJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    setJobsLoading(true);
    getCompanyActiveJobs(currentUser.id)
      .then(({ data }) => {
        if (data) setActiveJobs(data.map(normalizeJob));
      })
      .finally(() => setJobsLoading(false));
  }, [currentUser?.id]);

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
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>업체 대시보드</div>
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
            <div style={{ background: `linear-gradient(135deg,${C.brand},${C.brandD})`,
              borderRadius: R.xl, padding: S.xxl, marginBottom: S.xl, color: "#fff" }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>이번 달 정산 수익</div>
              <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>
                {thisMonthRevenue > 0 ? `${thisMonthRevenue.toLocaleString()}만원` : "—"}
              </div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                진행중 {activeJobs.length}건 · 완료 대기 {pendingAmount > 0 ? `${pendingAmount.toLocaleString()}만원` : "—"}
              </div>
            </div>

            {jobsLoading && (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 14 }}>
                로딩 중...
              </div>
            )}

            {!jobsLoading && activeJobs.length === 0 && (
              <div style={{ background: C.surface, borderRadius: R.xl, padding: "40px 20px",
                textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 6 }}>진행 중인 공사가 없어요</div>
                <div style={{ fontSize: 12, color: C.text3 }}>입찰 탭에서 견적 요청을 확인하세요</div>
              </div>
            )}

            {!jobsLoading && activeJobs.map(job => (
              <div key={job.id} onClick={() => onEscrow()}
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
