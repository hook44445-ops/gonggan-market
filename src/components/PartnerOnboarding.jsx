import { useState } from "react";
import { selectPartnerLeadGrade } from "../lib/supabase";
import {
  ONBOARDING_GRADES, calcDepositManwon, wonFromManwon, DEPOSIT_MOCK,
} from "../constants/partnerOnboarding";

// ── Design tokens (랜딩 warm 팔레트와 통일 · 시안 폼 디자인) ──────────────────────
const INK    = "#121A16";
const FOREST = "#1A2E22";
const GOLD   = "#C8A86A";
const GOLDD  = "#A98B4E";
const GOLDB  = "rgba(200,168,106,0.12)";
const WHITE  = "#FFFFFF";
const PAPER  = "#FFFDFA";
const LINE   = "#E8E1D8";
const TEXT2  = "#4A554C";
const TEXT3  = "#8A857E";
const OK     = "#2D5A27";
const SANS   = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// 등급 아이콘(텍스트 B/S/P/M/S+ · 이모지 없음 · 시안 grade-opt 색상)
const GICON = {
  BASIC:     { t: "B",  bg: "#F6F0E6", color: "#8B6A2A", border: "#E8DCC0" },
  STANDARD:  { t: "S",  bg: "#EEEEEA", color: "#5A5A5A", border: "#E1E1DC" },
  PREMIUM:   { t: "P",  bg: "#FFF8E6", color: "#8B6A2A", border: "#E8DCC0" },
  MASTER:    { t: "M",  bg: "#E6F0FA", color: "#2A5A8B", border: "#C5D8E8" },
  SIGNATURE: { t: "S+", bg: "#121A16", color: GOLD,      border: "#2A2A2A" },
};

