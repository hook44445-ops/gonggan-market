import { useState, useRef } from "react";
import { C, R } from "../constants";
import { getCompanies, getAdminProjectFlow, getPaymentOrders, getPartnerLeads } from "../lib/supabase";

// ── 관리자 전역 통합검색(ADMIN FINISH PACK · 2차) — 읽기 전용 ──────────────────
// 검색 대상: 고객명/업체명/전화번호/사업자번호/request_id/contract_id/order_id/대표자명
// 데이터: 기존 customers state + getCompanies(raw) + getAdminProjectFlow + getPaymentOrders.
// 신규 DB/RPC/Migration 없음. 결과 클릭 시 해당 탭으로 이동(+업체는 상세 열기)만.
const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
const shortId = (id) => (id ? String(id).slice(0, 8) : "—");

// row 의 문자열/숫자 값을 한 덩어리로 모아 부분검색(사업자번호/대표자명 등 컬럼명 몰라도 매칭)
function haystack(obj) {
  const parts = [];
  for (const v of Object.values(obj || {})) {
    if (typeof v === "string" || typeof v === "number") parts.push(String(v));
  }
  return parts.join("  ");
}
function rowMatch(obj, qLower, qDigits) {
  const hs = haystack(obj);
  if (hs.toLowerCase().includes(qLower)) return true;
  if (qDigits && qDigits.length >= 3 && onlyDigits(hs).includes(qDigits)) return true;
  return false;
}

const MAX_PER_CAT = 8;

