// 베타 서비스 안내 UI — 배지 / 배너 / 진입 안내 모달 (Add Only · 표시 전용).
//   ⚠️ SHOW_BETA_UI=false 면 배지·배너는 자동으로 사라진다(렌더 null). 결제/계약/로직 무관.
//   토스페이먼츠 승인 전 '무료 베타 + 안전결제 미제공' 안내를 한 곳에서 관리.
import { useEffect, useState } from "react";
import { C, R, S } from "../../constants";
import { SHOW_BETA_UI } from "../../constants/release";

// 진입 안내 1회 확인 기록 — localStorage. 최초 1회 체크박스 확인 시 저장 → 이후 재노출 안 함.
const BETA_ACK_KEY = { quote: "gm_beta_ack_quote", bid: "gm_beta_ack_bid" };

export function hasBetaAck(kind) {
  try { return localStorage.getItem(BETA_ACK_KEY[kind]) === "1"; } catch { return false; }
}

export function markBetaAck(kind) {
  try { localStorage.setItem(BETA_ACK_KEY[kind], "1"); } catch { /* noop */ }
}

// 🎉 베타 배지 — 랜딩 우상단 등.
//   kind("quote"|"bid") 를 주면 클릭 시 베타 안내 모달(BetaInfoModal · 확인 전용)을 연다.
//   kind 가 없으면 기존처럼 단순 표시용 배지.
export function BetaBadge({ label = "오픈 기간 · 수수료 0원", style, kind }) {
  const [open, setOpen] = useState(false);
  if (!SHOW_BETA_UI) return null;

  const baseStyle = {
    display: "inline-flex", alignItems: "center", gap: 4,
    background: C.sun ?? "#F6DDAA", color: C.brandD ?? "#1D3D2F",
    border: `1px solid ${C.gold ?? "#C8A15A"}`, borderRadius: R.full,
    padding: "4px 11px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", ...style,
  };

  if (!kind) {
    return <span style={baseStyle}>🎉 {label}</span>;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={`${label} 안내 보기`}
        style={{ ...baseStyle, cursor: "pointer", font: "inherit" }}>
        🎉 {label}
      </button>
      <BetaInfoModal open={open} kind={kind} onClose={() => setOpen(false)} />
    </>
  );
}

// 베타 안내 배너 — 견적/입찰 작성 화면 상단 등.
export function BetaBanner({ text, style }) {
  if (!SHOW_BETA_UI) return null;
  return (
    <div style={{
      background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg,
      padding: `${S.sm}px ${S.md}px`, marginBottom: S.md,
      fontSize: 12.5, color: C.brand, fontWeight: 700, lineHeight: 1.6, ...style,
    }}>{text}</div>
  );
}

export const GATE_CONTENT = {
  quote: {
    title: "견적부터 준공까지, 기록이 남습니다",
    intro: "공간마켓은 요청·상담·계약·공사 사진·진행 기록을 한곳에 남겨, 나중에 무엇이든 확인할 수 있게 합니다. 오픈 기간에는 수수료가 없습니다.",
    provided: [
      "견적요청", "업체 비교", "업체 상담", "계약 진행", "프로젝트 진행관리",
      "GPS 진행기록", "사진 기록", "채팅", "리뷰 작성", "프로젝트 이력 관리",
    ],
    notProvided: ["앱 안 안전결제", "에스크로 정산", "카드결제", "공간보증"],
    notes: [
      "공사대금은 계약서에 적은 단계대로 고객과 업체가 직접 주고받습니다.",
      "계약서·공사 사진·GPS 진행 기록이 공간마켓에 남아, 단계마다 확인하고 문제가 생기면 근거로 쓸 수 있습니다.",
      "앱 안 안전결제는 토스페이먼츠 승인 뒤 열립니다.",
    ],
    confirm: "확인하고 견적 요청하기",
  },
  bid: {
    title: "일감부터 평판까지, 기록이 쌓입니다",
    intro: "견적·상담·계약·시공 사진·후기가 업체 프로필에 쌓여 다음 고객을 데려옵니다. 오픈 기간에는 가입비·수수료가 없습니다.",
    provided: [
      "업체 가입", "견적 입찰", "고객 상담", "계약 진행", "프로젝트 진행관리",
      "GPS 진행기록", "사진 기록", "포트폴리오", "리뷰 관리", "업체 성장(LV)", "프로젝트 이력 관리",
    ],
    required: ["사업자등록증", "시공보험 또는 영업배상책임보험", "업체 운영 준수서약"],
    notProvided: ["앱 안 안전결제", "에스크로 정산", "공간보증 예치금·심사"],
    notes: [
      "공사대금은 계약서에 적은 단계대로 고객과 직접 주고받습니다.",
      "계약서·시공 사진·GPS 진행 기록이 남아, 업체의 성실함을 보여 주는 근거가 됩니다.",
      "앱 안 안전결제와 공간보증은 정식 오픈 때 열립니다.",
    ],
    confirm: "확인하고 입찰하기",
  },
};

function GateSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text3, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function GateList({ items, mark, color }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => (
        <span key={it} style={{
          fontSize: 12.5, fontWeight: 700, color: color ?? C.text2,
          background: C.bg, border: `1px solid ${C.bgWarm}`, borderRadius: R.full,
          padding: "5px 10px",
        }}>{mark} {it}</span>
      ))}
    </div>
  );
}

// 안내 콘텐츠 본문(제공/가입필수/미제공/중요안내) — 게이트 모달·배지 클릭 모달 공용.
export function GateBody({ c }) {
  return (
    <>
      <GateSection title="지금 함께하는 것">
        <GateList items={c.provided} mark="✅" />
      </GateSection>

      {c.required && (
        <GateSection title="가입 필수">
          <GateList items={c.required} mark="📄" />
        </GateSection>
      )}

      <GateSection title="정식 오픈 때 열리는 것">
        <GateList items={c.notProvided} mark="🔜" color={C.text3} />
      </GateSection>

      <GateSection title="대금은 이렇게">
        <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.8, fontWeight: 600 }}>
          {c.notes.map((n, i) => <div key={i} style={{ marginBottom: i < c.notes.length - 1 ? 6 : 0 }}>· {n}</div>)}
        </div>
      </GateSection>
    </>
  );
}

// 진입 안내 모달 — 견적요청/입찰 직전 1회 고지(체크박스 확인 전 버튼 비활성).
//   onConfirm: 확인 → 기존 흐름 계속(localStorage 저장, 이후 재노출 안 함) / onClose: 취소.
export function BetaGateModal({ open, kind = "quote", onConfirm, onClose }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (open) setChecked(false); }, [open]);

  if (!open || !SHOW_BETA_UI) return null;
  const c = GATE_CONTENT[kind] ?? GATE_CONTENT.quote;

  const handleConfirm = () => {
    if (!checked) return;
    markBetaAck(kind);
    onConfirm?.();
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)", zIndex: 700,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, maxHeight: "86vh", overflowY: "auto",
          background: C.surface, borderRadius: R.xl, padding: "26px 22px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.35)" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, textAlign: "center", marginBottom: 6 }}>{c.title}</div>
        <div style={{ fontSize: 13, color: C.text3, textAlign: "center", marginBottom: 18, lineHeight: 1.6 }}>{c.intro}</div>

        <GateBody c={c} />

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, cursor: "pointer" }} />
          <span style={{ fontSize: 13, color: C.text1, fontWeight: 700 }}>내용을 확인했어요.</span>
        </label>

        <button onClick={handleConfirm} disabled={!checked} style={{
          width: "100%", padding: "15px", background: checked ? C.brand : "#E8E4DC", color: "#fff",
          border: "none", borderRadius: R.lg, fontSize: 15, fontWeight: 800,
          cursor: checked ? "pointer" : "not-allowed",
        }}>
          {c.confirm}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "11px", marginTop: 8, background: "none",
          color: C.text3, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </div>
  );
}

// 배지 클릭 안내 모달 — 랜딩 베타 배지용(확인 전용 · 체크박스/동의저장 없음).
//   견적요청/입찰 진입 모달(BetaGateModal)과 콘텐츠는 공유하되, 동작은 단순 확인뿐이라
//   클릭할 때마다 열려도 무방하다(로직/정책 무관 · 표시 전용).
export function BetaInfoModal({ open, kind = "quote", onClose }) {
  if (!open || !SHOW_BETA_UI) return null;
  const c = GATE_CONTENT[kind] ?? GATE_CONTENT.quote;

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)", zIndex: 700,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, maxHeight: "86vh", overflowY: "auto",
          background: C.surface, borderRadius: R.xl, padding: "26px 22px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.35)" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, textAlign: "center", marginBottom: 6 }}>{c.title}</div>
        <div style={{ fontSize: 13, color: C.text3, textAlign: "center", marginBottom: 18, lineHeight: 1.6 }}>
          {c.intro}
        </div>

        <GateBody c={c} />

        <button onClick={onClose} style={{ width: "100%", padding: "15px", background: C.brand, color: "#fff",
          border: "none", borderRadius: R.lg, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          확인
        </button>
      </div>
    </div>
  );
}
