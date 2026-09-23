// 사업자 정보 푸터 (토스 PG 승인용) — LandingScreen 하단 정보 영역에 배치.
// 작은 서브텍스트 · 회색 톤 · 비강조. 기존 공간마켓 스타일(차분한 베이지/그레이)에 맞춘다.
//
// 사업자 정보의 단일 소스는 utils/siteSeo.js 다 — 푸터·사업자정보 모달·법적고지뿐 아니라
// 봇 프리렌더의 JSON-LD(Organization)도 같은 값을 쓴다. 여기서는 재노출만 한다
// (기존 import 경로 `from "./AppFooter"` 를 깨지 않기 위해).
import { BIZ_ROWS, TELECOM_SALES_NO } from "../utils/siteSeo";

export { BIZ_ROWS, TELECOM_SALES_NO };

export default function AppFooter() {
  return (
    <div style={{ padding: "2px 8px 14px", textAlign: "center", lineHeight: 1.75 }}>
      <div style={{ fontSize: 13, color: "rgba(44,62,50,0.6)", letterSpacing: "-0.2px", fontWeight: 500, marginBottom: 10, lineHeight: 1.6 }}>
        좋은 공간은 좋은 만남에서 시작됩니다
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8275", marginBottom: 6, letterSpacing: "0.02em" }}>
        공간사이 사업자 정보
      </div>
      <div style={{ fontSize: 11, color: "#7A7670", letterSpacing: "0.01em" }}>
        {BIZ_ROWS.map(([label, value]) => (
          <div key={label}>
            <span style={{ color: "#948C7F" }}>{label}</span>{" "}{value}
          </div>
        ))}
      </div>
      {/* 판매 상품 안내 링크 — 토스 PG 심사용(비회원 열람용 상품 페이지). */}
      <div style={{ marginTop: 10, fontSize: 11, color: "#7A7670" }}>
        <a href="/safe-payment" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          공간안전결제 안내
        </a>
        <span style={{ color: "#c4bcae", margin: "0 8px" }}>·</span>
        <a href="/tokens" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          공간토큰 구매
        </a>
      </div>
      {/* 법적고지 링크 — 토스 PG 심사용. 앱 내부 라우트(/privacy, /terms). */}
      <div style={{ marginTop: 6, fontSize: 11, color: "#7A7670" }}>
        <a href="/privacy" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          개인정보처리방침
        </a>
        <span style={{ color: "#c4bcae", margin: "0 8px" }}>·</span>
        <a href="/terms" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          이용약관
        </a>
        <span style={{ color: "#c4bcae", margin: "0 8px" }}>·</span>
        <a href="/refund" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          환불정책
        </a>
      </div>
    </div>
  );
}
