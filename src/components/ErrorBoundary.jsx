import { Component } from "react";
import { C, R, S } from "../constants";

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
          <div style={{ fontSize: 48, marginBottom: S.lg }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            화면을 불러오는 중 오류가 발생했습니다
          </div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xxl, textAlign: "center", lineHeight: 1.7 }}>
            일시적인 오류입니다. 아래 버튼을 눌러 복구하거나<br />로그아웃 후 다시 시도해주세요.
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
        </div>
      );
    }
    return this.props.children;
  }
}
