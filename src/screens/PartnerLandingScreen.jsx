import { useState, useEffect, useRef } from "react";
import { submitPartnerLead, checkPartnerApproved, uploadFile, attachPartnerLeadFiles, setPartnerLeadPledge } from "../lib/supabase";
import { isDeviceVerified, getKnownUsers } from "../lib/deviceAuth";
import PartnerOnboarding from "../components/PartnerOnboarding";
import BreathTrustSection from "../components/BreathTrustSection"; // v2.0: 호흡과 신뢰(Add Only)
import AppFooter from "../components/AppFooter"; // 사업자정보 푸터(법적 필수 · 삭제 금지)
import { BetaBanner } from "../components/beta/BetaUI"; // 베타 안내(Add Only · SHOW_BETA_UI 게이트)
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// ── 베타 배지 (badge-beta · 이모지 없이 초록 점 blink + #F5EED6 배경) ────────────
// FINAL BALANCED: 시안의 .badge-beta 이식. 이모지 배지 대체(현재 배포본 버그 수정 #2).
function BadgeBeta({ style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: "#F5EED6",
      border: "1px solid #E8DCC0", color: "#6B4F1A", padding: "6px 12px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, ...style,
    }}>
      <span className="gm-beta-dot" style={{ width: 6, height: 6, background: "#2D5A27", borderRadius: "50%" }} />
      BETA 파트너
    </span>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#121A16";