// ════════════════════════════════════════════════════════════════════
// PartnerOnboarding — 가입상담 제출(STEP1) 직후 이어지는 무인 온보딩 STEP2~4.
//   STEP2 공간보증 등급 선택 → STEP3 입금안내(Mock) → STEP4 입금대기.
//   관리자 입금확인/승인(STEP5~)은 AdminScreen, company 생성은 최초 로그인 시 브릿지.
//   토스/실결제 없음 — 표시/상태만. (migration 069) · 디자인만 시안 이식(기능 동일).
// props: leadId, phone, insuranceYn(boolean), onClose?
// ════════════════════════════════════════════════════════════════════
export default function PartnerOnboarding({ leadId, phone, insuranceYn = false, onClose }) {
  const [step, setStep] = useState(2);          // 2: 등급선택, 3: 입금안내, 4: 입금대기
  const [grade, setGrade] = useState(null);
  const [amount, setAmount] = useState(null);   // 만원
  const [saving, setSaving] = useState(false);

  const pickGrade = async (g) => {
    if (saving) return;
    setSaving(true);
    try {
      const { data, error } = await selectPartnerLeadGrade(leadId, g.key, insuranceYn);
      if (error || data?.error) {
        alert("등급 선택에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setGrade(g.key);
      // 서버 권위값 우선, 폴백으로 로컬 계산.
      setAmount(data?.guarantee_amount ?? calcDepositManwon(g.key, insuranceYn));
      setStep(3);
    } catch (e) {
      console.error("[partner_lead_select_grade] 예외:", e);
      alert("등급 선택 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const card = {
    background: WHITE, border: `1px solid ${LINE}`, borderRadius: 24,
    padding: "24px 20px", fontFamily: SANS,
    boxShadow: "0 4px 24px rgba(18,26,22,.04)",
  };
  const goldBtn = {
    width: "100%", height: 52, borderRadius: 999, border: "1px solid #E9DDC0", cursor: "pointer",
    background: "linear-gradient(180deg,#D8BE88 0%,#C8A86A 100%)", color: INK,
    fontSize: 16, fontWeight: 800, fontFamily: SANS, letterSpacing: "-0.01em",
    boxShadow: "0 8px 24px rgba(200,168,106,.28), 0 0 0 1px rgba(232,220,192,.8) inset, 0 1px 2px rgba(255,255,255,.6) inset",
  };
  const statusIcon = (kind) => ({
    width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26,
    ...(kind === "check"
      ? { background: FOREST, color: "#fff" }
      : { background: "#FFF8E6", color: "#8B6A2A", border: "1px solid #E8DCC0" }),
  });
  // 진행바(시안 .prog) — 등급선택/입금/대기 3구간을 warm 골드로 표시.
  const prog = (
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
      {[2, 3, 4].map((s) => (
        <div key={s} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: step >= s ? GOLD : "#E8E1D8", transition: "all .25s",
        }} />
      ))}
    </div>
  );

  // ── STEP2: 공간보증 등급 선택 ──────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={card}>
        {prog}
        <div style={statusIcon("check")}>✓</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: INK, textAlign: "center", marginBottom: 6 }}>
          가입상담이 접수되었습니다
        </div>
        <div style={{ fontSize: 13.5, color: TEXT2, textAlign: "center", lineHeight: 1.6, marginBottom: 18 }}>
          이어서 <b>공간보증 등급</b>을 선택해 주세요.<br />
          예치금은 사고 시 1차 배상 재원이자 신뢰 등급입니다.
        </div>

        {!insuranceYn && (
          <div style={{
            fontSize: 12.5, color: GOLDD, background: GOLDB, border: `1px solid ${GOLD}`,
            borderRadius: 12, padding: "10px 12px", lineHeight: 1.6, marginBottom: 14,
          }}>
            시공보험 미가입(또는 미확인)으로 <b>예치금이 2배</b> 적용됩니다. 보험 가입 시 기본액으로 조정됩니다.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ONBOARDING_GRADES.map((g) => {
            const dep = calcDepositManwon(g.key, insuranceYn);
            const ic = GICON[g.key] ?? GICON.BASIC;
            return (
              <button key={g.key} onClick={() => pickGrade(g)} disabled={saving}
                className="gm-grade-opt"
                style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  background: WHITE, border: `1.5px solid ${LINE}`, borderRadius: 16,
                  padding: "16px 18px", cursor: saving ? "default" : "pointer",
                  textAlign: "left", fontFamily: SANS, opacity: saving ? 0.6 : 1,
                  transition: "border-color .2s, transform .2s, box-shadow .2s",
                }}>
                <span style={{
                  width: 44, height: 44, minWidth: 44, borderRadius: 12, background: ic.bg, color: ic.color,
                  border: `1px solid ${ic.border}`, display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0,
                }}>{ic.t}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14, display: "block", color: INK }}>{g.label}</b>
                  <small style={{ fontSize: 12, color: TEXT3, display: "block" }}>예치금 {wonFromManwon(dep)}</small>
                  <small style={{ fontSize: 12, color: GOLD, fontWeight: 700, display: "block" }}>베타 100업체 무료</small>
                </div>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#F9F6F2", display: "flex",
                  alignItems: "center", justifyContent: "center", color: GOLD, fontWeight: 700, flexShrink: 0,
                }}>›</span>
              </button>
            );
          })}
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            style={{ marginTop: 14, width: "100%", height: 40, border: "none", background: "transparent",
              color: TEXT3, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>
            나중에 하기
          </button>
        )}
      </div>
    );
  }

  // ── STEP3: 입금안내 (Mock) ─────────────────────────────────────────────────
  if (step === 3) {
    const g = ONBOARDING_GRADES.find((x) => x.key === grade);
    const ic = g ? (GICON[g.key] ?? GICON.BASIC) : GICON.BASIC;
    return (
      <div style={card}>
        {prog}
        <div style={{ fontSize: 17, fontWeight: 900, color: INK, textAlign: "center", marginBottom: 4 }}>
          예치금 입금 안내
        </div>
        <div style={{ fontSize: 13, color: TEXT2, textAlign: "center", lineHeight: 1.6, marginBottom: 18 }}>
          아래 계좌로 입금해 주세요. 관리자 확인 후 승인됩니다.<br />
          <span style={{ color: GOLD, fontWeight: 700 }}>베타 100업체까지는 입금 없이 바로 승인됩니다</span>
        </div>

        <div style={{
          background: "#F9F6F2", border: `1px solid ${LINE}`, borderRadius: 14,
          padding: "16px 18px", marginBottom: 14,
        }}>
          {[
            ["선택 등급", `${ic.t} ${g?.label ?? ""}`],
            ["입금 은행", DEPOSIT_MOCK.bank],
            ["계좌번호", DEPOSIT_MOCK.account],
            ["예금주", DEPOSIT_MOCK.owner],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0",
              fontSize: 14, borderBottom: `1px dashed ${LINE}` }}>
              <span style={{ color: TEXT3 }}>{k}</span>
              <span style={{ color: INK, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1.5px solid ${LINE}`,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: TEXT2, fontWeight: 700 }}>입금 금액</span>
            <span style={{ color: "#8B6A2A", fontWeight: 900, fontSize: 18 }}>{wonFromManwon(amount)}</span>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: TEXT3, textAlign: "center", lineHeight: 1.6, marginBottom: 16 }}>
          ※ 실제 결제·가상계좌 발급은 없습니다(표시용 계좌). 입금 후 아래 버튼을 눌러 주세요.
        </div>

        <button onClick={() => setStep(4)} style={goldBtn}>
          입금 완료 — 확인 요청
        </button>
      </div>
    );
  }

  // ── STEP4: 입금대기 ────────────────────────────────────────────────────────
  return (
    <div style={card}>
      {prog}
      <div style={statusIcon("wait")}>◐</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: INK, textAlign: "center", marginBottom: 8 }}>
        입금 확인 대기 중
      </div>
      <div style={{ fontSize: 13.5, color: TEXT2, textAlign: "center", lineHeight: 1.7, marginBottom: 18 }}>
        관리자가 입금을 확인하면 승인 절차가 진행됩니다.<br />
        승인 완료 후 <b>업체 로그인</b>으로 입장하시면<br />
        공간보증이 적용된 마이페이지가 활성화됩니다.
      </div>
      <div style={{
        background: "#FFF8E6", border: "1px solid #E8DCC0", borderRadius: 14,
        padding: "12px 14px", fontSize: 12.5, color: "#8B6A2A", lineHeight: 1.6, textAlign: "center",
      }}>
        상태: <b>입금대기중</b> · 자동 문자/이메일은 발송되지 않습니다.<br />
        <span style={{ fontSize: 11, color: TEXT3 }}>베타 100업체는 평균 3분 내 승인</span>
      </div>
      {onClose && (
        <button type="button" onClick={onClose}
          style={{ marginTop: 16, width: "100%", height: 44, borderRadius: 999, border: `1px solid ${LINE}`,
            background: WHITE, color: TEXT2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>
          닫기
        </button>
      )}
    </div>
  );
}
