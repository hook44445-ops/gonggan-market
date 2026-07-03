import { Component } from "react";
import { C, R, S } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";

// Build-time git sha (injected via vite define). Falls back to "unknown".
const DEPLOY_SHA = typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "unknown";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Rendering crash caught:", error, info.componentStack);
  }

  // Best-effort context for diagnostics — never throws.
  getDiag() {
    let route = "unknown";
    let activeRole = this.props.activeRole ?? "unknown";
    try {
      route =
        (typeof window !== "undefined" && window.__GG_ROUTE__) ||
        (typeof window !== "undefined" && window.location
          ? window.location.pathname + window.location.hash
          : "unknown");
    } catch {}
    try {
      if (activeRole === "unknown" && typeof localStorage !== "undefined") {
        const raw = localStorage.getItem("gonggan_user");
        if (raw) {
          const u = JSON.parse(raw);
          activeRole = u?.activeRole ?? u?.role ?? "unknown";
        }
      }
    } catch {}
    return { route, activeRole };
  }

  render() {
    if (this.state.hasError) {
      const { onLogout } = this.props;
      return (
        <div style={{
          minHeight: "100vh", background: C.bg,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: S.xxl, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
        }}>
          <div style={{ fontSize: 48, marginBottom: S.lg }}>🌿</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            이런, 화면에 문제가 생겼어요
          </div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xxl, textAlign: "center", lineHeight: 1.7 }}>
            잠시 쉬어가는 중일 거예요. 아래 버튼을 눌러 다시 시도하거나<br />로그아웃 후 다시 들어와 주세요.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "13px 28px", background: C.brand, color: "#fff",
              border: "none", borderRadius: R.full, fontWeight: 800,
              fontSize: 15, cursor: "pointer", marginBottom: S.md,
              boxShadow: `0 4px 16px ${C.brand}44`,
            }}
          >
            🏠 홈으로 돌아가기
          </button>
          {onLogout && (
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                onLogout();
              }}
              style={{
                padding: "11px 24px", background: "transparent", color: C.text3,
                border: `1px solid ${C.bgWarm}`, borderRadius: R.full, fontWeight: 700,
                fontSize: 14, cursor: "pointer",
              }}
            >
              로그아웃
            </button>
          )}

          {/* 진단 정보 — 일반 사용자에게는 노출하지 않고, 디버그 모드에서만 확인. */}
          {SHOW_DEBUG_UI && (() => {
            const { route, activeRole } = this.getDiag();
            const msg = this.state.error?.message ?? String(this.state.error ?? "unknown");
            return (
              <div style={{
                marginTop: S.xxl, maxWidth: 360, width: "100%",
                background: "#111", color: "#0f0", borderRadius: R.md,
                padding: "10px 12px", fontSize: 10.5, lineHeight: 1.8,
                fontFamily: "monospace", wordBreak: "break-all", textAlign: "left",
              }}>
                <div>error: {msg}</div>
                <div>route: {route}</div>
                <div>activeRole: {String(activeRole)}</div>
                <div>sha: {DEPLOY_SHA}</div>
              </div>
            );
          })()}
        </div>
      );
    }
    return this.props.children;
  }
}
