import { useState } from "react";
import { dlog } from "../utils/devLog"; // 프로덕션 무출력 진단 로거(운영 콘솔 정리)
import { C, R, S } from "../constants";
import { LogoMark } from "../components/common";

// 기기 인증 후 재진입 화면 — 전화번호 인증 없이 저장된 계정으로 재로그인.
// 로그아웃해도 이 화면으로 진입한다(전화번호 인증 화면 아님).
// "다른 번호로 로그인" / "이 기기 인증 삭제(완전 로그아웃)"는 별도 동작.

const ROLE_LABEL = { consumer: "의뢰인", company: "업체", admin: "관리자", operator: "운영자" };

const maskPhone = (p) => {
  if (!p) return "";
  const d = String(p).replace(/\D/g, "");
  const local = d.startsWith("82") ? "0" + d.slice(2) : d; // +82 → 0
  if (local.length < 7) return local;
  return `${local.slice(0, 3)}-····-${local.slice(-4)}`;
};

const fmtAgo = (ts) => {
  if (!ts) return "";
  const day = Math.floor((Date.now() - ts) / 86400000);
  if (day <= 0) return "오늘 사용";
  if (day === 1) return "어제 사용";
  if (day < 30) return `${day}일 전 사용`;
  return new Date(ts).toLocaleDateString("ko-KR");
};

export default function AccountPicker({ users = [], busyId = null, onPick, onAddAccount, onForgetDevice, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);

  // 재진입 화면 — 로그인 첫 화면과 같은 호흡(사진 한 장 · 절제된 글 · 조용한 목록).
  // 예전에는 이모지 아이콘(집·망치·방패)과 굵은 테두리 버튼이 나열돼 품격이 떨어졌다.
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 20px", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {onBack && (
          <button onClick={() => onBack()} disabled={!!busyId}
            style={{ background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 600,
              cursor: "pointer", padding: 0, marginBottom: 10 }}>
            ← 처음으로
          </button>
        )}

        {/* 사진 — 로그인 화면과 같은 장면. 아래로 갈수록 배경색에 잠긴다. */}
        <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <img src="/images/intro/hero.webp" alt="" width={900} height={600}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ width: "100%", height: 168, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, rgba(246,243,238,0) 20%, rgba(246,243,238,0.74) 60%, ${C.bg} 94%)` }} />
          <div style={{ position: "absolute", left: 20, right: 20, bottom: 14 }}>
            <div style={{ fontSize: 10, color: C.text3, letterSpacing: "0.2em", marginBottom: 7 }}>BY 공간사이</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <LogoMark size={24} bare />
              <span style={{ fontSize: 24, fontWeight: 700, color: C.text1, letterSpacing: "-0.03em", lineHeight: 1.2 }}>공간마켓</span>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 4px", marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text1, letterSpacing: "-0.03em" }}>다시 오셨네요</div>
          <div style={{ fontSize: 13.5, color: C.text3, marginTop: 6, lineHeight: 1.7 }}>
            이 기기에서 인증된 계정입니다. 바로 이어서 시작하세요.
          </div>
        </div>

        {/* 계정 — 카드 나열이 아니라 한 장의 목록. 줄 사이 얇은 선만 둔다. */}
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 18,
          overflow: "hidden", boxShadow: "0 1px 2px rgba(28,23,18,0.04)" }}>
          {users.map((u, i) => {
            const key = u.userId || `${u.phone}-${u.role}`;
            const busy = busyId && busyId === key;
            const initial = (u.name || ROLE_LABEL[u.role] || "계").trim().charAt(0);
            return (
              <button key={key} onClick={() => { dlog("[GONGGAN_DEBUG][AccountPicker:click]", { userId: u?.userId ?? null, role: u?.role ?? null, phone: u?.phone ?? null, ownerId: u?.ownerId ?? null }); onPick?.(u); }} disabled={!!busyId}
                style={{
                  width: "100%", background: "none", border: "none",
                  borderTop: i ? `1px solid ${C.bgWarm}` : "none",
                  padding: "15px 18px", display: "flex", alignItems: "center", gap: 13,
                  cursor: busyId ? "default" : "pointer", textAlign: "left",
                  opacity: busyId && !busy ? 0.45 : 1, transition: "opacity .15s",
                }}>
                <span style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: C.bg, border: `1px solid ${C.bgWarm}`, color: C.brandD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.02em",
                }}>{initial}</span>
                <span style={{ flex: 1, minWidth: 0, display: "block" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700, color: C.text1, letterSpacing: "-0.02em",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.name || "내 계정"}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.text4, flexShrink: 0 }}>{ROLE_LABEL[u.role] ?? u.role}</span>
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: C.text3, marginTop: 3 }}>
                    {maskPhone(u.phone)}{u.lastLoginAt ? ` · ${fmtAgo(u.lastLoginAt)}` : ""}
                  </span>
                </span>
                <span style={{ marginLeft: "auto", color: busy ? C.text4 : C.text3, fontSize: 16, flexShrink: 0 }}>
                  {busy ? "…" : "›"}
                </span>
              </button>
            );
          })}
        </div>

        <button onClick={() => onAddAccount?.()} disabled={!!busyId}
          style={{
            width: "100%", padding: "15px", marginTop: 12, background: "none", color: C.text2,
            border: `1px solid ${C.bgWarm}`, borderRadius: 14, fontWeight: 600, fontSize: 14,
            letterSpacing: "-0.01em", cursor: busyId ? "default" : "pointer",
          }}>
          다른 번호로 로그인
        </button>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} disabled={!!busyId}
              style={{ background: "none", border: "none", fontSize: 12, color: C.text4, cursor: "pointer", fontWeight: 500 }}>
              이 기기 인증 삭제
            </button>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 14, padding: S.lg, textAlign: "left" }}>
              <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.7, marginBottom: 12 }}>
                저장된 계정 목록과 기기 인증이 삭제됩니다.<br />
                다음 로그인 때 전화번호 인증을 다시 하셔야 합니다.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmReset(false)}
                  style={{ flex: 1, padding: "11px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={() => { setConfirmReset(false); onForgetDevice?.(); }}
                  style={{ flex: 1, padding: "11px", background: "none", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
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
