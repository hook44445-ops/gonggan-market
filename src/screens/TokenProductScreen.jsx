// 토스 PG 심사용 공개 상품 페이지 (로그인 없이 접근 가능).
// 라우터 미사용 SPA — App.jsx 에서 window.location.pathname === "/tokens" 일 때 렌더.
// 실제 판매 상품(공간토큰)의 설명·가격·단건 최고가·서비스 제공기간·환불정책을
// 비회원도 확인할 수 있도록 노출한다(구매 자체는 앱 로그인 후 진행).

import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { TOKEN_PACKAGES, TOKEN_COSTS } from "../constants/lounge";
import AppFooter from "../components/AppFooter";

function goHome() {
  window.location.href = "/";
}

const maxPrice = Math.max(...TOKEN_PACKAGES.map((p) => p.price));

export default function TokenProductScreen() {
  useDocumentMeta({
    title: "공간토큰 구매 — 공간마켓",
    description:
      "공간라운지에서 사용하는 공간토큰 상품 안내입니다. 패키지별 가격, 서비스 제공기간, 환불 정책을 확인할 수 있습니다.",
    path: "/tokens",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f0ea",
        fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
        color: "#3a352c",
      }}
    >
      {/* 상단 바 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "#2E5F4B",
          color: "#fff",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          zIndex: 10,
        }}
      >
        <button
          onClick={goHome}
          aria-label="홈으로"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            width: 34,
            height: 34,
            fontSize: 18,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px" }}>
          공간토큰 구매
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 20px 40px" }}>
        {/* 상품 개요 */}
        <section style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#2E5F4B", margin: "0 0 10px" }}>
            공간토큰 (공간라운지 이용권)
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: "#4a443a", margin: 0 }}>
            공간토큰은 공간마켓의 커뮤니티 서비스 <strong>공간라운지</strong>에서 사용하는
            디지털 이용권입니다. 다른 이용자에게 <strong>대화 신청</strong>을 보내거나,
            내가 쓴 글을 <strong>상단에 노출</strong>하고, 전문가 답변을 <strong>강조</strong>하는 등
            라운지 내 활동에 사용합니다. 결제 완료 즉시 계정에 지급되는 <strong>디지털 상품</strong>입니다.
          </p>
        </section>

        {/* 서비스 제공기간 — 토스 심사 필수 표기 */}
        <section
          style={{
            marginBottom: 26,
            background: "#fff",
            border: "1px solid #e6ded0",
            borderRadius: 14,
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2E5F4B", marginBottom: 6 }}>
            서비스 제공기간
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#4a443a" }}>
            결제 완료 <strong>즉시</strong> 토큰이 계정에 지급됩니다(디지털 상품, 별도 배송 없음).
            지급된 토큰은 유효기간 없이 라운지 서비스 이용 시 차감됩니다.
          </div>
        </section>

        {/* 가격표 */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 12px" }}>
            패키지 및 가격
          </h2>
          <div style={{ background: "#fff", border: "1px solid #e6ded0", borderRadius: 14, overflow: "hidden" }}>
            {TOKEN_PACKAGES.map((pkg, i) => {
              const total = pkg.tokens + (pkg.bonus ?? 0);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "13px 18px",
                    borderBottom: i < TOKEN_PACKAGES.length - 1 ? "1px solid #f0ebe1" : "none",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#3a352c" }}>
                    공간토큰 {total.toLocaleString()}개
                    {pkg.badge && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: "#B8860B" }}>
                        {pkg.badge}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#2E5F4B" }}>
                    {pkg.price.toLocaleString()}원
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12.5, color: "#6b6456", marginTop: 10, lineHeight: 1.7 }}>
            단건 결제 기준 상품 금액 최고가 : <strong>{maxPrice.toLocaleString()}원</strong>
            <br />
            결제수단 : 신용·체크카드, 계좌이체, 가상계좌
          </div>
        </section>

        {/* 사용처 */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 10px" }}>
            토큰 사용처
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {[
              `라운지 대화 신청 — ${TOKEN_COSTS.CHAT_REQUEST}토큰`,
              `글 상단 노출 — ${TOKEN_COSTS.POST_BOOST_MIN}~${TOKEN_COSTS.POST_BOOST_MAX}토큰`,
              `전문가 답변 강조 — ${TOKEN_COSTS.EXPERT_HIGHLIGHT_MIN}~${TOKEN_COSTS.EXPERT_HIGHLIGHT_MAX}토큰`,
            ].map((t, i) => (
              <li key={i} style={{ fontSize: 13.5, lineHeight: 1.9, color: "#4a443a" }}>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* 환불 정책 링크 */}
        <section
          style={{
            marginBottom: 26,
            background: "#fff",
            border: "1px solid #e6ded0",
            borderRadius: 14,
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2E5F4B", marginBottom: 6 }}>
            환불 정책
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "#4a443a" }}>
            미사용 토큰은 결제일로부터 <strong>7일 이내 청약철회(전액 환불)</strong>가 가능하며,
            일부라도 사용한 경우 환불이 제한됩니다.
          </div>
          <a
            href="/refund"
            style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "#2E5F4B", textDecoration: "underline" }}
          >
            환불 정책 자세히 보기 →
          </a>
        </section>

        {/* 구매 CTA */}
        <button
          onClick={goHome}
          style={{
            width: "100%",
            background: "#2E5F4B",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "15px",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          앱에서 공간토큰 구매하기
        </button>
        <div style={{ fontSize: 12, color: "#8a8275", textAlign: "center", marginTop: 8 }}>
          구매는 공간마켓 로그인(휴대폰 본인확인) 후 진행됩니다.
        </div>

        {/* 사업자 정보 + 법적고지(약관·개인정보·환불) */}
        <div style={{ marginTop: 34, paddingTop: 22, borderTop: "1px solid #ddd6ca" }}>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}
