import { PAYMENTS_LIVE } from "../constants/release";
// 토스 PG 심사용 공개 상품 페이지 (로그인 없이 접근 가능) — 공간랜드 본류.
// 라우터 미사용 SPA — App.jsx 에서 window.location.pathname === "/safe-payment" 일 때 렌더.
// 공간안전결제(에스크로) 상품/서비스의 설명·결제 구조·단계별 지급·서비스 제공기간·
// 단건 최고가·통신판매중개자 고지·환불정책을 비회원도 확인할 수 있도록 노출한다.
// (실제 계약·결제는 앱 로그인 후 견적→선택→결제 흐름에서 진행)

import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { pageSeo } from "../utils/siteSeo";
import RichText from "../components/RichText";
import {
  SAFE_PAYMENT_NOT_LIVE, safePaymentH1, SAFE_PAYMENT_INTRO, SAFE_PAYMENT_STAGES, SAFE_PAYMENT_AMOUNT_PLANS,
  SAFE_PAYMENT_GUARANTEE_NOTE, SAFE_PAYMENT_PERIOD, SAFE_PAYMENT_PRICE_LINES, SAFE_PAYMENT_BROKER, SAFE_PAYMENT_REFUND, SAFE_PAYMENT_CTA_NOTE,
  SAFE_PAYMENT_AFTER_CONFIRM_TITLE, SAFE_PAYMENT_AFTER_CONFIRM, SAFE_PAYMENT_AFTER_CONFIRM_NOTE,
} from "../content/publicPages";
import AppFooter from "../components/AppFooter";

function goHome() {
  window.location.href = "/";
}

// 글은 content/publicPages.js 한 곳 — 봇 프리렌더(api/prerender.js)도 같은 데이터(10-02 · 네이버에 빈 페이지였다).
const STAGES = SAFE_PAYMENT_STAGES;
const AMOUNT_PLANS = SAFE_PAYMENT_AMOUNT_PLANS;

export default function SafePaymentScreen() {
  // 결제가 열리기 전에는 제목·설명 맨 앞에 «정식 오픈 후 제공 예정»(siteSeo pageSeo — 10-02)
  const meta = pageSeo(!PAYMENTS_LIVE)["/safe-payment"];
  useDocumentMeta({ title: meta.title, description: meta.description, path: "/safe-payment" });

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
          공간안전결제 안내
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 20px 40px" }}>
        {/* 지금 상태 — 결제가 아직 열리지 않았으면 먼저 말한다(없는 기능을 약속하지 않기) */}
        {!PAYMENTS_LIVE && (
          <div style={{ background: "#FBF7EC", border: "1px solid #EADFC4", borderRadius: 12, padding: "12px 14px", marginBottom: 20, fontSize: 13, lineHeight: 1.75, color: "#6F5A1E" }}>
            <RichText segs={SAFE_PAYMENT_NOT_LIVE} />
          </div>
        )}

        {/* 상품 개요 */}
        <section style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#2E5F4B", margin: "0 0 10px" }}>
            {safePaymentH1(PAYMENTS_LIVE)}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: "#4a443a", margin: 0 }}>
            <RichText segs={SAFE_PAYMENT_INTRO} />
          </p>
        </section>

        {/* 단계별 안전지급 구조 */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 12px" }}>
            단계별 안전지급 구조
          </h2>
          <div style={{ background: "#fff", border: "1px solid #e6ded0", borderRadius: 14, overflow: "hidden" }}>
            {STAGES.map(([name, desc, pct], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "13px 16px",
                  borderBottom: i < STAGES.length - 1 ? "1px solid #f0ebe1" : "none",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    minWidth: 46,
                    textAlign: "center",
                    background: "#EAF2ED",
                    color: "#2E5F4B",
                    borderRadius: 8,
                    padding: "4px 6px",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {pct}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#3a352c" }}>
                    {i + 1}. {name}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#6b6456", lineHeight: 1.6, marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 단계를 확인한 뒤에도 불만이 있으면 — 이의 신청 · A/S · 기록 · 단열재 예시(대표 10-08) */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 12px" }}>
            {SAFE_PAYMENT_AFTER_CONFIRM_TITLE}
          </h2>
          <div style={{ background: "#fff", border: "1px solid #e6ded0", borderRadius: 14, overflow: "hidden" }}>
            {SAFE_PAYMENT_AFTER_CONFIRM.map(([name, desc], i) => (
              <div key={name} style={{ padding: "13px 16px", borderBottom: i < SAFE_PAYMENT_AFTER_CONFIRM.length - 1 ? "1px solid #f0ebe1" : "none" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#3a352c" }}>{name}</div>
                <div style={{ fontSize: 12.5, color: "#6b6456", lineHeight: 1.65, marginTop: 3 }}>{desc}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#8a8272", lineHeight: 1.6, margin: "10px 2px 0" }}>{SAFE_PAYMENT_AFTER_CONFIRM_NOTE}</p>
        </section>

        {/* 금액별 지급 구조 — 금액이 클수록 업체 조건이 단단해진다(대표 09-25 「진입은 쉽게, 갈수록 단단하게」) */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 12px" }}>
            공사 금액별 지급 구조
          </h2>
          <div style={{ background: "#fff", border: "1px solid #e6ded0", borderRadius: 14, overflow: "hidden" }}>
            {AMOUNT_PLANS.map(([band, plan, who], i) => (
              <div key={band} style={{ padding: "13px 16px", borderBottom: i < AMOUNT_PLANS.length - 1 ? "1px solid #f0ebe1" : "none" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#3a352c" }}>{band}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2E5F4B", marginTop: 3 }}>{plan}</div>
                <div style={{ fontSize: 12.5, color: "#6b6456", lineHeight: 1.6, marginTop: 2 }}>{who}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "#6b6456", lineHeight: 1.7, margin: "10px 2px 0" }}>
            {SAFE_PAYMENT_GUARANTEE_NOTE}
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
            <RichText segs={SAFE_PAYMENT_PERIOD} />
          </div>
        </section>

        {/* 결제 금액 / 수단 */}
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
            결제 금액 및 수단
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.85, color: "#4a443a" }}>
            {SAFE_PAYMENT_PRICE_LINES.map((line, i) => <span key={i}>{i > 0 && <br />}<RichText segs={line} /></span>)}
          </div>
        </section>

        {/* 통신판매중개자 고지 */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 10px" }}>
            통신판매중개자 고지
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#6b6456", margin: 0 }}>
            {SAFE_PAYMENT_BROKER}
          </p>
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
            {SAFE_PAYMENT_REFUND}
          </div>
          <a
            href="/refund"
            style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "#2E5F4B", textDecoration: "underline" }}
          >
            환불 정책 자세히 보기 →
          </a>
        </section>

        {/* CTA */}
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
          공간랜드에서 견적 요청하기
        </button>
        <div style={{ fontSize: 12, color: "#8a8275", textAlign: "center", marginTop: 8 }}>
          {SAFE_PAYMENT_CTA_NOTE}
        </div>

        {/* 사업자 정보 + 법적고지 */}
        <div style={{ marginTop: 34, paddingTop: 22, borderTop: "1px solid #ddd6ca" }}>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}
