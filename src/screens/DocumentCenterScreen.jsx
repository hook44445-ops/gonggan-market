// 업체 서류함 = 「내 한도」 화면 (2026-09-24 다시 짬)
//
// 왜 이 구조인가
//   예전 서류함은 「필수 서류 제출 현황 3/11 · 미제출 서류가 있으면 업체 승인이 지연」으로 시작했다.
//   지금 정책(가입하면 바로 활동, 서류는 원할 때 하나씩 — 낼수록 받을 수 있는 공사가 커진다)과 반대로 읽혔다.
//   이제 순서가 정책을 그대로 따른다.
//     1) 지금 한도 — 공사 1건 얼마까지 + 딴 엠블럼
//     2) 다음 한 칸 — 무엇 하나를 내면 얼마까지(누르면 그 서류 칸이 열린다)
//     3) 한도 계단 — 칸마다 엠블럼. 딴 것은 금빛, 못 딴 것은 흐린 빈자리(모으고 싶게)
//     4) 서류 — 「한도를 여는 서류 / 처음 한 번 동의 / 선택」
//
// 그림: 힉스필드(gpt_image_2_5)로 뽑았다. 엠블럼은 신뢰 엠블럼(TrustEmblems)과 한 가족 —
//   join(가입·열린 문) · biz · insurance · deposit · license(실내건축공사업). 배경은 /images/limit/hero.webp.
// 값은 전부 «관리자가 확인한 것»만 본다(limitStateOf). 원본 업체 행(companyRow)이 있으면 그걸 쓴다.
import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getCompanyDocuments } from "../lib/supabase";
import { DOCUMENT_TEMPLATES, UPLOAD_DOCUMENT_TEMPLATES } from "../constants/documentTemplates";
import DocumentUploadCard from "../components/DocumentUploadCard";
import DocumentChecklistCard from "../components/DocumentChecklistCard";
import DocumentDetailModal from "../components/DocumentDetailModal";
import { bidLimit, limitText, nextUnlock, limitStateOf, ladderKeyOf, maxedText, LADDER } from "../lib/partnerTier";

const INK = "#F4EFE4";                 // 어두운 바탕 위 글자
const GOLD = "#D6A756";
const DEEP = "#0E2B1D";                // 로고 v5 와 같은 깊은 초록
const GOLD_LINE = "rgba(214,167,86,0.35)";

const DOC_ICONS = {
  business_license:      "📋",
  insurance_certificate: "🔒",
  operation_pledge:      "📝",
  escrow_agreement:      "🛡",
  service_terms:         "📄",
  privacy_policy:        "🔐",
  location_terms:        "📍",
  bankbook_copy:         "🏦",
  qualification_license: "🏅",
  interior_license:      "🏛",
  portfolio:             "🖼",
  badge_application:     "🔰",
};

// 한도를 여는 서류 — 계단 순서대로. 보증금은 서류가 아니라 공간보증에서 건다.
const UNLOCK_TYPES = ["business_license", "insurance_certificate", "interior_license"];
const UNLOCK_DOC = { biz: "business_license", insurance: "insurance_certificate", license: "interior_license" };

const uploadMeta = (t) => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📄", type: "UPLOAD" });
const checkMeta  = (t) => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📝", type: "CHECKLIST" });

const COMPANY_UPLOADS = UPLOAD_DOCUMENT_TEMPLATES.filter(t => t.target === "company");
const UNLOCK_DOCS = UNLOCK_TYPES.map(type => COMPANY_UPLOADS.find(t => t.type === type)).filter(Boolean).map(uploadMeta);
const CONSENT_DOCS = DOCUMENT_TEMPLATES
  .filter(t => (t.target === "company" || t.target === "all") && t.required).map(checkMeta);
const OPTIONAL_DOCS = [
  ...COMPANY_UPLOADS.filter(t => !UNLOCK_TYPES.includes(t.type)).map(uploadMeta),
  ...DOCUMENT_TEMPLATES.filter(t => t.target === "company" && !t.required).map(checkMeta),
];
const ALL_DOCS = [...UNLOCK_DOCS, ...CONSENT_DOCS, ...OPTIONAL_DOCS];

// 계단 칸 ↔ 엠블럼 그림
const STEP_EMBLEM = { none: "join", biz: "biz", insurance: "insurance", premium: "deposit", license: "license" };
// 칸마다 «무엇을 내면» 한 줄 — 1,000만원 초과부터 보증금이 필수라는 게 보여야 한다.
const STEP_NOTE = {
  none:      "가입하면 바로 · 도배·부분 수리",
  biz:       "사업자등록증 · 관리자가 확인",
  insurance: "시공보험 증권 · 관리자가 확인",
  premium:   "1,000만원 초과부터 · 공사금액의 10% 보증금",
  license:   "보증금의 10배까지 · 대형 공사",
};

