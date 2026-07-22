import { useState, useEffect, useRef } from "react";
import { submitPartnerLead, checkPartnerApproved, uploadFile, attachPartnerLeadFiles, setPartnerLeadPledge } from "../lib/supabase";
import { isDeviceVerified, getKnownUsers } from "../lib/deviceAuth";
import PartnerOnboarding from "../components/PartnerOnboarding";
import BreathTrustSection from "../components/BreathTrustSection"; // v2.0: 호흡과 신뢰(Add Only)
import { BetaBanner, BetaBadge } from "../components/beta/BetaUI"; // 베타 안내(Add Only · SHOW_BETA_UI 게이트)
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#121A16";
const NAVY2 = "#1E2A22";
const NAVY3 = "#2C3A30";
const GOLD  = "#C8A86A";
const GOLDD = "#A98B4E";
const GOLDB = "rgba(200,168,106,0.12)";
const WHITE = "#FFFFFF";
const OFF   = "#F9F6F2";
const TEXT2 = "#4A554C";
const TEXT3 = "#8A857E";
const SANS  = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// ── Scroll-triggered fade ──────────────────────────────────────────────────────
function useVisible(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

const fade = (v, delay = 0) => ({
  opacity: v ? 1 : 0,
  transform: v ? "translateY(0)" : "translateY(22px)",
  transition: `opacity 0.45s ease-out ${delay}s, transform 0.45s ease-out ${delay}s`,
});

// ── GA4 전환 이벤트 (V1.5) ──────────────────────────────────────────────────────
// gtag 가 로드된 환경에서만 발화하고, 없으면 무해하게 무시한다(분석 미설정 시 영향 0).
// partner_join_click / partner_join_submit / partner_login_click
function track(event, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", event, params);
    }
  } catch { /* analytics 실패는 전환 흐름에 영향 주지 않음 */ }
}

