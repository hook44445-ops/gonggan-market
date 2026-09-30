import { C, R } from "../constants";
import { getSessionToken } from "../lib/session";
import ArtGlyph from "./common/ArtGlyph";

// 로그인 토큰이 없는 로그인(09-25 이전 · 60일 지남) — 대화·수첩·서류가 비어 보이면 «사라졌다»로 오해한다(166~169).
//   그 화면 맨 위에 «한 번만 다시 인증» 을 보인다. 누르면 App 이 인증번호 화면으로(gonggan:reauth).
export const requestReauth = () => { try { window.dispatchEvent(new Event("gonggan:reauth")); } catch { /* noop */ } };

export default function TokenNeededNote({ userId, what = "대화" }) {
  if (!userId || getSessionToken(userId)) return null;
  return (
    <div role="status" style={{ background: "#FFF4DC", borderBottom: "1px solid #F0DDB0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <ArtGlyph src="/images/emblem/lock-sm.webp" emoji="🔒" size={30} />
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

// 서버가 «토큰의 사용자»로 거절했을 때(166~169) 영문 코드 대신 사람 말로 — 로그인 문제면 다시 인증으로 이어 준다.
export function alertRpcError(prefix, error) {
  const m = String(error?.message ?? error ?? "");
  if (/LOGIN_REQUIRED|JWT/.test(m)) {
    if (window.confirm("로그인이 풀렸어요. 보안을 위해 인증번호로 한 번만 다시 로그인할까요?\n(방금 적은 내용은 저장되지 않았어요)")) requestReauth();
    return;
  }
  if (/NOT_(COMPANY|REQUEST|ESTIMATE|SITE_VISIT|PROJECT|CONTRACT)_?\w*/.test(m)) {
    window.alert(`${prefix} — 이 공사의 당사자 계정이 아니에요. 고객·업체 계정을 바꿨다면 맞는 계정으로 다시 로그인해 주세요.`);
    return;
  }
  window.alert(`${prefix}: ${m || "잠시 후 다시 시도해 주세요"}`);
}