function Emblem({ name, size = 36, lit = true, style }) {
  return (
    <img src={`/images/emblem/${name}${size > 64 ? "" : "-sm"}.webp`} alt="" aria-hidden="true" width={size} height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0,
        filter: lit ? "drop-shadow(0 2px 6px rgba(214,167,86,0.35))" : "grayscale(1) brightness(1.15)",
        opacity: lit ? 1 : 0.32, ...style }} />
  );
}

// 1) 지금 한도
function LimitHero({ state }) {
  const now = bidLimit(state);
  const key = ladderKeyOf(state);
  const step = LADDER.find(r => r.key === key);
  const earned = { join: true, biz: state.biz, insurance: state.insurance, deposit: (Number(state.depositManwon) || 0) > 0, license: state.license };
  return (
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", marginBottom: S.md,
      background: `${DEEP} url(/images/limit/hero.webp) right center / cover no-repeat`, color: INK,
      padding: "22px 20px 18px", boxShadow: "0 10px 30px rgba(14,43,29,0.28)" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${DEEP} 0%, rgba(14,43,29,0.86) 48%, rgba(14,43,29,0.15) 100%)` }} />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: GOLD, fontWeight: 700 }}>공사 1건 한도</div>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", marginTop: 4, lineHeight: 1.15 }}>
          {limitText(now)}<span style={{ fontSize: 16, fontWeight: 700, opacity: 0.7 }}>까지</span>
        </div>
        <div style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>
          지금 · {(step?.label ?? "가입만").replace(/^\+ /, "")}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 16, alignItems: "center" }}>
          {["join", "biz", "insurance", "deposit", "license"].map(n => <Emblem key={n} name={n} size={34} lit={!!earned[n]} />)}
        </div>
      </div>
    </div>
  );
}

// 2) 다음 한 칸
function NextStep({ state, onOpenDoc }) {
  const next = nextUnlock(state);
  if (!next) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: "14px 16px",
        marginBottom: S.xl, fontSize: 13.5, color: C.text1, lineHeight: 1.6 }}>
        {maxedText(state)}
      </div>
    );
  }
  const docType = UNLOCK_DOC[next.key];
  const emblem = STEP_EMBLEM[next.key] ?? "deposit";
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", background: "#FFFDF8", border: `1px solid ${GOLD_LINE}`,
      borderRadius: R.xl, padding: "14px 16px", marginBottom: S.xl }}>
      <Emblem name={emblem} size={52} lit={false} style={{ opacity: 0.55 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.text3, fontWeight: 700 }}>다음 한 칸</div>
        <div style={{ fontSize: 14, color: C.text1, lineHeight: 1.5, marginTop: 2 }}>
          <b>{next.ask}</b>{docType ? "을 내면" : "을 걸면"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#9A7430", letterSpacing: "-0.02em" }}>{limitText(next.to)}까지</div>
        {/* 2안(보험 없이 보증금)은 안내하지 않고 문의로만 받는다 */}
        {next.key === "insurance" && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>보험 가입이 어려우면 고객센터로 문의해 주세요</div>}
      </div>
      {docType ? (
        <button type="button" onClick={() => onOpenDoc(docType)}
          style={{ flexShrink: 0, background: DEEP, color: INK, border: "none", borderRadius: R.full,
            padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          내기 ›
        </button>
      ) : (
        <div style={{ flexShrink: 0, fontSize: 11.5, color: C.text3, textAlign: "right", lineHeight: 1.5 }}>마이페이지<br />「공간보증」</div>
      )}
    </div>
  );
}

// 3) 한도 계단 — 아래(가입)에서 위(면허)로 오르는 모양. 칸이 오를수록 오른쪽으로 한 걸음씩 들어간다.
function Staircase({ state }) {
  const at = LADDER.findIndex(r => r.key === ladderKeyOf(state));
  const rows = LADDER.map((r, i) => ({ ...r, i })).reverse();   // 위가 높은 칸
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>한도 계단</div>
      <div style={{ fontSize: 12.5, color: C.text3, marginBottom: S.md }}>증빙을 하나 낼 때마다 한 칸 오릅니다</div>
      <div>
        {rows.map(r => {
          const done = r.i < at, now = r.i === at, locked = r.i > at;
          const top = r.key === "license";
          return (
            <div key={r.key} style={{ marginLeft: r.i * 4, marginRight: (LADDER.length - 1 - r.i) * 4, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 16,
                background: now ? DEEP : C.surface,
                border: now ? "none" : `1px solid ${top ? GOLD_LINE : C.bgWarm}`,
                boxShadow: now ? "0 8px 22px rgba(14,43,29,0.25)" : "none" }}>
                <Emblem name={STEP_EMBLEM[r.key]} size={40} lit={!locked} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {now && <div style={{ fontSize: 10.5, fontWeight: 800, color: GOLD, letterSpacing: "0.08em" }}>지금</div>}
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: now ? INK : locked ? C.text2 : C.text3, wordBreak: "keep-all" }}>
                    {done ? "✓ " : ""}{r.label.replace(/^\+ /, "")}
                  </div>
                  <div style={{ fontSize: 11.5, color: now ? "rgba(244,239,228,0.72)" : C.text3, marginTop: 1, wordBreak: "keep-all" }}>{STEP_NOTE[r.key]}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, whiteSpace: "nowrap",
                  color: now ? GOLD : locked ? C.text1 : C.text4 }}>
                  {top ? `최대 ${limitText(r.limit)}` : limitText(r.limit)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocCard({ docMeta, existingDoc, onClick }) {
  const docData = { ...docMeta, ...(existingDoc ?? {}), title: docMeta.title, icon: docMeta.icon, document_type: docMeta.document_type };
  if (docMeta.type === "UPLOAD") return <DocumentUploadCard doc={docData} onClick={() => onClick(docData)} />;
  return <DocumentChecklistCard doc={docData} onClick={() => onClick(docData)} />;
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.text3, marginTop: 2, marginBottom: S.md }}>{sub}</div>}
      {children}
    </div>
  );
}

function Fold({ label, sub, open, onToggle }) {
  return (
    <div onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface,
        borderRadius: R.xl, padding: "14px 16px", border: `1px solid ${C.bgWarm}`, cursor: "pointer", marginBottom: open ? S.md : 0 }}>
      <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 14, color: C.text3 }}>{open ? "▲" : "▼"}</span>
    </div>
  );
}

export default function DocumentCenterScreen({ company, companyRow, user, onBack }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalDoc, setModalDoc] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    getCompanyDocuments(company.id).then(({ data }) => {
      setDocs(data ?? []);
      setLoading(false);
    });
  }, [company?.id]);

  const getDoc = (docType) => docs.find(d => d.document_type === docType);
  const openDoc = (type) => {
    const meta = ALL_DOCS.find(d => d.document_type === type);
    if (meta) setModalDoc({ ...meta, ...(getDoc(type) ?? {}), title: meta.title, icon: meta.icon, document_type: type });
  };

  const handleDocChange = (updated) => {
    if (!updated) return;
    setDocs(prev => {
      const idx = prev.findIndex(d => d.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    if (modalDoc?.document_type === updated.document_type) {
      setModalDoc(prev => ({ ...prev, ...updated }));
    }
  };

  const state = limitStateOf(companyRow ?? company ?? {});
  const agreed = CONSENT_DOCS.filter(d => ["submitted", "reviewing", "approved"].includes(getDoc(d.document_type)?.review_status)).length;

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
        <button onClick={onBack} aria-label="뒤로"
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.text3, padding: 0, fontWeight: 700 }}>
          ←
        </button>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text1 }}>내 한도 · 서류</div>
      </div>

      <LimitHero state={state} />
      <NextStep state={state} onOpenDoc={openDoc} />
      <Staircase state={state} />

      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <>
          <Section title="한도를 여는 서류" sub="원할 때 하나씩 — 관리자가 확인하면 계단이 한 칸 오릅니다">
            {UNLOCK_DOCS.map(m => <DocCard key={m.document_type} docMeta={m} existingDoc={getDoc(m.document_type)} onClick={setModalDoc} />)}
          </Section>

          <div style={{ marginBottom: S.md }}>
            <Fold label="처음 한 번 동의" sub={`약관·정책 ${agreed}/${CONSENT_DOCS.length} 동의`}
              open={showConsent} onToggle={() => setShowConsent(v => !v)} />
            {showConsent && CONSENT_DOCS.map(m => <DocCard key={m.document_type} docMeta={m} existingDoc={getDoc(m.document_type)} onClick={setModalDoc} />)}
          </div>

          <div>
            <Fold label="선택 서류" sub={OPTIONAL_DOCS.slice(0, 4).map(d => d.title).join(" · ")}
              open={showOptional} onToggle={() => setShowOptional(v => !v)} />
            {showOptional && OPTIONAL_DOCS.map(m => <DocCard key={m.document_type} docMeta={m} existingDoc={getDoc(m.document_type)} onClick={setModalDoc} />)}
          </div>
        </>
      )}

      <div style={{ marginTop: S.xl, fontSize: 12, color: C.text3, lineHeight: 1.7, textAlign: "center" }}>
        제출 서류는 업체 확인 목적으로만 씁니다
      </div>

      {modalDoc && (
        <DocumentDetailModal
          doc={modalDoc}
          companyId={company?.id}
          userId={user?.id}
          onClose={() => setModalDoc(null)}
          onChange={handleDocChange}
        />
      )}
    </div>
  );
}
