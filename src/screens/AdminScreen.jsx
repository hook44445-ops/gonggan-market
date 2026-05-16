import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { BADGES } from "../constants/badges";
import { COMPANY_STATUS_META } from "../constants";
import {
  getCompanies,
  getUsers,
  adminReviewCompany,
  adminSetCompanyStatus,
  createNotification,
  getUserNotifications,
  getAdminLogs,
} from "../lib/supabase";

const STATUS_MAP = {
  pending:  { label: "대기중", color: C.gold,  bg: "#FBF5E8" },
  approved: { label: "승인",   color: C.green, bg: C.greenL  },
  rejected: { label: "반려",   color: C.red,   bg: "#FFF0F0" },
};

const normalizeCompany = (row) => ({
  id:            row.id,
  name:          row.name ?? "업체",
  badge:         row.badge ?? "basic",
  temp:          row.temp ?? 70,
  phone:         row.phone ?? "",
  ownerId:       row.owner_id ?? null,
  companyStatus: row.company_status ?? "PENDING",
  submittedAt:   row.created_at
    ? new Date(row.created_at).toLocaleDateString("ko-KR")
    : "",
  status: row.doc_status === "draft" ? "pending" : (row.doc_status ?? "pending"),
  docs: [
    { label: "사업자등록증",    submitted: !!row.biz_cert_url },
    { label: "시공보험 가입증", submitted: !!row.insurance_url || !!row.has_insurance },
    { label: "통장 사본",       submitted: !!row.bank_account_url },
    { label: "대표자 신분증",   submitted: !!row.id_card_url },
  ],
  deposit:    row.deposit_amount ?? 0,
  rejectNote: row.reject_note ?? "",
});

const normalizeCustomer = (row) => ({
  id:       row.id,
  name:     row.name ?? "고객",
  phone:    row.phone ?? "",
  region:   row.region ?? "",
  requests: 0,
  joinedAt: row.created_at
    ? new Date(row.created_at).toLocaleDateString("ko-KR")
    : "",
});

