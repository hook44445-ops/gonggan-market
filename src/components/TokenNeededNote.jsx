import { C, R } from "../constants";
import { getSessionToken } from "../lib/session";

// 로그인 토큰이 없는 로그인(09-25 이전 · 60일 지남) — 대화·수첩·서류가 비어 보이면 «사라졌다»로 오해한다(166~169).
//   그 화면 맨 위에 «한 번만 다시 인증» 을 보인다. 누르면 App 이 인증번호 화면으로(gonggan:reauth).
export const requestReauth = () => { try { window.dispatchEvent(new Event("gonggan:reauth")); } catch { /* noop */ } };

export default function TokenNeededNote({ userId, what = "대화" }) {
  if (!userId || getSessionToken(userId)) return null;
  return (
    <div role="status" style={{ background: "#FFF4DC", borderBottom: "1px solid #F0DDB0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span aria-hidden style={{ fontSize: 18 }}>🔒</span>
      <span style={{ flex: 1, fontSize: 12.5, color: "#5C4A12", lineHeight: 1.5 }}>
        보안이 강화돼 {what} 내용을 보려면 <b>인증번호로 한 번만 다시 로그인</b>해 주세요. 내용은 그대로 있어요.
      </span>
      <button type="button" onClick={requestReauth}
        style={{ flexShrink: 0, border: 0, borderRadius: R.md, padding: "8px 11px", background: C.brand, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
        인증하기
      </button>
    </div>
  );
}