// ── FAQ (V1.5) ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "가입할 때 비용이 드나요?",
    a: "가입비는 없습니다. 광고비·월정액도 없으며, 견적 요청 수신도 무료입니다. 비용은 계약이 실제로 성사된 프로젝트에만 발생합니다.",
  },
  {
    q: "수수료는 얼마인가요?",
    a: "계약이 성사된 프로젝트에 한해 4.4%(VAT 포함)의 이용수수료만 부과됩니다. 그 외 어떤 명목의 비용도 없습니다.",
  },
  {
    q: "수주에 실패하면 비용이 나가나요?",
    a: "아니요. 견적이 채택되지 않거나 수주에 실패한 경우에는 어떤 비용도 청구되지 않습니다. 부담 없이 견적에 참여하세요.",
  },
  {
    q: "예치보증금은 돌려받을 수 있나요?",
    a: "예치보증금은 가입비가 아니라 신뢰를 보증하는 예치금입니다. 공간파트너 활동 종료 시 100% 환급 가능합니다.",
  },
];

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ children, bg = OFF, py = 56 }) {
  const [ref, vis] = useVisible();
  return (
    <div ref={ref} style={{ background: bg, padding: `${py}px 20px`, fontFamily: SANS }}>
      <div style={{ maxWidth: 520, margin: "0 auto", ...fade(vis) }}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ label, sub }) {
  return (
    <div style={{ marginBottom: 28, textAlign: "center" }}>
      {label && (
        <div style={{
          display: "inline-block", background: GOLDB, color: GOLD,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          padding: "4px 12px", borderRadius: 99, marginBottom: 10,
        }}>
          {label}
        </div>
      )}
      {sub && (
        <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Grade data ─────────────────────────────────────────────────────────────────
const GRADES = [
  { name: "베이직",      deposit: "50만 원",    limit: "500만 원까지",   color: "#8B9BAD" },
  { name: "스탠다드",    deposit: "100만 원",   limit: "1,000만 원까지", color: "#4A90D9" },
  { name: "프리미엄",    deposit: "200만 원",   limit: "2,000만 원까지", color: GOLD },
  { name: "엔터프라이즈",deposit: "500만 원",   limit: "5,000만 원까지", color: "#7B5EA7" },
  { name: "시그니처",    deposit: "1,000만 원", limit: "1억 원까지",     color: NAVY3 },
];

// ── Trust items ────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: "🔐", title: "에스크로 기반 거래",      desc: "공사비가 단계 확인 전 자동 지급되지 않습니다" },
  { icon: "📋", title: "계약 내용 전자 기록",      desc: "계약 범위·대화·사진 모두 플랫폼에 저장됩니다" },
  { icon: "🛡️", title: "보증금 기반 신뢰 시스템", desc: "예치 보증금이 업체 신뢰도를 수치로 증명합니다" },
  { icon: "✅", title: "서류·보험 검증 완료 업체", desc: "사업자 서류, 보험, 시공 이력 확인 업체만 입점" },
  { icon: "👤", title: "검증된 의뢰인만 연결",     desc: "에스크로 예치를 완료한 실 발주 고객만 연결됩니다" },
  { icon: "⚖️", title: "분쟁 시 관리자 동행",      desc: "분쟁 발생 시 담당 운영자가 조율·중재합니다" },
];

// ── Onboarding steps ───────────────────────────────────────────────────────────
const ONBOARDING = [
  { num: 1, title: "파트너 신청",      desc: "아래 양식으로 신청하시면 1~2 영업일 내 연락드립니다" },
  { num: 2, title: "서류 검토 및 가입 승인", desc: "사업자·보험·이력 서류 확인 후 계정이 활성화됩니다" },
  { num: 3, title: "보증금 예치 등급 설정",  desc: "예치 금액에 따라 수주 가능 금액 한도가 결정됩니다" },
  { num: 4, title: "프로필·포트폴리오 작성", desc: "시공 사례, 전문 분야, 자격 정보를 등록합니다" },
  { num: 5, title: "견적 요청 수신",         desc: "플랫폼이 검증된 의뢰인의 요청을 자동으로 전달합니다" },
  { num: 6, title: "수주 완료 및 정산",      desc: "단계별 사진 확인 후 정산 — 4.4% 수수료만 부담" },
];

// ── Partner types ──────────────────────────────────────────────────────────────
const PARTNER_TYPES = [
  "인테리어·리모델링 업체",
  "인테리어 디자인·설계 사무소",
  "가구·마루·창호 시공 업체",
  "도배·도장·전기·설비 전문 업체",
  "상업 공간 전문 시공팀",
  "건물 유지보수·소규모 공사팀",
];

// ── Consultation form ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  company: "", owner: "", phone: "", bizNo: "",
  region: "", field: "", insurance: "", message: "",
};

function ConsultForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  // V1.3 서류 업로드: 사업자등록증(승인 필수) / 시공보험증권(선택, 예치금 할인 기준).
  const [bizFile, setBizFile] = useState(null);
  const [insFile, setInsFile] = useState(null);
  // 업체 운영 준수서약 — 필수 체크(프론트 상태값만 사용 · DB/API 미전송).
  const [pledge, setPledge] = useState(false);
  // V2 무인 온보딩: 제출 성공 시 생성된 lead 정보를 보관해 STEP2~4 로 이어준다.
  const [lead, setLead] = useState(null); // { id, phone, insuranceYn }

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // 가입 신청 버튼 활성화 조건: 필수 입력값 완료 + 사업자등록증 업로드 + 운영 준수서약 체크.
  //   ※ 시공보험은 기존 정책대로 선택/우대 — 필수 아님.
  const requiredFilled = ["company", "owner", "phone", "bizNo", "region", "field"]
    .every((k) => form[k]?.trim());
  const canSubmit = requiredFilled && !!bizFile && pledge;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const required = [
      ["company", "업체명"], ["owner", "대표자명"], ["phone", "연락처"],
      ["bizNo", "사업자등록번호"], ["region", "시공지역"], ["field", "전문분야"],
    ];
    const missing = required.filter(([k]) => !form[k]?.trim()).map(([, label]) => label);
    if (missing.length) {
      alert(`다음 필수 항목을 입력해 주세요:\n${missing.join(", ")}`);
      return;
    }
    if (!bizFile) {
      alert("사업자등록증을 업로드해 주세요. (승인 필수)");
      return;
    }
    if (!pledge) {
      alert("업체 운영 준수서약에 동의해 주세요.");
      return;
    }
    // V1.1: partner_leads 저장(관리자 상담관리에서 승인 처리). 문자/이메일/토스 발송 없음.
    // supabase rpc 빌더는 then만 구현(.catch 없음) → try/catch + finally 로 처리.
    setSaving(true);
    try {
      const payload = {
        companyName:     form.company,
        ownerName:       form.owner,
        phone:           form.phone,
        businessNumber:  form.bizNo,
        serviceArea:     form.region,
        specialty:       form.field,
        insuranceStatus: form.insurance,
        memo:            form.message,
      };
      const { data, error } = await submitPartnerLead(payload);
      if (error || data?.error) {
        console.error("[partner_lead_submit] 4) 실패:", error ?? data?.error);
        alert("신청 접수에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      // V1.3: 생성된 lead 에 서류 업로드(documents 버킷) 후 url 첨부. 보험판정은 파일 기준.
      // 업로드 실패는 신청 자체를 막지 않는다(사업자등록증 없으면 승인 단계에서 차단).
      const leadId = data?.id ?? null;
      let insUrl = null;
      if (leadId) {
        try {
          let bizUrl = null;
          if (bizFile) bizUrl = await uploadFile("documents", `partner_leads/${leadId}/biz_${Date.now()}_${bizFile.name}`, bizFile);
          if (insFile) insUrl = await uploadFile("documents", `partner_leads/${leadId}/ins_${Date.now()}_${insFile.name}`, insFile);
          if (bizUrl || insUrl) await attachPartnerLeadFiles(leadId, { businessLicenseUrl: bizUrl, insuranceFileUrl: insUrl });
        } catch (e) { console.warn("[partner files] 업로드 실패(신청은 계속):", e); }
        // 운영준수서약 동의 기록(migration 071) — best-effort. 버튼은 동의 시에만 활성이므로 항상 true.
        // 본 RPC 미존재(마이그레이션 미적용)/실패는 가입 제출을 막지 않는다.
        try {
          await setPartnerLeadPledge(leadId, !!pledge, new Date().toISOString());
        } catch (e) { console.warn("[partner pledge] 서약 기록 실패(신청은 계속):", e); }
      }
      // V2: 생성된 lead id 로 STEP2~4(등급선택→입금→대기) 진행. 보험여부 = 보험증권 파일 존재.
      setLead({
        id: leadId,
        phone: form.phone,
        insuranceYn: !!insUrl,
      });
      track("partner_join_submit", { has_insurance: !!insUrl }); // V1.5 전환 이벤트
      setSubmitted(true);
    } catch (err) {
      console.error("[partner_lead_submit] 예외:", err);
      alert("신청 접수 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", height: 48, borderRadius: 10,
    border: `1.5px solid #E8E1D8`,
    padding: "0 14px", fontSize: 15, fontFamily: SANS,
    background: WHITE, color: NAVY, outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: TEXT2, marginBottom: 6, display: "block",
  };
  const req = <span style={{ color: GOLDD }}> *</span>;

  if (submitted) {
    // V2: lead id 가 있으면 무인 온보딩(STEP2~4)으로 이어간다.
    // id 가 없으면(구버전/조회 실패) 기존 정적 접수완료 안내로 폴백.
    if (lead?.id) {
      return <PartnerOnboarding leadId={lead.id} phone={lead.phone} insuranceYn={lead.insuranceYn} />;
    }
    return (
      <div style={{
        background: GOLDB, border: `1.5px solid ${GOLD}`, borderRadius: 14,
        padding: "28px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, marginBottom: 8 }}>
          가입 신청이 접수되었습니다
        </div>
        <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>
          담당자가 서류 검토 후 영업일 기준 1~2일 내<br />
          전화 또는 문자로 가입 절차를 안내드립니다.
        </div>
      </div>
    );
  }

  // 필드는 인라인으로 렌더(렌더 함수 내부 컴포넌트 정의 시 매 입력마다 리마운트→포커스 유실 방지).
  const field = (k, label, { required = false, placeholder = "", inputMode } = {}) => (
    <div>
      <label style={labelStyle}>{label}{required && req}</label>
      <input style={inputStyle} placeholder={placeholder} value={form[k]} onChange={set(k)} inputMode={inputMode} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BetaBanner text="베타 파트너 모집 · 가입 · 견적 참여 · 상담 모두 무료입니다. (사업자등록증 + 시공보험 확인 후 승인)" style={{ marginBottom: 0 }} />
      {field("company", "업체명",        { required: true, placeholder: "예: 공간인테리어" })}
      {field("owner",   "대표자명",      { required: true, placeholder: "대표자 성함" })}
      {field("phone",   "연락처",        { required: true, placeholder: "휴대폰 번호", inputMode: "tel" })}
      {field("bizNo",   "사업자등록번호", { required: true, placeholder: "000-00-00000", inputMode: "numeric" })}
      {field("region",  "시공지역",      { required: true, placeholder: "예: 서울 전역, 경기 남부" })}
      {field("field",   "전문분야",      { required: true, placeholder: "예: 주거 리모델링, 상업 인테리어" })}

      {/* V1.3 서류 업로드 — 사업자등록증(승인 필수) / 시공보험증권(선택·예치금 할인 기준) */}
      <div>
        <label style={labelStyle}>사업자등록증 <span style={{ color: GOLDD }}>(승인 필수)</span></label>
        <label style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: bizFile ? NAVY : TEXT3 }}>
          <span>📎</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bizFile ? bizFile.name : "파일 선택 (PDF/이미지)"}</span>
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setBizFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div>
        <label style={labelStyle}>
          시공보험증권 <span style={{ color: TEXT3, fontWeight: 500 }}>(베타 서비스 선택 / 정식 서비스 필수) · 우수 파트너 우대 혜택</span>
        </label>
        <label style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: insFile ? NAVY : TEXT3 }}>
          <span>📎</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{insFile ? insFile.name : "파일 선택 (PDF/이미지)"}</span>
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setInsFile(e.target.files?.[0] ?? null)} />
        </label>
        <div style={{ fontSize: 11, color: TEXT3, marginTop: 5, lineHeight: 1.6 }}>
          시공보험증권 제출 업체는 우수 파트너 우대정책에 따라 신뢰보증금 할인 혜택이 적용됩니다.<br />
          공간마켓은 무면허·불법·서류 미비 업체의 활동을 제한하며, 검증된 파트너에게 우대 혜택을 제공합니다.
        </div>
      </div>

      <div>
        <label style={labelStyle}>시공보험 가입 여부</label>
        <select
          style={{ ...inputStyle, appearance: "none", color: form.insurance ? NAVY : TEXT3 }}
          value={form.insurance}
          onChange={set("insurance")}
        >
          <option value="">선택 안 함</option>
          <option value="가입">가입</option>
          <option value="미가입">미가입</option>
          <option value="확인필요">확인 필요</option>
        </select>
      </div>

      {/* 업체 운영 준수서약 — 필수 체크(미체크 시 가입 신청 버튼 비활성). 표시·동의 전용. */}
      <div>
        <label style={labelStyle}>업체 운영 준수서약 <span style={{ color: GOLDD }}>*</span></label>
        <div style={{
          border: `1.5px solid #E8E1D8`, borderRadius: 10, background: WHITE,
          padding: "12px 14px",
        }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={pledge} onChange={(e) => setPledge(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, cursor: "pointer" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>아래 내용을 확인하고 동의합니다.</span>
          </label>
          <ul style={{
            margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: TEXT2, lineHeight: 1.7,
            paddingTop: 10, borderTop: `1px solid #F3EEE4`,
          }}>
            {[
              "허위 사업자정보 또는 허위 시공이력으로 가입하지 않습니다.",
              "고객과의 상담, 견적, 계약, 시공 과정에서 성실하게 응대합니다.",
              "베타 기간 동안 공간마켓 시스템 구조에 따라 견적, 상담, 계약 진행, 프로젝트 기록을 성실히 이용합니다.",
              "토스페이먼츠 승인 전까지 앱 내 안전결제가 제공되지 않음을 확인했습니다.",
              "베타 기간의 실제 결제는 고객과 업체가 상호 협의하여 진행됨을 확인했습니다.",
              "무단 직거래 유도, 허위 견적, 연락 두절, 부실 시공, 리뷰 조작을 하지 않습니다.",
              "분쟁 발생 시 공간마켓 운영팀의 확인 요청에 성실히 협조합니다.",
              "정식 서비스 오픈 후 공간보증 예치금 및 공간보증 심사가 적용될 수 있음을 확인했습니다.",
              "본인은 위 내용을 모두 확인하였으며, 공간마켓 운영정책에 따라 성실히 참여할 것을 서약합니다.",
            ].map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}
          </ul>
        </div>
      </div>

      <div>
        <label style={labelStyle}>문의사항</label>
        <textarea
          style={{ ...inputStyle, height: 100, padding: "12px 14px", resize: "none" }}
          placeholder="추가로 전달하실 내용이 있다면 입력해 주세요 (선택)"
          value={form.message}
          onChange={set("message")}
        />
      </div>

      <button
        type="submit"
        disabled={saving || !canSubmit}
        style={{
          height: 52, borderRadius: 12, border: "none",
          cursor: saving || !canSubmit ? "default" : "pointer",
          background: GOLD, color: WHITE, fontSize: 16, fontWeight: 900,
          fontFamily: SANS, letterSpacing: "-0.2px", opacity: saving || !canSubmit ? 0.55 : 1,
          boxShadow: `0 6px 20px rgba(200,168,106,0.35)`,
        }}>
        {saving ? "접수 중..." : "공간파트너 가입 신청"}
      </button>
      {/* V1.5/V1.6 신청폼 하단 안심 문구 */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
        {["무료 상담", "가입 강요 없음", "1~2 영업일 내 연락", "검토 후 승인 진행"].map((t) => (
          <span key={t} style={{
            fontSize: 11.5, fontWeight: 700, color: GOLDD,
            background: GOLDB, border: `1px solid ${GOLD}`,
            borderRadius: 99, padding: "4px 11px",
          }}>
            ✓ {t}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12, color: TEXT3, textAlign: "center", lineHeight: 1.6 }}>
        신청 후 관리자 검토를 거쳐 가입 절차를 안내드립니다.<br />
        자동 문자·이메일은 발송되지 않습니다.
      </div>
    </form>
  );
}

// ── Company login gate(V1.2) ─────────────────────────────────────────────────
// 관리자 승인(partner_leads.status='APPROVED') 업체만 기존 업체 로그인 플로우로
// 진입시키는 게이트. 통과 시 기존 "/?login=company" 리다이렉트(App.jsx 분기)는
// 그대로 사용 — 로그인 로직 자체는 수정하지 않는다.
function CompanyLoginGate({ onClose }) {
  const [phone, setPhone] = useState("");
  const [bizNo, setBizNo] = useState("");
  const [checking, setChecking] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (checking) return;
    if (!phone.trim() || !bizNo.trim()) {
      alert("연락처와 사업자등록번호를 입력해 주세요.");
      return;
    }
    setChecking(true);
    setDenied(false);
    try {
      const { data, error } = await checkPartnerApproved(phone, bizNo);
      if (error || !data?.approved) {
        setDenied(true);
        return;
      }
      window.location.href = "/?login=company";
    } catch (err) {
      console.error("[partner_lead_check_approved] 예외:", err);
      setDenied(true);
    } finally {
      setChecking(false);
    }
  };

  const inputStyle = {
    width: "100%", height: 48, borderRadius: 10,
    border: `1.5px solid #E8E1D8`,
    padding: "0 14px", fontSize: 15, fontFamily: SANS,
    background: WHITE, color: NAVY, outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: TEXT2, marginBottom: 6, display: "block",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(18,26,22,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, zIndex: 1000,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: WHITE, borderRadius: 16, padding: 28,
          maxWidth: 380, width: "100%", fontFamily: SANS,
          boxSizing: "border-box",
        }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, marginBottom: 6 }}>
          업체 로그인
        </div>
        <div style={{ fontSize: 12, color: TEXT3, marginBottom: 18, lineHeight: 1.6 }}>
          관리자 승인을 받은 공간파트너만 로그인할 수 있습니다.<br />
          연락처와 사업자등록번호를 입력해 주세요.
        </div>
        <form onSubmit={handleCheck} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>연락처</label>
            <input
              style={inputStyle} placeholder="휴대폰 번호" inputMode="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>사업자등록번호</label>
            <input
              style={inputStyle} placeholder="000-00-00000" inputMode="numeric"
              value={bizNo} onChange={(e) => setBizNo(e.target.value)}
            />
          </div>
          {denied && (
            <div style={{
              fontSize: 12.5, color: GOLDD, background: GOLDB,
              border: `1px solid ${GOLD}`, borderRadius: 10,
              padding: "10px 12px", lineHeight: 1.6,
            }}>
              아직 승인되지 않은 업체입니다.<br />
              가입 신청 후 관리자 승인 완료 시 이용하실 수 있습니다.
            </div>
          )}
          <button
            type="submit" disabled={checking}
            style={{
              height: 48, borderRadius: 12, border: "none",
              cursor: checking ? "default" : "pointer",
              background: NAVY, color: WHITE, fontSize: 15, fontWeight: 800,
              fontFamily: SANS, opacity: checking ? 0.7 : 1,
            }}>
            {checking ? "확인 중..." : "확인하고 로그인"}
          </button>
          <button
            type="button" onClick={onClose}
            style={{
              height: 40, borderRadius: 12, border: "none", background: "transparent",
              color: TEXT3, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SANS,
            }}>
            닫기
          </button>
        </form>
      </div>
    </div>
  );
}

// ── FAQ section(V1.5) ──────────────────────────────────────────────────────────
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: WHITE, border: `1px solid #EFEAE0`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "16px 16px", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: SANS, textAlign: "left",
        }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: NAVY, lineHeight: 1.45 }}>Q. {q}</span>
        <span style={{
          fontSize: 16, color: GOLD, flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease",
        }}>⌄</span>
      </button>
      {open && (
        <div style={{
          padding: "0 16px 16px", fontSize: 13.5, color: TEXT2, lineHeight: 1.65,
          borderTop: `1px solid #F4EFE6`, paddingTop: 14,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PartnerLandingScreen() {
  const [heroRef, heroVis] = useVisible(0.05);
  const [showLoginGate, setShowLoginGate] = useState(false);

  useDocumentMeta({
    title: "공간마켓 파트너(업체) 입점 안내",
    description: "공간마켓 인테리어 파트너 업체 입점 안내. 검증된 고객 매칭, 에스크로 안전정산, 시공 기록 보호까지 함께합니다.",
    path: "/partner",
  });

  const scrollToForm = (source = "hero") => {
    track("partner_join_click", { source }); // V1.5 전환 이벤트
    const el = document.getElementById("partner-consult-form");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // V1.2: 승인업체 로그인 게이트 — 통과 시 기존 경로(handleRoleSelect("company")) 그대로 사용.
  // V1.2.2: 일반 로그아웃 후에도 기기 인증 + 저장된 업체 계정이 남아있으면 Gate 재요구 없이
  //   기존 업체 로그인 복구 흐름(/?login=company → AccountPicker)으로 직행한다.
  //   완전 로그아웃(clearDeviceAuth) 시에는 저장 계정/기기 인증이 모두 사라져 Gate 부터 다시 표시.
  const goCompanyLogin = () => {
    track("partner_login_click"); // V1.5 전환 이벤트
    try {
      if (isDeviceVerified() && getKnownUsers().some((u) => u.role === "company")) {
        window.location.href = "/?login=company";
        return;
      }
    } catch { /* localStorage 접근 불가 시 안전하게 Gate 표시 */ }
    setShowLoginGate(true);
  };

  return (
    <div style={{ fontFamily: SANS, background: OFF, minHeight: "100vh" }}>
      {showLoginGate && <CompanyLoginGate onClose={() => setShowLoginGate(false)} />}

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY3} 100%)`,
        padding: "64px 24px 56px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 220, height: 220, borderRadius: "50%",
          background: "rgba(200,168,106,0.08)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: "rgba(200,168,106,0.06)", pointerEvents: "none",
        }} />

        <div ref={heroRef} style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
          {/* 베타 파트너 배지 — 클릭 시 업체용 베타 안내 모달(확인 전용 · SHOW_BETA_UI 게이트) */}
          <BetaBadge label="베타 파트너" kind="bid" style={{ position: "absolute", top: -44, right: 0, zIndex: 3 }} />
          {/* Brand tag */}
          <div style={{ ...fade(heroVis, 0), marginBottom: 20 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 99, padding: "5px 14px",
            }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                공간마켓 파트너 프로그램
              </span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ ...fade(heroVis, 0.07) }}>
            <h1 style={{
              margin: "0 0 18px", fontSize: 28, fontWeight: 900,
              color: WHITE, lineHeight: 1.35, letterSpacing: "-0.5px",
            }}>
              광고비 없이<br />
              <span style={{ color: GOLD }}>수주하는 공간파트너</span>
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
              검증된 의뢰인이 먼저 예치하고 연결됩니다.<br />
              광고비·중개비·플랫폼 수수료 걱정 없이<br />
              시공에만 집중하세요.
            </p>
            {/* 브랜드 비전(준비 중 방향성) — 성실한 업체 우대 철학을 자연스럽게 전달(기능 약속/토큰 노출 없음) */}
            <p style={{ margin: "-6px 0 20px", fontSize: 13.5, color: "rgba(200,168,106,0.85)", lineHeight: 1.7, fontWeight: 600 }}>
              성실한 활동은 더 많은 기회로 이어집니다.
            </p>
            {/* V1.5 핵심 가치제안 — 광고비 0원 / 월정액 0원 / 계약 성사 시에만 4.4% / 검증된 고객만 연결 */}
            <div style={{
              background: "rgba(200,168,106,0.1)", border: `1px solid rgba(200,168,106,0.35)`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 24,
            }}>
              {[
                "광고비 0원 · 월정액 0원",
                "계약 성사 시에만 4.4%",
                "검증된 고객만 연결받으세요",
              ].map((t) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                  <span style={{ color: GOLD, fontSize: 13, fontWeight: 900 }}>✓</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "-0.2px" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 가치 badges (V1.5) */}
          <div style={{ ...fade(heroVis, 0.14), display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
            {["광고비 없음", "월정액 없음", "견적 수신 무료", "계약 성사 시에만 4.4%"].map((t) => (
              <div key={t} style={{
                background: GOLDB, border: `1px solid ${GOLD}`,
                borderRadius: 99, padding: "5px 14px",
                fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "0.02em",
              }}>
                {t}
              </div>
            ))}
          </div>

          {/* CTA — 신규 업체(가입 신청) / 기존 승인 업체(로그인) 분리 */}
          <div style={{ ...fade(heroVis, 0.2), display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => scrollToForm("hero")}
              style={{
                height: 54, borderRadius: 12, border: "none", cursor: "pointer",
                background: GOLD, color: WHITE, fontSize: 16, fontWeight: 900,
                fontFamily: SANS, boxShadow: `0 8px 28px rgba(200,168,106,0.45)`,
              }}>
              공간파트너 가입 신청
            </button>
            <button
              onClick={goCompanyLogin}
              style={{
                height: 50, borderRadius: 12, cursor: "pointer", fontFamily: SANS,
                background: "rgba(255,255,255,0.08)", border: `1.5px solid ${GOLD}`,
                color: GOLD, fontSize: 15, fontWeight: 800,
              }}>
              업체 로그인
            </button>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.6 }}>
              이미 승인된 공간파트너만 이용할 수 있습니다.<br />
              승인 전 업체는 가입 신청 후 안내를 받아주세요.
            </div>
          </div>
        </div>
      </div>

      {/* ── WHY: 업체의 고민 ──────────────────────────────────────── */}
      <Section bg={WHITE}>
        <SectionTitle label="업체 대표님의 고민" sub={"광고비는 쓰는데\n진짜 고객이 안 옵니다"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: "😤", text: "광고비 수백만 원 써도 허위 견적·바람맞는 경우 허다" },
            { icon: "💸", text: "플랫폼 수수료·월정액·광고비 3중 부담" },
            { icon: "📵", text: "고객 연락처 노출 없이 견적만 받고 종적 감추는 경우" },
            { icon: "⚔️", text: "공사 완료 후 억지 분쟁으로 정산 거부하는 사례" },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              background: OFF, borderRadius: 12, padding: "14px 16px",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <span style={{ fontSize: 14, color: TEXT2, lineHeight: 1.55, fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── WHY: 공간마켓 파트너의 차이 ─────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="공간마켓 파트너" sub="이 모든 문제를 구조로 해결합니다" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { icon: "🔒", title: "에스크로 선예치",    desc: "의뢰인이 먼저 공사비를 예치한 뒤 연결됩니다" },
            { icon: "💰", title: "단계별 정산",         desc: "착공·중간·완료 각 단계마다 안전하게 정산" },
            { icon: "📸", title: "시공 기록 보호",      desc: "사진·기록이 분쟁 시 증거가 됩니다" },
            { icon: "📣", title: "광고비 Zero",         desc: "별도 광고비·월정액 없이 수주 가능" },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: WHITE, borderRadius: 14, padding: "18px 14px",
              boxShadow: "0 2px 12px rgba(18,26,22,0.06)",
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: TEXT3, lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── TRUST SYSTEM ─────────────────────────────────────────── */}
      <Section bg={WHITE}>
        <SectionTitle label="신뢰 시스템" sub="6가지로 구성된 안심 거래 구조" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TRUST.map(({ icon, title, desc }) => (
            <div key={title} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              border: `1px solid #EFEAE0`, borderRadius: 12, padding: "16px 14px", background: OFF,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: TEXT3, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── ⭐ NEW: 호흡과 신뢰 (Landing Page Upgrade v2.0 · Add Only) ── */}
      <BreathTrustSection />

      {/* ── 우수 파트너 검증 카드 (V1.6) ────────────────────────── */}
      <Section bg={OFF}>
        <div style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY3} 100%)`,
          borderRadius: 16, padding: "24px 20px",
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: WHITE, marginBottom: 16, textAlign: "center" }}>
            검증된 파트너만 활동할 수 있습니다
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {[
              "사업자 확인",
              "시공 이력 확인",
              "보험 서류 확인",
              "무면허·불법 업체 제한",
            ].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: GOLD, fontWeight: 900, fontSize: 13 }}>✓</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{
            fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.65,
            textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14,
          }}>
            고객은 더 안심하고 계약할 수 있고,<br />
            파트너는 더 신뢰받는 환경에서 활동할 수 있습니다.
          </div>
        </div>
      </Section>

      {/* ── 고객 검증 · 안심거래 · 입점 제한 (V1.5) ──────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="검증된 연결" sub="허위 고객·미지급 위험을 구조로 줄입니다" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* #5 고객 검증 시스템 */}
          <div style={{
            background: WHITE, borderRadius: 14, padding: "18px 16px",
            boxShadow: "0 2px 12px rgba(18,26,22,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>👤</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>검증된 고객만 연결</span>
            </div>
            <div style={{ fontSize: 13.5, color: TEXT2, lineHeight: 1.65 }}>
              모든 고객은 연락처 인증, 주소 확인, 계약서 작성, 에스크로 예치 후 업체와 연결됩니다.
            </div>
          </div>

          {/* #6 안심거래 결과 중심 */}
          <div style={{
            background: WHITE, borderRadius: 14, padding: "18px 16px",
            boxShadow: "0 2px 12px rgba(18,26,22,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🛡️</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>안정적인 대금 정산</span>
            </div>
            <div style={{ fontSize: 13.5, color: TEXT2, lineHeight: 1.65 }}>
              공사 완료 후 안정적인 대금 정산을 지원합니다. 프로젝트 진행 기록(GPS·사진·채팅)이 신뢰의 증빙으로 남습니다.
            </div>
          </div>

          {/* #7 입점 제한 안내 */}
          <div style={{
            background: NAVY, borderRadius: 14, padding: "18px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🚫</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: WHITE }}>검증된 업체만 입점</span>
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.65 }}>
              공간마켓은 무면허 업체, 불법 업체, 서류 미비 업체의 입점을 제한합니다. 정식 사업자와 검증 완료 업체만 공간파트너로 활동할 수 있습니다.
            </div>
          </div>
        </div>
      </Section>

      {/* ── DEPOSIT GRADES ───────────────────────────────────────── */}
      <Section bg={`linear-gradient(160deg, ${NAVY} 0%, ${NAVY3} 100%)`}>
        <SectionTitle
          label="공간뱃지예치보증금 등급"
          sub={<span style={{ color: WHITE }}>신뢰 등급이 높을수록{"\n"}더 큰 규모의 프로젝트에 참여할 수 있습니다</span>}
        />
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textAlign: "center", marginTop: -14, marginBottom: 20, lineHeight: 1.6 }}>
          등급에 따라 수주 가능한 프로젝트 규모가 달라집니다.<br />
          신뢰도와 책임 범위를 기반으로 운영됩니다.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GRADES.map(({ name, deposit, limit, color }) => (
            <div key={name} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: WHITE }}>{name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>예치보증금 {deposit}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: GOLD, lineHeight: 1.1 }}>{limit}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>수주 가능</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16, background: GOLDB, border: `1px solid ${GOLD}`,
          borderRadius: 12, padding: "14px 16px", textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: GOLD, fontWeight: 800, lineHeight: 1.6, marginBottom: 6 }}>
            예치보증금은 가입비가 아닙니다
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, lineHeight: 1.6 }}>
            공간마켓은 광고비와 월 사용료를 받지 않습니다.<br />
            예치보증금은 파트너 활동 종료 시 100% 환급 가능합니다.
          </div>
        </div>
        {/* 등급표 하단 신뢰 문구 (V1.6) */}
        <div style={{ marginTop: 12, fontSize: 11.5, color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 1.65 }}>
          예치보증금은 수수료가 아닌 신뢰 파트너 인증을 위한 보증금입니다.<br />
          프로젝트 규모에 따라 참여 가능한 범위가 달라질 수 있습니다.
        </div>
      </Section>

      {/* ── FEE ─────────────────────────────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="수수료 안내" sub={"계약이 성사된 프로젝트에만\n4.4% 이용수수료가 발생합니다"} />
        <div style={{
          background: WHITE, borderRadius: 16, padding: "24px 20px",
          boxShadow: "0 2px 16px rgba(18,26,22,0.08)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 42, fontWeight: 900, color: GOLD }}>4.4</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>%</span>
            <div style={{ fontSize: 12, color: TEXT3, marginTop: 4 }}>VAT 포함 · 공간멤버십파트너 이용수수료</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { ok: true,  label: "계약이 성사된 프로젝트에만 부과됩니다" },
              { ok: true,  label: "광고비, 월정액, 가입비 일체 없음" },
              { ok: true,  label: "견적 요청 수신은 무료" },
              { ok: false, label: "수주 실패 / 견적 미채택 시 수수료 없음" },
            ].map(({ ok, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{ok ? "✅" : "🔸"}</span>
                <span style={{ fontSize: 14, color: ok ? NAVY : TEXT2, fontWeight: ok ? 600 : 400 }}>{label}</span>
              </div>
            ))}
          </div>
          {/* V1.6 보조 문구 — 매칭 실패/견적 미채택/수주 실패 시 비용 없음 */}
          <div style={{
            marginTop: 16, padding: "12px 14px",
            background: OFF, borderRadius: 10, fontSize: 12, color: TEXT3, lineHeight: 1.65,
          }}>
            매칭 실패 · 견적 미채택 · 수주 실패 시<br />
            <span style={{ fontWeight: 700, color: TEXT2 }}>비용은 발생하지 않습니다.</span>
          </div>
        </div>
      </Section>

      {/* ── ONBOARDING STEPS ────────────────────────────────────── */}
      <Section bg={WHITE}>
        <SectionTitle label="파트너 입점 가이드" sub="파트너 신청부터 첫 수주까지" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {ONBOARDING.map(({ num, title, desc }, i) => (
            <div key={num} style={{
              display: "flex", gap: 16, paddingBottom: i < ONBOARDING.length - 1 ? 24 : 0,
              position: "relative",
            }}>
              {/* Line */}
              {i < ONBOARDING.length - 1 && (
                <div style={{
                  position: "absolute", left: 17, top: 38, bottom: 0,
                  width: 2, background: "#EFEAE0",
                }} />
              )}
              {/* Step circle */}
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                background: num === 1 ? GOLD : OFF,
                border: `2px solid ${num === 1 ? GOLD : "#E8E1D8"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900,
                color: num === 1 ? WHITE : TEXT3,
                zIndex: 1, position: "relative",
              }}>
                {num}
              </div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: TEXT3, lineHeight: 1.55 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PARTNER TYPES ────────────────────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="입점 가능 업종" sub="다양한 공간 전문가를 모십니다" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PARTNER_TYPES.map((t) => (
            <div key={t} style={{
              background: WHITE, border: `1px solid #E8E1D8`,
              borderRadius: 99, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, color: NAVY,
            }}>
              {t}
            </div>
          ))}
        </div>
      </Section>

      {/* ── FAQ (V1.5) ───────────────────────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="자주 묻는 질문" sub="가입 전에 궁금한 점을 확인하세요" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </Section>

      {/* ── CONSULTATION FORM (신규 업체) ────────────────────────── */}
      <Section bg={WHITE}>
        <div id="partner-consult-form" style={{ scrollMarginTop: 16 }} />
        <SectionTitle label="신규 업체 · 가입 신청" sub="지금 신청하면 1~2 영업일 내 연락드립니다" />
        <ConsultForm />

        {/* 기존 승인 업체 → 업체 로그인 분리 */}
        <div style={{
          marginTop: 28, paddingTop: 24, borderTop: `1px solid #EFEAE0`, textAlign: "center",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>
            이미 승인된 공간파트너이신가요?
          </div>
          <div style={{ fontSize: 12, color: TEXT3, marginBottom: 14, lineHeight: 1.6 }}>
            관리자 승인을 받은 업체만 로그인할 수 있습니다.
          </div>
          <button
            onClick={goCompanyLogin}
            style={{
              height: 50, width: "100%", borderRadius: 12, cursor: "pointer", fontFamily: SANS,
              background: NAVY, color: WHITE, fontSize: 15, fontWeight: 800, border: "none",
            }}>
            업체 로그인
          </button>
        </div>
      </Section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div style={{
        background: NAVY, padding: "32px 24px",
        fontFamily: SANS, textAlign: "center",
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: WHITE, marginBottom: 6 }}>
            공간마켓
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>
            파트너 전용 문의: gongganmarket.biz@gmail.com
          </div>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 99, padding: "7px 20px", cursor: "pointer",
              fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: SANS,
            }}>
            공간마켓 홈으로
          </button>
          <div style={{ marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            © 2026 공간마켓. All rights reserved.
          </div>
        </div>
      </div>

      {/* ── 모바일 플로팅 CTA (V1.5) — 모바일 하단 고정, 클릭 시 신청폼으로 스크롤 ── */}
      <style>{`
        @media (max-width: 640px) {
          .gm-partner-floating-cta { display: block !important; }
        }
        .gm-partner-floating-cta { display: none; }
      `}</style>
      <div className="gm-partner-floating-cta" style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 900,
        padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))",
        background: "rgba(18,26,22,0.92)", backdropFilter: "blur(6px)",
        borderTop: `1px solid rgba(200,168,106,0.3)`,
      }}>
        <button
          onClick={() => scrollToForm("floating")}
          style={{
            width: "100%", height: 50, borderRadius: 12, border: "none", cursor: "pointer",
            background: GOLD, color: WHITE, fontSize: 16, fontWeight: 900, fontFamily: SANS,
            boxShadow: `0 6px 20px rgba(200,168,106,0.4)`,
          }}>
          공간파트너 가입 신청
        </button>
      </div>

    </div>
  );
}
