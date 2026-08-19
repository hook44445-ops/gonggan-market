// 토스 PG 심사용 공개 상품 페이지 (로그인 없이 접근 가능) — 공간마켓 본류.
// 라우터 미사용 SPA — App.jsx 에서 window.location.pathname === "/safe-payment" 일 때 렌더.
// 공간안전결제(에스크로) 상품/서비스의 설명·결제 구조·단계별 지급·서비스 제공기간·
// 단건 최고가·통신판매중개자 고지·환불정책을 비회원도 확인할 수 있도록 노출한다.
// (실제 계약·결제는 앱 로그인 후 견적→선택→결제 흐름에서 진행)

import { useDocumentMeta } from "../hooks/useDocumentMeta";
import AppFooter from "../components/AppFooter";

function goHome() {
  window.location.href = "/";
}

// 단계별 안전지급 비율 — EscrowScreen STAGE_META 와 동일.
const STAGES = [
  ["전액 예치", "결제 시 시공대금 전액을 공간마켓이 안전하게 보관", "결제"],
  ["자재비 선지급", "계약 완료 즉시 업체에 자재비 지급", "10%"],
  ["착공 확인", "착공 사진을 고객이 확인·승인하면 지급", "20%"],
  ["중간 점검", "중간 점검 사진을 고객이 확인·승인하면 지급", "40%"],
  ["완료 확인", "완료 사진을 고객이 확인·승인하면 잔금 지급", "30%"],
];

export default function SafePaymentScreen() {
  useDocumentMeta({
    title: "공간안전결제 안내 — 공간마켓",
    description:
      "공간마켓 공간안전결제(에스크로) 상품 안내입니다. 시공 대금의 단계별 안전지급 구조, 서비스 제공기간, 환불 정책을 확인할 수 있습니다.",
    path: "/safe-payment",
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
          공간안전결제 안내
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 20px 40px" }}>
        {/* 상품 개요 */}
        <section style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#2E5F4B", margin: "0 0 10px" }}>
            공간안전결제 (시공대금 에스크로)
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: "#4a443a", margin: 0 }}>
            공간마켓은 인테리어·집수리 시공이 필요한 고객과 검증된 시공업체를 연결하는
            <strong> 통신판매중개 플랫폼</strong>입니다. 계약 시 고객이 시공대금을
            <strong> 공간안전결제(에스크로)</strong>로 예치하면, 공사 진행 단계마다 고객이
            사진을 확인·승인한 뒤 업체에 안전하게 지급됩니다. 업체에게 대금이 한 번에
            지급되지 않아 고객과 업체 모두를 보호합니다.
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
            시공(용역) 서비스로, 규모에 따라 <strong>통상 1개월, 최대 3개월</strong> 이내에
            공사가 완료됩니다. 각 계약의 예상 공사 기간은 견적·계약 화면에 명시되며, 완료
            확인 시점에 서비스 제공이 종료됩니다.
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
            결제 금액은 시공 견적에 따라 상이하며, 시공비에 공간안전결제 이용료가 더해집니다.
            상세 금액과 수수료는 결제 직전 화면에서 안내됩니다.
            <br />
            단건 결제 기준 상품 금액 최고가 : <strong>최대 100,000,000원(1억원)</strong>
            <br />
            결제수단 : 신용·체크카드, 계좌이체, 가상계좌 (고액 결제는 계좌이체·가상계좌 권장)
          </div>
        </section>

        {/* 통신판매중개자 고지 */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2E5F4B", margin: "0 0 10px" }}>
            통신판매중개자 고지
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#6b6456", margin: 0 }}>
            공간사이(공간마켓)는 통신판매중개자로서 시공 계약의 당사자가 아니며, 시공의 이행·
            품질·하자보수 등에 대한 책임은 해당 시공업체에 있습니다. 공간마켓은 안전한 대금
            보관·단계별 지급·거래 기록 보관 등 신뢰 인프라를 제공합니다.
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
            착공 전에는 예치금 전액 환불이 가능하며, 공사 진행 중에는 이미 지급이 완료된
            단계를 제외한 잔여 예치금에 대해 환불이 가능합니다. 분쟁 시 저장된 기록을 근거로
            검토합니다.
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
          공간마켓에서 견적 요청하기
        </button>
        <div style={{ fontSize: 12, color: "#8a8275", textAlign: "center", marginTop: 8 }}>
          견적·계약·결제는 공간마켓 로그인(휴대폰 본인확인) 후 진행됩니다.
        </div>

        {/* 사업자 정보 + 법적고지 */}
        <div style={{ marginTop: 34, paddingTop: 22, borderTop: "1px solid #ddd6ca" }}>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}