const NAVY2 = "#1E2A22";
const NAVY3 = "#2C3A30";
const FOREST = "#1A2E22"; // 파트너 히어로 배경(웜 포레스트)
const OK    = "#2D5A27";  // 타임라인 배지/초록 점
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
          display: "inline-flex", alignItems: "center", justifyContent: "center",
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

  const btn = {
    padding: "15px 26px", borderRadius: 999, border: "none", fontWeight: 800, fontSize: 14,
    cursor: "pointer", fontFamily: SANS, width: "100%", display: "inline-flex",
    justifyContent: "center", alignItems: "center", gap: 8, transition: "transform .08s",
  };
  const okBadge = {
    display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: "#E7F0E6", color: OK,
    border: "1px solid #C8D8C5", whiteSpace: "nowrap", flexShrink: 0,
  };
  const STEPS = [
    { b: "간편 신청",          t: "3개 필드만",              badge: "30초" },
    { b: "사업자등록증 업로드", t: "OCR + 국세청 API 자동 검증", badge: "무인" },
    { b: "관리자 3초 승인",    t: "일치 배지만 보고 승인",     badge: "3초" },
    { b: "견적 수신",          t: "검증 고객 알림",           badge: "검증" },
    { b: "수주·정산 4.4%만",   t: "베타 0원",                 badge: "수수료" },
  ];
  const GRADE_ROWS = [
    ["베이직 50만원", "500만원까지"],
    ["스탠다드 100만원", "1,000만원까지"],
    ["프리미엄 200만원", "2,000만원까지"],
    ["엔터프라이즈 500만원", "5,000만원까지"],
    ["시그니처 1,000만원", "1억까지"],
  ];

  return (
    <div style={{ fontFamily: SANS, background: OFF, color: NAVY, minHeight: "100vh", letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>
      {showLoginGate && <CompanyLoginGate onClose={() => setShowLoginGate(false)} />}

      {/* ── TOPNAV (고객/파트너 · 라우팅 유지) ─────────────────────── */}
      <div className="gm-topnav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(249,246,242,.85)",
        backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid #E8E1D8", display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "10px 20px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
          공간마켓<span style={{ color: GOLD, fontWeight: 400 }}> BETA</span>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#ECE7DF", padding: 4, borderRadius: 999 }}>
          <button className="gm-tab" onClick={() => { window.location.href = "/"; }} style={{ padding: "8px 16px", borderRadius: 999,
            border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: SANS,
            background: "transparent", color: TEXT3 }}>고객</button>
          <button className="gm-tab" style={{ padding: "8px 16px", borderRadius: 999, border: "none", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: SANS, background: NAVY, color: "#fff" }}>파트너</button>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
        {/* ── NAVY(웜 잉크) HERO ──────────────────────────────────── */}
        <div ref={heroRef} style={{ background: FOREST,
          color: "#F9F6F2", borderRadius: 28, padding: "28px 24px", margin: "16px 0 28px",
          position: "relative", overflow: "hidden" }}>
          <BadgeBeta style={{ position: "absolute", top: 14, right: 14, zIndex: 3 }} />
          <h1 style={{ fontSize: "clamp(24px,6vw,36px)", fontWeight: 800, lineHeight: 1.1, margin: 0, wordBreak: "keep-all" }}>
            광고비 없이 수주하는<br /><span style={{ color: GOLD }}>공간파트너</span>
          </h1>
          <p style={{ opacity: .6, fontSize: 14, margin: "12px 0", lineHeight: 1.7 }}>
            당근·숨고 광고비 쓰지 마세요. 예치된 고객만 연결됩니다.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => scrollToForm("hero")} style={{ ...btn, maxWidth: 220, background: "#fff", color: NAVY }}>
              30초 간편 신청
            </button>
            <button onClick={goCompanyLogin} style={{ ...btn, maxWidth: 240, background: "transparent",
              border: "1px solid rgba(255,255,255,.25)", color: "#fff" }}>
              이미 파트너신가요? 로그인 →
            </button>
          </div>
        </div>

        {/* ── TIMELINE : 신청부터 수주까지 (dot 32px 일관 · 카드별 배지 · 중앙 연결선) ── */}
        <div style={{ padding: "36px 0" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>신청부터 수주까지</h3>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 연결선: dot(32px) 중앙(15px)에 정렬 */}
            <div style={{ position: "absolute", left: 15, top: 16, bottom: 16, width: 2, background: "#E8E1D8", borderRadius: 2 }} />
            {STEPS.map((s, i) => (
              <div key={i} style={{ position: "relative", zIndex: 1, display: "grid",
                gridTemplateColumns: "32px 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%",
                  background: i === 0 ? NAVY : "#E7F0E6", border: i === 0 ? "2px solid " + NAVY : "2px solid #C8D8C5",
                  color: i === 0 ? "#fff" : OK, display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ background: "#fff", border: "1px solid #E8E1D8", borderRadius: 16,
                  padding: "14px 16px", minHeight: 56, display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 14, letterSpacing: "-0.02em" }}>{s.b}</b>
                    <div style={{ fontSize: 12, color: TEXT3, marginTop: 2, lineHeight: 1.4 }}>{s.t}</div>
                  </div>
                  <span style={okBadge}>{s.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 신뢰 등급표 (다크 카드 · 중앙정렬 헤더 · ≥700px 2열 · keep-all 공지) ── */}
        <div style={{ padding: "0 0 36px" }}>
          <div style={{ background: NAVY, color: "#F9F6F2", borderRadius: 28, padding: "28px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              marginBottom: 8, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: "nowrap" }}>신뢰 등급 = 수주 가능 금액</div>
              <span style={{ background: GOLD, color: NAVY, padding: "6px 14px", borderRadius: 999,
                fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>베타 100업체 무료</span>
            </div>
            <p style={{ textAlign: "center", fontSize: 12, color: "#9A958E", lineHeight: 1.5,
              margin: "0 0 18px", wordBreak: "keep-all" }}>
              베타 100업체까지는 1천만원/1억 공사도 0원, 등급 제한 없음
            </p>
            <div className="gm-grade-list" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {GRADE_ROWS.map(([name, limit]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
                  padding: "14px 18px", borderRadius: 14, fontSize: 13 }}>
                  <span>{name}</span><b style={{ color: GOLD }}>{limit}</b>
                </div>
              ))}
            </div>
            <div style={{ border: `1.5px solid ${GOLD}`, borderRadius: 16, padding: 16, marginTop: 18,
              textAlign: "center", background: "rgba(200,168,106,.07)" }}>
              <b style={{ color: GOLD, fontSize: 13, display: "block", lineHeight: 1.6, wordBreak: "keep-all" }}>
                베타 100업체까지는<br />금액 상관없이 0원, 전등급 무료 개방
              </b>
              <span style={{ color: "#9A958E", fontSize: 11, marginTop: 8, display: "block", wordBreak: "keep-all" }}>
                베타 이후: 베이직(500만)까지 무료, 이상은 예치 후 해제
              </span>
            </div>
          </div>
        </div>

        {/* ── 무인 입점 신청 (실제 ConsultForm · API 유지) ────────── */}
        <div id="partner-consult-form" style={{ padding: "8px 0 36px", scrollMarginTop: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #E8E1D8", borderRadius: 28, padding: 24,
            maxWidth: 520, margin: "0 auto", boxShadow: "0 20px 60px rgba(18,26,22,.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <b style={{ fontSize: 15 }}>무인 입점 신청</b>
              <span style={okBadge}>상담사 전화 없음</span>
            </div>
            <ConsultForm />
          </div>

          {/* 기존 승인 업체 → 로그인 분리(유지) */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #EFEAE0", textAlign: "center", maxWidth: 520, margin: "24px auto 0" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>이미 승인된 공간파트너이신가요?</div>
            <div style={{ fontSize: 12, color: TEXT3, marginBottom: 14, lineHeight: 1.6 }}>관리자 승인을 받은 업체만 로그인할 수 있습니다.</div>
            <button onClick={goCompanyLogin} style={{ ...btn, background: NAVY, color: "#fff" }}>업체 로그인</button>
          </div>
        </div>

        {/* ══ 이하 유지(삭제 금지) : FAQ ══ */}
        <div style={{ padding: "36px 0" }}>
          <div style={{ textAlign: "center", fontSize: "clamp(22px,4.5vw,26px)", fontWeight: 900, color: NAVY, marginBottom: 20 }}>자주 묻는 질문</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620, margin: "0 auto" }}>
            {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </div>

      {/* ── 사업자정보 푸터 + 개인정보/이용약관 (법적 필수 · 삭제 금지) ── */}
      <div style={{ padding: "20px 20px 96px", background: "#EFEAE0", borderTop: "1px solid #E8E1D8", textAlign: "center" }}>
        <AppFooter />
        <button onClick={() => { window.location.href = "/"; }} style={{ marginTop: 16, background: "transparent",
          border: "1px solid #D6D0C8", borderRadius: 99, padding: "7px 20px", cursor: "pointer",
          fontSize: 13, color: TEXT3, fontFamily: SANS }}>공간마켓 홈으로</button>
      </div>

      {/* ── 모바일 하단 고정 CTA (골드 그라데이션 단일 버튼 · 검은테두리 제거 + 옅은 베이지 띠 + shimmer) ── */}
      <style>{`
        .gm-beta-dot{ animation: gmBlink 1.8s infinite }
        @keyframes gmBlink{ 0%,100%{ opacity:1 } 50%{ opacity:.4 } }
        .gm-partner-sticky-cta{ display:none }
        @media (max-width: 640px){ .gm-partner-sticky-cta{ display:flex } }
        @media (min-width: 700px){ .gm-grade-list{ grid-template-columns: 1fr 1fr !important } }
        @media (max-width: 380px){
          .gm-topnav{ padding: 8px 12px !important }
          .gm-tab{ padding: 6px 12px !important; font-size: 12px !important }
        }
        .gm-sticky-gold::after{ content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent); transition:.6s }
        .gm-sticky-gold:hover::after{ left:100% }
        .gm-sticky-gold:hover{ transform:translateY(-2px);
          box-shadow:0 12px 32px rgba(200,168,106,.42), 0 0 0 1px rgba(232,220,192,.9) inset }
        .gm-sticky-gold:active{ transform:translateY(0) }
        button:active{ transform: scale(.985) }
      `}</style>
      <div className="gm-partner-sticky-cta" style={{ position: "fixed", left: 16, right: 16,
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 900,
        justifyContent: "center", pointerEvents: "none" }}>
        <button className="gm-sticky-gold" onClick={() => scrollToForm("floating")} style={{
          pointerEvents: "auto", height: 52, maxWidth: 420, flex: 1, borderRadius: 999,
          border: "1px solid #E9DDC0", background: "linear-gradient(180deg,#D9C49A 0%,#C8A86A 100%)",
          color: NAVY, fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", cursor: "pointer",
          fontFamily: SANS, position: "relative", overflow: "hidden",
          transition: "transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s",
          boxShadow: "0 8px 24px rgba(200,168,106,.28), 0 0 0 1px rgba(232,220,192,.8) inset, 0 1px 2px rgba(255,255,255,.6) inset" }}>
          공간파트너 가입 신청
        </button>
      </div>
    </div>
  );
}