export default function AdminGlobalSearch({ adminUserId, customers = [], companies = [], onNavigate, onOpenCompany }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null); // { customers, companies, requests, contracts, payments }
  const cache = useRef(null); // { companiesRaw, flow, payments }

  const ensureData = async () => {
    if (cache.current) return cache.current;
    setLoading(true);
    const [coRes, flowRes, payRes, leadRes] = await Promise.all([
      getCompanies().catch(() => ({ data: [] })),
      getAdminProjectFlow(adminUserId, { limit: 1000 }).catch(() => ({ data: [] })),
      getPaymentOrders({ limit: 300 }).catch(() => ({ data: [] })),
      getPartnerLeads(adminUserId, { limit: 500 }).catch(() => ({ data: [] })),
    ]);
    cache.current = {
      companiesRaw: Array.isArray(coRes.data) ? coRes.data : [],
      flow:         Array.isArray(flowRes.data) ? flowRes.data : [],
      payments:     Array.isArray(payRes.data) ? payRes.data : [],
      leads:        Array.isArray(leadRes.data) ? leadRes.data : [],
    };
    setLoading(false);
    return cache.current;
  };

  const run = async (val) => {
    const term = val.trim();
    setQ(val);
    if (term.length < 2) { setRes(null); setOpen(false); return; }
    setOpen(true);
    const data = await ensureData();
    const qLower = term.toLowerCase();
    const qDigits = onlyDigits(term);

    const cust = customers.filter((c) => rowMatch(c, qLower, qDigits)).slice(0, MAX_PER_CAT);
    const comp = data.companiesRaw.filter((c) => rowMatch(c, qLower, qDigits)).slice(0, MAX_PER_CAT);
    const flowMatch = data.flow.filter((r) => {
      const merged = { ...r, ...(r.customer || {}), cname: r.company?.name, cphone: r.company?.phone, contract: r.escrow?.id };
      return rowMatch(merged, qLower, qDigits);
    });
    const requests = flowMatch.filter((r) => !r.escrow).slice(0, MAX_PER_CAT);
    const contracts = flowMatch.filter((r) => r.escrow).slice(0, MAX_PER_CAT);
    const pays = data.payments.filter((p) => rowMatch(p, qLower, qDigits)).slice(0, MAX_PER_CAT);
    // 업체(상담) — 사업자번호/대표자명은 companies 에 없고 partner_leads 에 존재.
    const leads = data.leads.filter((l) => rowMatch(l, qLower, qDigits)).slice(0, MAX_PER_CAT);

    setRes({ customers: cust, companies: comp, requests, contracts, payments: pays, leads });
  };

  const total = res ? (res.customers.length + res.companies.length + res.requests.length + res.contracts.length + res.payments.length + (res.leads?.length ?? 0)) : 0;

  const go = (tabKey, extra) => {
    setOpen(false);
    if (extra?.company && onOpenCompany) onOpenCompany(extra.company);
    onNavigate?.(tabKey);
  };

  const Group = ({ label, color, children, count }) => count > 0 ? (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 4 }}>{label} ({count})</div>
      {children}
    </div>
  ) : null;
  const Item = ({ title, sub, onClick }) => (
    <div onClick={onClick}
      style={{ padding: "8px 10px", borderRadius: R.md, cursor: "pointer", background: C.surface, border: `1px solid ${C.bgWarm}`, marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ position: "relative", padding: "8px 16px", background: C.surface, borderBottom: `1px solid ${C.bgWarm}` }}>
      <input
        value={q}
        onChange={(e) => run(e.target.value)}
        onFocus={() => { if (res) setOpen(true); }}
        placeholder="🔍 통합검색 — 고객·업체·전화·사업자번호·request/contract/order번호·대표자명"
        style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.bg, fontFamily: "inherit", boxSizing: "border-box" }} />

      {open && (
        <div style={{ position: "absolute", left: 16, right: 16, top: 54, zIndex: 50, background: C.bg,
          border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.text3, fontWeight: 700 }}>{loading ? "검색 중..." : `결과 ${total}건`}</span>
          <button onClick={() => { setOpen(false); }} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: C.text3, cursor: "pointer" }}>×</button>
        </div>

        {!loading && total === 0 && (
          <div style={{ fontSize: 13, color: C.text4, padding: "10px 2px" }}>일치하는 결과가 없습니다</div>
        )}

        {res && (
          <>
            <Group label="고객" color={C.brand} count={res.customers.length}>
              {res.customers.map((c) => (
                <Item key={"cu" + c.id} title={c.name || "고객"} sub={c.phone}
                  onClick={() => go("customers")} />
              ))}
            </Group>
            <Group label="업체" color={C.brand} count={res.companies.length}>
              {res.companies.map((c) => {
                const norm = companies.find((x) => x.id === c.id) || null;
                return (
                  <Item key={"co" + c.id} title={c.name || "업체"}
                    sub={[c.owner_name, c.business_number, c.phone].filter(Boolean).join(" · ")}
                    onClick={() => go("companies", { company: norm })} />
                );
              })}
            </Group>
            <Group label="거래(요청)" color="#2980B9" count={res.requests.length}>
              {res.requests.map((r) => (
                <Item key={"rq" + r.request_id} title={`${r.area || "요청"} · ${r.customer?.name || "—"}`}
                  sub={`req ${shortId(r.request_id)} · ${r.company?.name || "미배정"}`}
                  onClick={() => go("project_flow")} />
              ))}
            </Group>
            <Group label="계약(거래)" color="#16A085" count={res.contracts.length}>
              {res.contracts.map((r) => (
                <Item key={"ct" + r.request_id} title={`${r.company?.name || "미배정"} · ${r.customer?.name || "—"}`}
                  sub={`contract ${shortId(r.escrow?.id)} · req ${shortId(r.request_id)}`}
                  onClick={() => go("transactions")} />
              ))}
            </Group>
            <Group label="결제" color="#E67E22" count={res.payments.length}>
              {res.payments.map((p) => (
                <Item key={"py" + (p.id || p.order_id)} title={p.order_id || shortId(p.id)}
                  sub={[p.status, p.amount != null ? `${Number(p.amount).toLocaleString()}원` : null].filter(Boolean).join(" · ")}
                  onClick={() => go("payments")} />
              ))}
            </Group>
            <Group label="업체(상담)" color="#9B59B6" count={res.leads?.length ?? 0}>
              {(res.leads ?? []).map((l) => (
                <Item key={"ld" + l.id} title={l.company_name || "상담 업체"}
                  sub={[l.owner_name, l.business_number, l.phone].filter(Boolean).join(" · ")}
                  onClick={() => go("partner_leads")} />
              ))}
            </Group>
          </>
        )}
        </div>
      )}
    </div>
  );
}