export default function AdminScreen({ onBack, user }) {
  const [companies, setCompanies]       = useState([]);
  const [customers, setCustomers]       = useState([]);
  const [customersErr, setCustomersErr] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [mainTab, setMainTab]           = useState("dashboard");
  const [companyTab, setCompanyTab]     = useState("pending");
  const [selected, setSelected]         = useState(null);
  const [rejectMode, setRejectMode]     = useState(false);
  const [rejectNote, setRejectNote]     = useState("");
  const [confirm, setConfirm]           = useState(null);
  const [actionLoading, setActionLoading]   = useState(false);
  const [statusReason, setStatusReason]     = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [notifications, setNotifications]   = useState([]);
  const [docModal, setDocModal]             = useState(null); // null | "biz" | "insurance" | "badge"
  const [holdMode, setHoldMode]             = useState(false);
  const [holdNote, setHoldNote]             = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCompanies().then(({ data }) =>
        setCompanies((data ?? [])
          .filter(c => c.doc_status !== "draft")
          .map(normalizeCompany))
      ),
      getUsers({ role: "consumer" }).then(({ data, error }) => {
        if (error || !data) { setCustomersErr(true); return; }
        setCustomers(data.map(normalizeCustomer));
      }),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getUserNotifications(user.id, { limit: 50 }).then(({ data }) => {
      if (data) setNotifications(data);
    });
  }, [user?.id]);

  const stats = {
    pending:    companies.filter(c => c.status === "pending").length,
    approved:   companies.filter(c => c.status === "approved").length,
    rejected:   companies.filter(c => c.status === "rejected").length,
    customers:  customers.length,
    disputes:   0,
    settlements: 0,
  };

  const filtered = companyTab === "all"
    ? companies
    : companies.filter(c => c.status === companyTab);

  const handleApprove = async (company) => {
    setActionLoading(true);
    const { error } = await adminReviewCompany(company.id, user?.id ?? null, "approved");
    if (!error) {
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, status: "approved", rejectNote: "" } : c
      ));
      if (company.ownerId) {
        await createNotification({
          userId:      company.ownerId,
          type:        "COMPANY_APPROVED",
          title:       "업체 승인 완료",
          message:     `${company.name} 업체가 승인되었습니다. 이제 견적 요청을 받을 수 있습니다.`,
          relatedId:   company.id,
          relatedType: "company",
        });
      }
    }
    setActionLoading(false);
    setSelected(null);
    setConfirm(null);
  };

  const handleReject = async (company, note) => {
    setActionLoading(true);
    const { error } = await adminReviewCompany(company.id, user?.id ?? null, "rejected", note);
    if (!error) {
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, status: "rejected", rejectNote: note } : c
      ));
      if (company.ownerId) {
        await createNotification({
          userId:      company.ownerId,
          type:        "COMPANY_REJECTED",
          title:       "업체 반려 처리",
          message:     `${company.name} 업체가 반려되었습니다. 사유: ${note}`,
          relatedId:   company.id,
          relatedType: "company",
        });
      }
    }
    setActionLoading(false);
    setSelected(null);
    setRejectMode(false);
    setRejectNote("");
    setConfirm(null);
  };

  const handleCompanyStatus = async (company, newStatus) => {
    setActionLoading(true);
    const { error } = await adminSetCompanyStatus(company.id, user?.id ?? null, newStatus, statusReason || null);
    if (!error) {
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, companyStatus: newStatus } : c
      ));
      if (selected?.id === company.id) setSelected(prev => ({ ...prev, companyStatus: newStatus }));
      if (company.ownerId) {
        const meta = COMPANY_STATUS_META[newStatus];
        await createNotification({
          userId:      company.ownerId,
          type:        "COMPANY_STATUS_CHANGED",
          title:       `업체 상태 변경: ${meta?.label ?? newStatus}`,
          message:     statusReason || `${company.name} 업체 상태가 ${meta?.label ?? newStatus}로 변경되었습니다.`,
          relatedId:   company.id,
          relatedType: "company",
        });
      }
    }
    setActionLoading(false);
    setShowStatusModal(false);
    setStatusReason("");
  };

  const openDetail = (company) => {
    setSelected(company);
    setRejectMode(false);
    setRejectNote("");
    setShowStatusModal(false);
    setStatusReason("");
    setHoldMode(false);
    setHoldNote("");
    setDocModal(null);
  };

  const MAIN_TABS = [
    ["dashboard",      "대시보드"],
    ["companies",      "업체관리"],
    ["customers",      "고객관리"],
    ["disputes",       "분쟁관리"],
    ["settlements",    "정산관리"],
    ["notifications",  "알림"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* Header */}
      <div style={{ background: C.surface, padding: "14px 20px", borderBottom: `1px solid ${C.bgWarm}`,
        position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: S.md }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>관리자 대시보드</div>
          <div style={{ fontSize: 11, color: C.text4 }}>공간마켓 운영 관리</div>
        </div>
        {stats.pending > 0 && (
          <div style={{ marginLeft: "auto", background: C.red, color: "#fff",
            borderRadius: R.full, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
            심사 대기 {stats.pending}건
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: "max-content", padding: "0 16px" }}>
          {MAIN_TABS.map(([v, l]) => (
            <button key={v} onClick={() => setMainTab(v)}
              style={{ padding: "12px 14px", border: "none", background: "transparent",
                fontWeight: mainTab === v ? 800 : 500, fontSize: 13,
                color: mainTab === v ? C.brand : C.text3,
                borderBottom: `2.5px solid ${mainTab === v ? C.brand : "transparent"}`,
                cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 90px` }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>
            데이터 로딩 중...
          </div>
        )}

        {!loading && (
          <>
            {/* ── Dashboard ── */}
            {mainTab === "dashboard" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>📊 현황 요약</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
                  {[
                    ["업체 심사 대기", stats.pending,    C.gold,  "companies"],
                    ["승인된 업체",    stats.approved,   C.green, "companies"],
                    ["등록 고객",      stats.customers,  C.brand, "customers"],
                    ["분쟁 대기",      stats.disputes,   C.red,   "disputes"],
                    ["정산 대기",      stats.settlements, C.brand, "settlements"],
                    ["반려된 업체",    stats.rejected,   C.text4, "companies"],
                  ].map(([label, count, color, tab]) => (
                    <div key={label} onClick={() => setMainTab(tab)}
                      style={{ background: C.surface, borderRadius: R.lg,
                        padding: S.xl, textAlign: "center", border: `1px solid ${C.bgWarm}`, cursor: "pointer" }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color }}>{count}</div>
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.navyL, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.trustM}` }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: S.md }}>🛡 공간마켓 운영 현황</div>
                  {[
                    ["플랫폼 수수료 (고객)", "3% + VAT"],
                    ["플랫폼 수수료 (업체)", "4% + VAT"],
                    ["에스크로 구조",        "10/20/40/30"],
                    ["초기 파트너 혜택",     "수수료 동일 · 배지 우선"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between",
                      padding: `${S.xs}px 0`, borderBottom: `1px solid ${C.trustM}` }}>
                      <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Company Management ── */}
            {mainTab === "companies" && (
              <div>
                <div style={{ display: "flex", gap: S.sm, marginBottom: S.xl }}>
                  {[
                    ["대기중", stats.pending,  C.gold ],
                    ["승인",   stats.approved, C.green],
                    ["반려",   stats.rejected, C.red  ],
                  ].map(([label, count, color]) => (
                    <div key={label} style={{ flex: 1, background: C.surface, borderRadius: R.lg,
                      padding: `${S.lg}px ${S.sm}px`, textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color }}>{count}</div>
                      <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", background: C.bg, borderRadius: R.lg, padding: 3, marginBottom: S.xl }}>
                  {[["pending","대기중"],["approved","승인"],["rejected","반려"],["all","전체"]].map(([v, l]) => (
                    <button key={v} onClick={() => setCompanyTab(v)}
                      style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: R.md, cursor: "pointer",
                        background: companyTab === v ? C.surface : "transparent",
                        color: companyTab === v ? C.text1 : C.text3,
                        fontWeight: companyTab === v ? 800 : 500, fontSize: 12,
                        boxShadow: companyTab === v ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
                      {l}
                    </button>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>해당 항목이 없습니다</div>
                  </div>
                ) : filtered.map(company => {
                  const bm = BADGES[company.badge] || BADGES.basic;
                  const sm = STATUS_MAP[company.status] || STATUS_MAP.pending;
                  const allOk = company.docs.every(d => d.submitted);
                  return (
                    <div key={company.id} onClick={() => openDetail(company)}
                      style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm,
                        border: `1.5px solid ${company.status === "pending" ? C.bgWarm : sm.color + "44"}`,
                        cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 5 }}>{company.name}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ background: bm.bg, color: bm.color, borderRadius: R.full,
                              padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{bm.icon} {bm.label}</span>
                            <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full,
                              padding: "2px 8px", fontSize: 11 }}>보증금 {company.deposit.toLocaleString()}만원</span>
                          </div>
                        </div>
                        <span style={{ background: sm.bg, color: sm.color, borderRadius: R.full,
                          padding: "3px 10px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{sm.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
                        {!allOk && (
                          <span style={{ fontSize: 11, color: C.red, background: "#FFF0F0",
                            borderRadius: R.sm, padding: "2px 6px", fontWeight: 700 }}>⚠ 서류 미완</span>
                        )}
                        <span style={{ fontSize: 11, color: C.text4 }}>제출 {company.submittedAt}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: C.brand, fontWeight: 700 }}>상세 보기 →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Customer Management ── */}
            {mainTab === "customers" && (
              <div>
                {customersErr ? (
                  <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl,
                    textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 8 }}>서비스 권한 필요</div>
                    <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
                      고객 목록 조회는 서버 측 관리자 권한이 필요합니다.<br/>
                      Supabase 서비스 롤 키를 통한 API 연동이 필요합니다.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                      고객 목록 <span style={{ color: C.brand }}>{customers.length}명</span>
                    </div>
                    {customers.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>
                        등록된 고객이 없습니다
                      </div>
                    ) : customers.map(customer => (
                      <div key={customer.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                        marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{customer.name}</div>
                          <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full,
                            padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>견적 {customer.requests}건</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.text3 }}>📱 {customer.phone} · 📍 {customer.region}</div>
                        <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>가입일: {customer.joinedAt}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Dispute Management ── */}
            {mainTab === "disputes" && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, marginBottom: 8 }}>분쟁 대기 없음</div>
                <div style={{ fontSize: 13, color: C.text3 }}>실시간 분쟁 내역은 거래 발생 시 표시됩니다</div>
              </div>
            )}

            {/* ── Settlement Management ── */}
            {mainTab === "settlements" && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, marginBottom: 8 }}>정산 대기 없음</div>
                <div style={{ fontSize: 13, color: C.text3 }}>에스크로 정산 내역은 거래 완료 시 표시됩니다</div>
              </div>
            )}

            {/* ── Notifications ── */}
            {mainTab === "notifications" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                  알림 <span style={{ color: C.brand }}>{notifications.length}건</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>새 알림이 없습니다</div>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id}
                    style={{ background: n.is_read ? C.surface : C.brandL, borderRadius: R.xl,
                      padding: S.xl, marginBottom: S.sm,
                      border: `1px solid ${n.is_read ? C.bgWarm : C.brandM}`, cursor: "pointer" }}
                    onClick={() => {
                      if (n.related_type === "company") setMainTab("companies");
                      if (n.related_type === "dispute") setMainTab("disputes");
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.xs }}>
                      <div style={{ fontSize: 14, fontWeight: n.is_read ? 600 : 800, color: C.text1 }}>{n.title}</div>
                      {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.brand, flexShrink: 0, marginTop: 4 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: C.text4, marginTop: S.xs }}>
                      {new Date(n.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                ))}

                {/* Derived activity: recent pending companies */}
                {companies.filter(c => c.status === "pending").length > 0 && (
                  <div style={{ marginTop: S.xl }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text2, marginBottom: S.md }}>📋 최근 심사 대기</div>
                    {companies.filter(c => c.status === "pending").map(c => (
                      <div key={c.id}
                        onClick={() => { setMainTab("companies"); openDetail(c); }}
                        style={{ background: C.surface, borderRadius: R.xl, padding: `${S.md}px ${S.xl}px`,
                          marginBottom: S.sm, border: `1px solid ${C.bgWarm}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: C.text3 }}>신규 업체 가입 · {c.submittedAt}</div>
                        </div>
                        <span style={{ background: "#FBF5E8", color: C.gold, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>심사대기</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Company Detail bottom sheet */}
      {selected && mainTab === "companies" && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
            display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setRejectMode(false); setHoldMode(false); setDocModal(null); } }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%",
            maxWidth: 480, padding: "24px 24px 40px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />

            {(() => {
              const bm = BADGES[selected.badge] || BADGES.basic;
              return (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.xl }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 6 }}>{selected.name}</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <span style={{ background: bm.bg, color: bm.color, borderRadius: R.full,
                        padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{bm.icon} {bm.label}</span>
                      <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full,
                        padding: "3px 10px", fontSize: 12 }}>온도 {selected.temp}°</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text4 }}>📞 {selected.phone}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{selected.deposit.toLocaleString()}만원</div>
                    <div style={{ fontSize: 11, color: C.text4 }}>납부 보증금</div>
                    <div style={{ fontSize: 11, color: bm.color, fontWeight: 700, marginTop: 2 }}>최대 {bm.maxJob} 수주</div>
                    <button onClick={() => setDocModal("badge")}
                      style={{ fontSize: 11, color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 700, marginTop: 4, textDecoration: "underline" }}>
                      배지 상세 ›
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Documents checklist */}
            <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg,
              marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>📄 제출 서류</div>
              {selected.docs.map((doc, i) => (
                <div key={i}
                  onClick={() => {
                    if (!doc.submitted) return;
                    if (i === 0) setDocModal("biz");
                    if (i === 1) setDocModal("insurance");
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: `${S.sm}px 0`,
                    borderBottom: i < selected.docs.length - 1 ? `1px solid ${C.bgWarm}` : "none",
                    cursor: doc.submitted && i < 2 ? "pointer" : "default" }}>
                  <span style={{ fontSize: 13, color: C.text2 }}>
                    {doc.label} {doc.submitted && i < 2 ? "›" : ""}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: doc.submitted ? C.green : C.red }}>
                    {doc.submitted ? "✓ 제출" : "✗ 미제출"}
                  </span>
                </div>
              ))}
            </div>

            {/* Submission info */}
            <div style={{ display: "flex", justifyContent: "space-between",
              padding: `${S.sm}px 0`, marginBottom: S.xl,
              borderTop: `1px solid ${C.bgWarm}`, borderBottom: `1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize: 12, color: C.text3 }}>신청일</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{selected.submittedAt}</span>
            </div>

            {/* Company operational status */}
            {(() => {
              const csMeta = COMPANY_STATUS_META[selected.companyStatus] ?? COMPANY_STATUS_META.PENDING;
              return (
                <div style={{ marginBottom: S.xl }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>운영 상태</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: csMeta.bg, borderRadius: R.lg, padding: `${S.sm}px ${S.lg}px`,
                    border: `1px solid ${csMeta.color}44`, marginBottom: S.sm }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: csMeta.color }}>{csMeta.label}</span>
                    <button onClick={() => setShowStatusModal(v => !v)}
                      style={{ fontSize: 11, fontWeight: 700, color: C.brand, background: "none", border: "none", cursor: "pointer" }}>
                      상태 변경 ▾
                    </button>
                  </div>
                  {showStatusModal && (
                    <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm, marginBottom: S.sm }}>
                        {["ACTIVE","PAUSED","SUSPENDED","BLACKLISTED"].map(st => {
                          const m = COMPANY_STATUS_META[st];
                          return (
                            <button key={st}
                              onClick={() => handleCompanyStatus(selected, st)}
                              disabled={actionLoading || selected.companyStatus === st}
                              style={{ padding: "10px", borderRadius: R.md, border: `1.5px solid ${m.color}44`,
                                background: selected.companyStatus === st ? m.bg : C.surface,
                                color: m.color, fontWeight: 700, fontSize: 12, cursor: "pointer",
                                opacity: selected.companyStatus === st ? 0.6 : 1 }}>
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                      <input value={statusReason} onChange={e => setStatusReason(e.target.value)}
                        placeholder="변경 사유 (선택)"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: R.md,
                          border: `1px solid ${C.bgWarm}`, fontSize: 12, outline: "none",
                          boxSizing: "border-box", fontFamily: "inherit", background: C.surface }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Actions for pending */}
            {selected.status === "pending" && (
              !rejectMode ? (
                !holdMode ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: S.sm }}>
                    <button onClick={() => setRejectMode(true)} disabled={actionLoading}
                      style={{ padding: "13px", background: "#FFF0F0", color: C.red,
                        border: `1px solid ${C.red}33`, borderRadius: R.lg,
                        fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      ✗ 반려
                    </button>
                    <button onClick={() => setHoldMode(true)} disabled={actionLoading}
                      style={{ padding: "13px", background: "#FBF5E8", color: C.gold,
                        border: `1px solid ${C.gold}44`, borderRadius: R.lg,
                        fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      ⏸ 보류
                    </button>
                    <button onClick={() => setConfirm({ type: "approve", company: selected })} disabled={actionLoading}
                      style={{ padding: "13px", background: C.green, color: "#fff",
                        border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                        cursor: "pointer", boxShadow: `0 4px 14px ${C.green}44` }}>
                      ✓ 승인하기
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: S.sm }}>보류 사유 입력</div>
                    <textarea
                      value={holdNote}
                      onChange={e => setHoldNote(e.target.value)}
                      placeholder="보류 사유를 입력하세요 (서류 보완 요청 등)"
                      style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                        background: C.surface2, fontSize: 13, color: C.text1, resize: "none", height: 80,
                        boxSizing: "border-box", marginBottom: S.md, outline: "none", fontFamily: "inherit", lineHeight: 1.6 }}
                    />
                    <div style={{ display: "flex", gap: S.sm }}>
                      <button onClick={() => { setHoldMode(false); setHoldNote(""); }}
                        style={{ flex: 1, padding: "13px", background: C.bg, color: C.text2,
                          border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        취소
                      </button>
                      <button
                        onClick={async () => {
                          if (!holdNote.trim()) return;
                          setActionLoading(true);
                          const { error } = await adminReviewCompany(selected.id, user?.id ?? null, "pending", holdNote);
                          if (!error) {
                            if (selected.ownerId) {
                              await createNotification({
                                userId:      selected.ownerId,
                                type:        "ADMIN_ACTION",
                                title:       "서류 검토 보류",
                                message:     `${selected.name} 업체 서류가 보류되었습니다. 사유: ${holdNote}`,
                                relatedId:   selected.id,
                                relatedType: "company",
                              });
                            }
                          }
                          setActionLoading(false);
                          setHoldMode(false);
                          setHoldNote("");
                        }}
                        disabled={actionLoading}
                        style={{ flex: 2, padding: "13px",
                          background: holdNote.trim() ? C.gold : C.bgWarm,
                          color: holdNote.trim() ? "#fff" : C.text4,
                          border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                          cursor: holdNote.trim() ? "pointer" : "not-allowed" }}>
                        보류 처리하기
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: S.sm }}>반려 사유 입력</div>
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="반려 사유를 입력하세요 (업체에게 전달됩니다)"
                    style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                      background: C.surface2, fontSize: 13, color: C.text1, resize: "none", height: 90,
                      boxSizing: "border-box", marginBottom: S.md, outline: "none", fontFamily: "inherit",
                      lineHeight: 1.6 }}
                  />
                  <div style={{ display: "flex", gap: S.sm }}>
                    <button onClick={() => { setRejectMode(false); setRejectNote(""); }}
                      style={{ flex: 1, padding: "13px", background: C.bg, color: C.text2,
                        border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      취소
                    </button>
                    <button
                      onClick={() => rejectNote.trim() && setConfirm({ type: "reject", company: selected, note: rejectNote })}
                      disabled={actionLoading}
                      style={{ flex: 2, padding: "13px",
                        background: rejectNote.trim() ? C.red : C.bgWarm,
                        color: rejectNote.trim() ? "#fff" : C.text4,
                        border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                        cursor: rejectNote.trim() ? "pointer" : "not-allowed" }}>
                      반려 처리하기
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Status display for non-pending */}
            {selected.status !== "pending" && (
              <div style={{ background: selected.status === "approved" ? C.greenL : "#FFF0F0",
                borderRadius: R.lg, padding: S.lg, display: "flex", alignItems: "flex-start", gap: S.sm,
                border: `1px solid ${selected.status === "approved" ? C.green + "33" : C.red + "33"}` }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>
                  {selected.status === "approved" ? "✅" : "❌"}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700,
                    color: selected.status === "approved" ? C.green : C.red }}>
                    {selected.status === "approved" ? "승인 완료" : "반려됨"}
                  </div>
                  {selected.rejectNote && (
                    <div style={{ fontSize: 12, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
                      {selected.rejectNote}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Biz cert modal */}
      {docModal === "biz" && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}
          onClick={() => setDocModal(null)}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>📄 사업자등록증</div>
            {[
              ["상호명",   selected.name],
              ["전화번호", selected.phone || "—"],
              ["서류 상태", selected.docs[0]?.submitted ? "✓ 제출 완료" : "✗ 미제출"],
              ["검토 상태", selected.status === "approved" ? "승인" : selected.status === "rejected" ? "반려" : "검토 대기"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: S.xl, background: C.brandL, borderRadius: R.lg, padding: S.md, fontSize: 12, color: C.brand }}>
              실제 서류 내용은 업로드된 원본 파일을 확인하세요
            </div>
            <button onClick={() => setDocModal(null)}
              style={{ width: "100%", marginTop: S.lg, padding: S.lg, background: C.bg,
                color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Insurance modal */}
      {docModal === "insurance" && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}
          onClick={() => setDocModal(null)}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🛡 시공보험증서</div>
            {[
              ["업체명",   selected.name],
              ["보험 가입", selected.docs[1]?.submitted ? "✓ 가입 완료" : "✗ 미가입"],
              ["보증금 할인", selected.docs[1]?.submitted ? "20% 적용" : "미적용 (30% 기준)"],
              ["검토 상태", selected.status === "approved" ? "승인" : selected.status === "rejected" ? "반려" : "검토 대기"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: S.xl, background: C.brandL, borderRadius: R.lg, padding: S.md, fontSize: 12, color: C.brand }}>
              보험증권 원본은 업로드된 파일에서 확인하세요
            </div>
            <button onClick={() => setDocModal(null)}
              style={{ width: "100%", marginTop: S.lg, padding: S.lg, background: C.bg,
                color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Badge modal */}
      {docModal === "badge" && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}
          onClick={() => setDocModal(null)}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            {(() => {
              const bm2 = BADGES[selected.badge] || BADGES.basic;
              return (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🏆 공간보증 배지</div>
                  {[
                    ["배지 등급",      `${bm2.icon} ${bm2.label}`],
                    ["가능 공사 금액", bm2.maxJob],
                    ["필요 보증금",    `${selected.deposit.toLocaleString()}만원`],
                    ["보험 제출 여부", selected.docs[1]?.submitted ? "✓ 제출" : "✗ 미제출"],
                    ["승인 상태",      selected.status === "approved" ? "✓ 승인" : selected.status === "rejected" ? "✗ 반려" : "검토 중"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between",
                      padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                      <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
                    </div>
                  ))}
                </>
              );
            })()}
            <button onClick={() => setDocModal(null)}
              style={{ width: "100%", marginTop: S.lg, padding: S.lg, background: C.bg,
                color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, padding: `0 ${S.xl}px` }}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 320 }}>
            <div style={{ textAlign: "center", marginBottom: S.xl }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {confirm.type === "approve" ? "✅" : "❌"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>
                {confirm.type === "approve" ? "승인하시겠어요?" : "반려하시겠어요?"}
              </div>
              <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.7 }}>
                <b style={{ color: C.text1 }}>{confirm.company.name}</b> 업체를<br/>
                {confirm.type === "approve"
                  ? "승인 처리합니다. 업체에게 알림이 전달됩니다."
                  : "반려 처리합니다. 사유가 업체에 전달됩니다."}
              </div>
            </div>
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => setConfirm(null)} disabled={actionLoading}
                style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2,
                  border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                취소
              </button>
              <button
                onClick={() => confirm.type === "approve"
                  ? handleApprove(confirm.company)
                  : handleReject(confirm.company, confirm.note)}
                disabled={actionLoading}
                style={{ flex: 2, padding: S.xl,
                  background: confirm.type === "approve" ? C.green : C.red,
                  color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15,
                  cursor: "pointer", opacity: actionLoading ? 0.7 : 1,
                  boxShadow: `0 4px 16px ${confirm.type === "approve" ? C.green : C.red}44` }}>
                {actionLoading ? "처리 중..." : confirm.type === "approve" ? "승인하기" : "반려하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
