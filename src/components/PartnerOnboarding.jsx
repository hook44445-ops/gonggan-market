import { useState } from "react";
import { selectPartnerLeadGrade } from "../lib/supabase";
import {
  ONBOARDING_GRADES, calcDepositManwon, wonFromManwon, DEPOSIT_MOCK,
} from "../constants/partnerOnboarding";

// ── Design tokens (랜딩과 동일 계열) ───────────────────────────────────────────
const NAVY = "#0B1D3A";
const GOLD = "#C9A84C";
const GOLDD = "#A8813A";
const GOLDB = "rgba(201,168,76,0.12)";
const WHITE = "#FFFFFF";
const TEXT2 = "#4B5E78";
const TEXT3 = "#7A8EA8";
const SANS = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// ════════════════════════════════════════════════════════════════════
// PartnerOnboarding — 가입상담 제출(STEP1) 직후 이어지는 무인 온보딩 STEP2~4.
//   STEP2 공간보증 등급 선택 → STEP3 입금안내(Mock) → STEP4 입금대기.
//   관리자 입금확인/승인(STEP5~)은 AdminScreen, company 생성은 최초 로그인 시 브릿지.
//   토스/실결제 없음 — 표시/상태만. (migration 069)
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
      console.log("[partner_lead_select_grade]", { leadId, grade: g.key, insuranceYn, data, error });
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
    background: WHITE, border: `1.5px solid #E1E7EF`, borderRadius: 16,
    padding: "24px 20px", fontFamily: SANS,
  };
  const stepDots = (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
      {[2, 3, 4].map((s) => (
        <div key={s} style={{
          width: step === s ? 22 : 7, height: 7, borderRadius: 99,
          background: step >= s ? GOLD : "#DDE3EC", transition: "all .25s",
        }} />
      ))}
    </div>
  );

  // ── STEP2: 공간보증 등급 선택 ──────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={card}>
        {stepDots}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>✅</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, textAlign: "center", marginBottom: 6 }}>
          가입상담이 접수되었습니다
        </div>
        <div style={{ fontSize: 13.5, color: TEXT2, textAlign: "center", lineHeight: 1.6, marginBottom: 18 }}>
          이어서 <b>공간보증 등급</b>을 선택해 주세요.<br />
          예치금은 사고 시 1차 배상 재원이자 신뢰 등급입니다.
        </div>

        {!insuranceYn && (
          <div style={{
            fontSize: 12.5, color: GOLDD, background: GOLDB, border: `1px solid ${GOLD}`,
            borderRadius: 10, padding: "10px 12px", lineHeight: 1.6, marginBottom: 14,
          }}>
            ⚠️ 시공보험 미가입(또는 미확인)으로 <b>예치금이 2배</b> 적용됩니다. 보험 가입 시 기본액으로 조정됩니다.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ONBOARDING_GRADES.map((g) => {
            const dep = calcDepositManwon(g.key, insuranceYn);
            return (
              <button key={g.key} onClick={() => pickGrade(g)} disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: WHITE, border: `1.5px solid #E1E7EF`, borderRadius: 12,
                  padding: "14px 16px", cursor: saving ? "default" : "pointer",
                  textAlign: "left", fontFamily: SANS, opacity: saving ? 0.6 : 1,
                }}>
                <span style={{ fontSize: 24 }}>{g.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: TEXT3 }}>예치금 {wonFromManwon(dep)}</div>
                </div>
                <span style={{ fontSize: 18, color: GOLD, fontWeight: 900 }}>›</span>
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
    return (
      <div style={card}>
        {stepDots}
        <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, textAlign: "center", marginBottom: 4 }}>
          예치금 입금 안내
        </div>
        <div style={{ fontSize: 13, color: TEXT2, textAlign: "center", lineHeight: 1.6, marginBottom: 18 }}>
          아래 계좌로 입금해 주세요. 관리자 확인 후 승인됩니다.
        </div>

        <div style={{
          background: "#F7F9FC", border: `1px solid #E1E7EF`, borderRadius: 12,
          padding: "16px 18px", marginBottom: 14,
        }}>
          {[
            ["선택 등급", `${g?.emoji} ${g?.label}`],
            ["입금 은행", DEPOSIT_MOCK.bank],
            ["계좌번호", DEPOSIT_MOCK.account],
            ["예금주", DEPOSIT_MOCK.owner],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
              <span style={{ color: TEXT3 }}>{k}</span>
              <span style={{ color: NAVY, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px dashed #D5DCE6`, marginTop: 8, paddingTop: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: TEXT2, fontWeight: 700 }}>입금 금액</span>
            <span style={{ color: GOLDD, fontWeight: 900, fontSize: 18 }}>{wonFromManwon(amount)}</span>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: TEXT3, textAlign: "center", lineHeight: 1.6, marginBottom: 16 }}>
          ※ 실제 결제·가상계좌 발급은 없습니다(표시용 계좌). 입금 후 아래 버튼을 눌러 주세요.
        </div>

        <button onClick={() => setStep(4)}
          style={{ width: "100%", height: 52, borderRadius: 12, border: "none", cursor: "pointer",
            background: GOLD, color: WHITE, fontSize: 16, fontWeight: 900, fontFamily: SANS,
            boxShadow: `0 6px 20px rgba(201,168,76,0.35)` }}>
          입금 완료 — 확인 요청
        </button>
      </div>
    );
  }

  // ── STEP4: 입금대기 ────────────────────────────────────────────────────────
  return (
    <div style={card}>
      {stepDots}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 34 }}>⏳</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, textAlign: "center", marginBottom: 8 }}>
        입금 확인 대기 중
      </div>
      <div style={{ fontSize: 13.5, color: TEXT2, textAlign: "center", lineHeight: 1.7, marginBottom: 18 }}>
        관리자가 입금을 확인하면 승인 절차가 진행됩니다.<br />
        승인 완료 후 <b>업체 로그인</b>으로 입장하시면<br />
        공간보증이 적용된 마이페이지가 활성화됩니다.
      </div>
      <div style={{
        background: GOLDB, border: `1px solid ${GOLD}`, borderRadius: 10,
        padding: "12px 14px", fontSize: 12.5, color: GOLDD, lineHeight: 1.6, textAlign: "center",
      }}>
        상태: <b>입금대기중</b> · 자동 문자/이메일은 발송되지 않습니다.
      </div>
      {onClose && (
        <button type="button" onClick={onClose}
          style={{ marginTop: 16, width: "100%", height: 44, borderRadius: 12, border: `1.5px solid #DDE3EC`,
            background: WHITE, color: TEXT2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>
          닫기
        </button>
      )}
    </div>
  );
}
