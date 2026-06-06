import { useState } from "react";
import { C, R, S } from "../constants";
import { LogoMark } from "../components/common";

// 기기 인증 후 재진입 화면 — 전화번호 인증 없이 저장된 계정으로 재로그인.
// 로그아웃해도 이 화면으로 진입한다(전화번호 인증 화면 아님).
// "다른 번호로 로그인" / "이 기기 인증 삭제(완전 로그아웃)"는 별도 동작.

const ROLE_LABEL = { consumer: "의뢰인", company: "업체", admin: "관리자", operator: "운영자" };
const ROLE_ICON  = { consumer: "🏡", company: "🔨", admin: "🛡", operator: "🎫" };

const maskPhone = (p) => {
  if (!p) return "";
  const d = String(p).replace(/\D/g, "");
  const local = d.startsWith("82") ? "0" + d.slice(2) : d; // +82 → 0
  if (local.length < 7) return local;
  const head = local.slice(0, local.length - 8 >= 0 ? 3 : 3);
  const tail = local.slice(-4);
  return `${head}-····-${tail}`;
};

const fmtAgo = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const day = Math.floor(diff / 86400000);
  if (day <= 0) return "오늘 사용";
  if (day === 1) return "어제 사용";
  if (day < 30) return `${day}일 전 사용`;
  return new Date(ts).toLocaleDateString("ko-KR");
};

export default function AccountPicker({ users = [], busyId = null, onPick, onAddAccount, onForgetDevice, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 20px", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 390 }}>
        {onBack && (
          <button onClick={() => onBack()} disabled={!!busyId}
            style={{ background: "none", border: "none", color: C.text3, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 8 }}>
            ← 처음으로
          </button>
        )}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 24, margin: "0 auto 12px",
            background: C.surface, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 10px 30px ${C.brand}22`, border: `1px solid ${C.bgWarm}`,
          }}><LogoMark size={46} bare /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.brandD, letterSpacing: "-0.5px" }}>다시 오셨네요</div>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 6 }}>
            이 기기에서 인증된 계정으로 바로 시작하세요
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: S.xl }}>
          {users.map((u) => {
            const key = u.userId || `${u.phone}-${u.role}`;
            const busy = busyId && busyId === key;
            return (
              <button key={key} onClick={() => { console.log("[GONGGAN_DEBUG][AccountPicker:click]", { userId: u?.userId ?? null, role: u?.role ?? null, phone: u?.phone ?? null, ownerId: u?.ownerId ?? null }); onPick?.(u); }} disabled={!!busyId}
                style={{
                  background: C.surface, border: `1.5px solid ${C.bgWarm}`, borderRadius: R.xl,
                  padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
                  cursor: busyId ? "default" : "pointer", textAlign: "left",
                  boxShadow: "0 2px 10px rgba(28,23,18,0.06)", opacity: busyId && !busy ? 0.5 : 1,
                }}>
                <div style={{
                  width: 46, height: 46, borderRadius: R.lg, flexShrink: 0,
                  background: C.brandL, border: `1.5px solid ${C.brandM}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>{ROLE_ICON[u.role] ?? "👤"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.name || "내 계정"}
                    </span>
                    <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>
                    {maskPhone(u.phone)}{u.lastLoginAt ? ` · ${fmtAgo(u.lastLoginAt)}` : ""}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", color: C.brand, fontSize: 18, flexShrink: 0 }}>
                  {busy ? "…" : "›"}
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={() => onAddAccount?.()} disabled={!!busyId}
          style={{
            width: "100%", padding: "15px", background: C.surface, color: C.brand,
            border: `2px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 800, fontSize: 15,
            cursor: busyId ? "default" : "pointer", marginBottom: 10,
          }}>
          + 다른 번호로 로그인
        </button>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} disabled={!!busyId}
              style={{ background: "none", border: "none", fontSize: 12, color: C.text4, cursor: "pointer", fontWeight: 600 }}>
              이 기기 인증 삭제 (완전 로그아웃)
            </button>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.lg }}>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: 10 }}>
                저장된 계정 목록과 기기 인증이 삭제됩니다.<br />
                다음 로그인 시 전화번호 인증을 다시 진행해야 합니다.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmReset(false)}
                  style={{ flex: 1, padding: "11px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={() => { setConfirmReset(false); onForgetDevice?.(); }}
                  style={{ flex: 1, padding: "11px", background: C.red, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  삭제하고 로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
