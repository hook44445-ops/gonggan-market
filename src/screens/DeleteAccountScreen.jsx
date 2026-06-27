// 공간마켓 계정 삭제 페이지 (/delete-account)
// - Google Play "데이터 보안 → 계정 삭제 URL" 대응 공개 페이지
//   (https://gongganmarket.com/delete-account)
// - 동시에 앱(TWA) 내 [마이페이지 → 설정 → 회원탈퇴] 진입점이기도 하다.
//   로그인 세션이 있으면 실제 탈퇴 플로우(안내 → 동의 → 확인 → 처리)를,
//   없으면 안내 + 로그인 유도를 표시한다.
// 라우터 미사용 SPA — App.jsx 에서 window.location.pathname === "/delete-account"
// 일 때 이 화면을 렌더한다.

import { useState } from "react";
import { deleteUserAccount } from "../lib/supabase";
import { clearDeviceAuth } from "../lib/deviceAuth";

const SESSION_USER_KEY = "gonggan_user";

const C = {
  green: "#2E5F4B", greenDark: "#1D3D2F", bg: "#f3f0ea", surface: "#fff",
  text1: "#3a352c", text2: "#5a5346", text3: "#7a7464", red: "#c0392b",
  redDark: "#a5281b", line: "#ddd6ca", warnBg: "#fbeae7",
};

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_USER_KEY) || "null"); }
  catch { return null; }
}

function goHome() { window.location.href = "/"; }

export default function DeleteAccountScreen() {
  const session = loadSession();
  const loggedIn = !!(session && session.id && session.phone && session.verified !== false);

  const [agreed, setAgreed]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState("");
  const [done, setDone]             = useState(false);

  async function handleDelete() {
    setBusy(true); setError("");
    try {
      const r = await deleteUserAccount(session.id, session.phone);
      if (r.ok && r.success) {
        // 세션 + 기기 인증 완전 삭제 → 로그아웃 상태로 전환
        try { localStorage.removeItem(SESSION_USER_KEY); } catch { /* noop */ }
        try { clearDeviceAuth(); } catch { /* noop */ }
        setShowConfirm(false);
        setDone(true);
        setTimeout(goHome, 3000);
        return;
      }
      if (r.status === 409 || r.error === "IN_PROGRESS_PROJECT") {
        setError("진행 중인 프로젝트가 있어 탈퇴할 수 없습니다. 모든 프로젝트가 완료 또는 취소된 후 다시 시도해주세요.");
      } else if (r.error === "PHONE_MISMATCH" || r.error === "USER_NOT_FOUND") {
        setError("계정 정보가 일치하지 않습니다. 앱에서 다시 로그인한 뒤 시도해주세요.");
      } else {
        setError("탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      setShowConfirm(false);
    } catch {
      setError("네트워크 오류로 탈퇴를 완료하지 못했습니다. 다시 시도해주세요.");
      setShowConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg,
      fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", color: C.text1 }}>
      {/* 상단 바 */}
      <div style={{ position: "sticky", top: 0, background: C.green, color: "#fff",
        padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)", zIndex: 10 }}>
        <button onClick={goHome} aria-label="홈으로" style={{ background: "rgba(255,255,255,0.15)",
          border: "none", color: "#fff", borderRadius: 8, width: 34, height: 34, fontSize: 18,
          cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px" }}>공간마켓 계정 삭제</div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 20px 60px" }}>
        {done ? (
          <div style={{ background: C.surface, borderRadius: 14, padding: "28px 22px",
            border: `1px solid ${C.line}`, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.green, marginBottom: 10 }}>
              회원탈퇴가 완료되었습니다.
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.85, color: C.text2, margin: 0 }}>
              그동안 공간마켓을 이용해주셔서 감사합니다.<br />
              잠시 후 홈으로 이동합니다.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.85, color: C.text2, margin: "0 0 18px" }}>
              앱 또는 본 페이지에서 공간마켓 계정 삭제(회원탈퇴)를 요청할 수 있습니다.
              회원탈퇴 시 개인정보는 개인정보처리방침에 따라 처리됩니다.
            </p>

            {/* 안내문 */}
            <div style={{ background: C.surface, borderRadius: 14, padding: "18px 20px",
              border: `1px solid ${C.line}`, marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 10 }}>회원탈퇴 시</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {[
                  "계정이 삭제됩니다.",
                  "프로필이 삭제됩니다.",
                  "작성한 게시글 및 댓글은 운영정책에 따라 처리됩니다.",
                  "진행 중인 프로젝트가 있다면 탈퇴할 수 없습니다.",
                ].map((t) => (
                  <li key={t} style={{ fontSize: 13.5, lineHeight: 1.95, color: C.text2 }}>{t}</li>
                ))}
              </ul>
            </div>

            {error && (
              <div style={{ background: C.warnBg, border: `1px solid #e6b8b0`, color: C.redDark,
                borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {loggedIn ? (
              <>
                {/* 동의 체크박스 */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10,
                  cursor: "pointer", marginBottom: 18, padding: "4px 2px" }}>
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 1, accentColor: C.green, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: C.text1, lineHeight: 1.6 }}>
                    위 내용을 모두 확인했습니다.
                  </span>
                </label>

                {/* 버튼 */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={goHome} style={{ flex: 1, padding: "13px", background: C.surface,
                    color: C.text2, border: `1px solid ${C.line}`, borderRadius: 12, fontWeight: 700,
                    fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!agreed || busy}
                    style={{ flex: 1, padding: "13px",
                      background: agreed && !busy ? C.red : "#cbb8b3", color: "#fff", border: "none",
                      borderRadius: 12, fontWeight: 800, fontSize: 14,
                      cursor: agreed && !busy ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                    회원탈퇴
                  </button>
                </div>
              </>
            ) : (
              <div style={{ background: C.surface, borderRadius: 14, padding: "18px 20px",
                border: `1px solid ${C.line}` }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.85, color: C.text2, margin: "0 0 14px" }}>
                  회원탈퇴는 본인 확인을 위해 <b>로그인 후</b> 진행할 수 있습니다.
                  앱에서 로그인한 뒤 <b>[마이페이지 → 설정 → 회원탈퇴]</b> 에서 삭제를 요청해주세요.
                </p>
                <button onClick={goHome} style={{ width: "100%", padding: "13px", background: C.green,
                  color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit" }}>
                  앱 열기 / 로그인
                </button>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: C.text3, margin: "14px 0 0" }}>
                  삭제 요청 또는 문의: gongganmarket.biz@gmail.com
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 확인 모달 */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100 }}
          onClick={() => !busy && setShowConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16,
            padding: "24px 22px", maxWidth: 360, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 10 }}>
              정말 회원탈퇴 하시겠습니까?
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.8, color: C.text2, margin: "0 0 20px" }}>
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} disabled={busy}
                style={{ flex: 1, padding: "12px", background: C.surface, color: C.text2,
                  border: `1px solid ${C.line}`, borderRadius: 12, fontWeight: 700, fontSize: 14,
                  cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>취소</button>
              <button onClick={handleDelete} disabled={busy}
                style={{ flex: 1, padding: "12px", background: busy ? "#cbb8b3" : C.red, color: "#fff",
                  border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14,
                  cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
                {busy ? "처리 중…" : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
