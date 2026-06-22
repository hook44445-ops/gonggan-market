// ─────────────────────────────────────────────────────
// 공간보증 현황 카드 (업체 마이페이지) — migration 068.
//   · NONE: 5등급 선택 → PENDING_DEPOSIT(예치금 입금 안내).
//   · 상태별 FSM 표시 + 무인 자동화 단계 시각화.
//   · ACTIVE: 출금 신청(상태만, 실제 송금 없음 — 관리자가 NONE 처리).
// company_status(입찰 게이트)와 무관. 표시/관리 전용.
// ─────────────────────────────────────────────────────
import { useState } from "react";
import { C, R, S } from "../constants";
import { SHOW_BETA_UI } from "../constants/release"; // 베타: 공간보증 사전신청 문구
import { selectCompanyGuarantee } from "../lib/supabase";
import {
  GUARANTEE_GRADES, GUARANTEE_GRADE_MAP, GUARANTEE_STATUS_META,
  GUARANTEE_FLOW_STEPS, wonFromManwon,
} from "../constants/guarantee";

export default function GuaranteeCard({ company, actorId, onChange }) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(null);
  if (!company?.id) return null;

  const status = company.guarantee_status ?? "NONE";
  const meta = GUARANTEE_STATUS_META[status] ?? GUARANTEE_STATUS_META.NONE;
  const grade = company.guarantee_grade ? GUARANTEE_GRADE_MAP[company.guarantee_grade] : null;
  const amount = company.guarantee_amount ?? grade?.amount ?? null;
  const isNone = status === "NONE";

  const fmtDate = (t) => t ? new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "—";

  const submitGrade = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const { error } = await selectCompanyGuarantee(actorId, company.id, picked);
      if (error) { alert("등급 신청에 실패했어요. 잠시 후 다시 시도해 주세요."); return; }
      setPicked(null);
      await onChange?.();
    } catch {
      alert("등급 신청 중 오류가 발생했어요.");
    } finally { setBusy(false); }
  };

  const requestWithdraw = () => {
    // 1차: 상태만. 실제 송금/자동 처리 없음 — 관리자가 확인 후 NONE 으로 전환.
    alert("출금 신청이 접수되었습니다.\n관리자 확인 후 처리되며, 처리 시 공간보증 배지가 해제됩니다.");
  };

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.md }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>🛡 공간보증 현황</div>
        <span style={{ background: meta.bg, color: meta.color, borderRadius: R.full, padding: "3px 11px", fontSize: 12, fontWeight: 800 }}>
          {meta.label}
        </span>
      </div>

      {/* 무인 자동화 단계 — 현재 단계 표시 */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: S.lg, overflowX: "auto", paddingBottom: 4 }}>
        {GUARANTEE_FLOW_STEPS.map((s, i) => {
          const done = meta.step > i;
          const cur = meta.step === i + 1;
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", margin: "0 auto 4px",
                  background: done || cur ? C.brand : C.bgWarm, color: done || cur ? "#fff" : C.text3,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
                  {done ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 9.5, fontWeight: cur ? 800 : 500, color: cur ? C.brand : C.text3, whiteSpace: "nowrap" }}>{s.label}</div>
              </div>
              {i < GUARANTEE_FLOW_STEPS.length - 1 && <div style={{ width: 14, height: 2, background: done ? C.brand : C.bgWarm, margin: "0 2px 14px" }} />}
            </div>
          );
        })}
      </div>

      {/* 본문 — 상태별 */}
      {isNone ? (
        <>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.md, lineHeight: 1.6 }}>
            공간보증 등급을 선택하면 예치금 안내 후, 관리자 입금 확인·승인을 거쳐 공간보증 배지가 활성화됩니다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: S.md }}>
            {GUARANTEE_GRADES.map((g) => {
              const sel = picked === g.key;
              return (
                <button key={g.key} onClick={() => setPicked(g.key)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                    background: sel ? C.brandL : C.surface2, border: `1.5px solid ${sel ? C.brand : C.bgWarm}`,
                    borderRadius: R.lg, padding: "12px 14px", cursor: "pointer" }}>
                  <span style={{ fontSize: 22 }}>{g.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{g.label}</div>
                    <div style={{ fontSize: 12, color: C.text3 }}>예치금 {wonFromManwon(g.amount)}</div>
                  </div>
                  {sel && <span style={{ color: C.brand, fontWeight: 900 }}>✓</span>}
                </button>
              );
            })}
          </div>
          <button onClick={submitGrade} disabled={!picked || busy}
            style={{ width: "100%", height: 48, borderRadius: R.lg, border: "none",
              background: picked ? C.brand : C.bgWarm, color: picked ? "#fff" : C.text3,
              fontSize: 15, fontWeight: 800, cursor: picked && !busy ? "pointer" : "default" }}>
            {busy ? "신청 중…" : (SHOW_BETA_UI ? "공간보증 사전신청" : "이 등급으로 공간보증 신청")}
          </button>
          {SHOW_BETA_UI && (
            <div style={{ fontSize: 12, color: C.text3, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
              현재는 <b style={{ color: C.brand }}>사전신청</b>만 접수됩니다. 정식 서비스 오픈 후 심사가 진행됩니다.
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface2, borderRadius: R.lg, padding: "14px 16px", marginBottom: S.md }}>
            <span style={{ fontSize: 30 }}>{grade?.emoji ?? "🛡"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text1 }}>{grade?.label ?? "—"}</div>
              <div style={{ fontSize: 13, color: C.text2, fontWeight: 700 }}>예치금 {amount != null ? wonFromManwon(amount) : "—"}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: S.md }}>
            <Info label="상태" value={meta.label} />
            <Info label="최근 변경" value={fmtDate(company.guarantee_updated_at)} />
          </div>

          {status === "PENDING_DEPOSIT" && (
            <div style={{ background: "#FBF5E8", border: "1px solid #E8D9B5", borderRadius: R.lg, padding: "12px 14px", marginBottom: S.md }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#B08040", marginBottom: 4 }}>예치금 입금 안내</div>
              <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>
                안내된 계좌로 <b>{amount != null ? wonFromManwon(amount) : "—"}</b> 입금 후, 관리자 확인을 기다려 주세요.
                입금 확인 → 승인 시 공간보증 배지가 활성화됩니다. (자동 입금 확인 없음)
              </div>
            </div>
          )}

          {status === "ACTIVE" && (
            <button onClick={requestWithdraw}
              style={{ width: "100%", height: 46, borderRadius: R.lg, border: `1.5px solid ${C.bgWarm}`,
                background: C.surface, color: C.text2, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              출금 신청
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ background: C.surface2, borderRadius: R.md, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{value}</div>
    </div>
  );
}
