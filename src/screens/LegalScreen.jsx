// 토스 PG 심사용 공개 법적고지 페이지 (로그인 없이 접근 가능).
// 라우터 미사용 SPA 이므로 App.jsx 에서 window.location.pathname === "/privacy" | "/terms"
// 일 때 이 화면을 렌더한다. 외부 링크가 아닌 앱 내부 라우트(/privacy, /terms)로 동작한다.

import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { pageSeo } from "../utils/siteSeo";
import { SHOW_BETA_UI } from "../constants/release";
import { PRIVACY, TERMS, REFUND } from "../content/publicPages";

// 글(개인정보처리방침 · 이용약관 · 환불 정책)은 content/publicPages.js 한 곳 — 봇 프리렌더(api/prerender.js)도 같은 데이터를 읽는다(10-02).
//   제목·설명은 utils/siteSeo.js pageSeo — 예전엔 제목이 «공간랜드 공간랜드 …»으로 두 번 붙었다.

function goHome() {
  // 라우터 미사용 — 홈으로 이동 시 전체 새로고침으로 안전하게 루트 진입.
  window.location.href = "/";
}

export default function LegalScreen({ type }) {
  const doc = type === "terms" ? TERMS : type === "refund" ? REFUND : PRIVACY;
  const isTerms = type === "terms";
  const isRefund = type === "refund";
  const path = isRefund ? "/refund" : isTerms ? "/terms" : "/privacy";
  const meta = pageSeo(SHOW_BETA_UI)[path];
  useDocumentMeta({ title: meta.title, description: meta.description, path });
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
          {doc.title}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 20px 60px" }}>
        {doc.intro && (
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.85,
              color: "#5a5346",
              margin: "0 0 24px",
            }}
          >
            {doc.intro}
          </p>
        )}

        {doc.sections.map((sec, i) => (
          <section key={i} style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#2E5F4B",
                margin: "0 0 8px",
              }}
            >
              {sec.h}
            </h2>
            {sec.lead && (
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.8,
                  color: "#5a5346",
                  margin: "0 0 8px",
                }}
              >
                {sec.lead}
              </p>
            )}
            {sec.items && (
              <ul style={{ margin: "0 0 4px", paddingLeft: 18 }}>
                {sec.items.map((it, j) => (
                  <li
                    key={j}
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.9,
                      color: "#4a443a",
                    }}
                  >
                    {it}
                  </li>
                ))}
              </ul>
            )}
            {sec.body && (
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.85,
                  color: "#4a443a",
                  margin: 0,
                  whiteSpace: "pre-line",
                }}
              >
                {sec.body}
              </p>
            )}
          </section>
        ))}

        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px solid #ddd6ca",
            textAlign: "center",
          }}
        >
          <button
            onClick={goHome}
            style={{
              background: "#2E5F4B",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "13px 32px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
