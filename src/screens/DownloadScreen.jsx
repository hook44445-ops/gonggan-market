// 공간랜드 다운로드 안내 페이지 (/download)
// 인스타 프로필 링크 등 인앱 브라우저에서 Play Store 이동이 막히는 문제를 위한
// 모바일 우선 랜딩. 라우터 미사용 SPA — App.jsx 에서
// window.location.pathname === "/download" 일 때 이 화면을 렌더한다.

import { useState } from "react";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { submitTesterSignup } from "../lib/supabase";
import { pendingRefCode } from "../lib/referral";
import { SHOW_BETA_UI } from "../constants/release";
import { downloadPlan } from "../lib/appInstall";
import { detectPlatform } from "../lib/storeRating";
import { pageSeo } from "../utils/siteSeo";
import RichText from "../components/RichText";
import { DOWNLOAD_INTRO, DOWNLOAD_STEPS, downloadTrust } from "../content/publicPages";   // 봇 프리렌더도 같은 글(10-02)

// 버튼은 폰 종류·스토어 상태로 고른다(lib/appInstall downloadPlan) — 아이폰은 App Store(번호가 있을 때),
//   안드로이드는 비공개 테스트 참여(정식 출시 뒤엔 Play 스토어), 컴퓨터는 둘 다.
const APP_STORE_ID = import.meta.env.VITE_APP_STORE_ID ?? "";
const PLAY_PUBLIC = import.meta.env.VITE_PLAY_PUBLIC === "1";

const C = {
  green: "#2E5F4B", greenDark: "#1D3D2F", beige: "#F5F1EA", bg: "#f3f0ea",
  surface: "#ffffff", text1: "#3a352c", text2: "#5a5346", text3: "#7a7464",
  line: "#e4ddd0", accent: "#B5D4C5",
};

// 테스터 신청 — 비공개 테스트가 이메일 목록 방식이면 대표가 Play Console 에 메일을 넣어야 참여가 열린다(147).
// 보내면 대표 휴대폰(공간랜드 앱)으로 푸시가 가고, 대표는 /testers 에서 목록을 본다.
function TesterSignupForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState({ busy: false, done: null, error: null });

  const submit = async (ev) => {
    ev.preventDefault();
    if (state.busy) return;
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setState({ busy: false, done: null, error: "메일 주소를 확인해 주세요" }); return; }
    setState({ busy: true, done: null, error: null });
    const { data, error } = await submitTesterSignup({ email: v, name: name.trim() || null, ref: pendingRefCode() });
    if (error || !data?.ok) {
      setState({ busy: false, done: null,
        error: data?.reason === "BAD_EMAIL" ? "메일 주소를 확인해 주세요"
          : data?.reason === "TOO_MANY" ? "신청이 몰리고 있어요 — 잠시 뒤 다시 보내 주세요"
          : "보내지 못했어요 — 잠시 뒤 다시 시도해 주세요" });
      return;
    }
    setState({ busy: false, done: data.already ? "already" : "new", error: null });
  };

  const input = {
    width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 12,
    padding: "13px 14px", fontSize: 15, color: C.text1, background: C.surface, outline: "none", marginTop: 8,
  };

  return (
    <div style={{ marginTop: 14, background: C.surface, borderRadius: 14, padding: "16px", border: `1.5px solid ${C.green}`, textAlign: "left" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>참여가 안 되나요? 구글 메일을 남겨 주세요</div>
      <p style={{ fontSize: 12.5, lineHeight: 1.7, color: C.text2, margin: "6px 0 0" }}>
        Play 스토어에 로그인된 구글(Gmail) 주소를 남기면 테스터로 등록해 드려요.
        등록되면 위 「Google Play 테스트 참여하기」를 다시 눌러 주세요.
      </p>
      {state.done ? (
        <div role="status" style={{ marginTop: 12, background: C.beige, borderRadius: 12, padding: "12px 14px", fontSize: 13.5, fontWeight: 700, color: C.green, lineHeight: 1.6 }}>
          {state.done === "already" ? "이미 받은 메일이에요. 등록되는 대로 참여할 수 있어요." : "받았어요! 등록되면 테스트에 참여할 수 있어요. 고맙습니다 🙏"}
        </div>
      ) : (
        <form onSubmit={submit}>
          <input type="email" inputMode="email" autoComplete="email" required placeholder="예: hong@gmail.com"
            aria-label="구글 메일 주소" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} style={input} />
          <input placeholder="이름 또는 별명 (선택)" aria-label="이름 또는 별명" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={20} style={input} />
          {state.error && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#C0392B" }}>{state.error}</div>}
          <button type="submit" disabled={state.busy}
            style={{ marginTop: 10, width: "100%", padding: "14px", borderRadius: 12, border: "none", background: C.green, color: "#fff",
              fontSize: 15, fontWeight: 800, cursor: state.busy ? "default" : "pointer", opacity: state.busy ? 0.7 : 1 }}>
            {state.busy ? "보내는 중…" : "테스터 신청 보내기"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function DownloadScreen() {
  const plan = downloadPlan({
    platform: typeof navigator !== "undefined" ? detectPlatform(navigator.userAgent, document.referrer) : null,
    appStoreId: APP_STORE_ID, playPublic: PLAY_PUBLIC,
  });
  useDocumentMeta({
    title: pageSeo(SHOW_BETA_UI)["/download"].title,
    description: pageSeo(SHOW_BETA_UI)["/download"].description,
    path: "/download",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${C.green} 0%, ${C.green} 200px, ${C.bg} 200px, ${C.bg} 100%)`,
        fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
        color: C.text1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 20px 48px",
      }}
    >
      {/* 브랜드 헤더 */}
      <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
          공간랜드
        </div>
      </div>

      {/* 메인 카드 */}
      <div
        style={{
          width: "100%", maxWidth: 420, background: C.surface, borderRadius: 24,
          boxShadow: "0 12px 36px rgba(29,61,47,0.18)", padding: "30px 24px 28px",
          textAlign: "center", marginTop: 4,
        }}
      >
        {plan.showTester && (
        <div
          style={{
            display: "inline-block", background: C.beige, color: C.green,
            fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "6px 14px",
            marginBottom: 16, letterSpacing: "-0.2px",
          }}
        >
          비공개 사전체험판
        </div>
        )}

        <h1 style={{ fontSize: 21, fontWeight: 800, color: C.text1, margin: "0 0 14px", lineHeight: 1.4, letterSpacing: "-0.4px" }}>
          {plan.showTester ? "공간랜드 시작하기" : "공간랜드 앱 받기"}
        </h1>

        {plan.showTester ? (
          /* 웹 먼저 — 앱은 아직 비공개 테스트라 3단계·구글 계정 등록이 필요하다.
             공유 카드·QR 로 들어온 사람에게 그 문턱을 먼저 들이밀면 대부분 빠져나간다.
             Play 참여 경로는 지우지 않고 아래로 내린다. */
          <p style={{ fontSize: 14, lineHeight: 1.85, color: C.text2, margin: "0 0 20px" }}>
            <RichText segs={DOWNLOAD_INTRO} strongStyle={{ color: C.text1 }} />
          </p>
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.85, color: C.text2, margin: "0 0 26px" }}>
            {plan.buttons.length
              ? "견적 도착·대화·계약 알림을 앱으로 바로 받아 보세요."
              : "아이폰 앱은 곧 App Store에 올라와요. 그동안 웹에서 똑같이 이용할 수 있어요."}
          </p>
        )}

        {/* 사전체험판일 때는 웹이 첫 버튼(꽉 찬 초록), 앱은 아래 테두리 버튼 */}
        {plan.showTester && (
          <>
            <a href="/" style={{
              display: "block", width: "100%", boxSizing: "border-box",
              background: C.green, color: "#fff", textDecoration: "none",
              fontSize: 16, fontWeight: 800, padding: "16px 18px", borderRadius: 14,
              boxShadow: "0 6px 16px rgba(46,95,75,0.3)", letterSpacing: "-0.3px",
            }}>
              웹에서 바로 시작하기
            </a>
            <p style={{ fontSize: 12.5, lineHeight: 1.75, color: C.text2, margin: "12px 0 0" }}>
              견적 요청은 로그인 후 이용할 수 있어요.
            </p>

            <div style={{ height: 1, background: C.line, margin: "22px 0 18px" }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text2, marginBottom: 12 }}>
              앱으로 받고 싶다면
            </div>
          </>
        )}

        {plan.buttons.map((b, i) => (
          <a key={b.url} href={b.url} target="_blank" rel="noopener noreferrer"
            style={{
              display: "block", width: "100%", boxSizing: "border-box", marginTop: i ? 10 : 0,
              textDecoration: "none", fontSize: 16, fontWeight: 800,
              padding: "16px 18px", borderRadius: 14, letterSpacing: "-0.3px",
              ...(plan.showTester
                ? { border: `1px solid ${C.green}`, color: C.green, background: C.surface }
                : { background: C.green, color: "#fff", boxShadow: "0 6px 16px rgba(46,95,75,0.3)" }),
            }}>
            {b.label}
          </a>
        ))}

        {plan.showTester && (
          <p style={{ fontSize: 12.5, lineHeight: 1.85, color: C.text3, margin: "12px 0 0", textAlign: "left" }}>
            <RichText segs={DOWNLOAD_STEPS.join("\n")} />
          </p>
        )}

        {/* 정식 출시 뒤에는 앱이 첫 버튼이고 웹이 아래 */}
        {!plan.showTester && (
          <>
            <a href="/" style={{
              display: "block", marginTop: 12, padding: "15px 18px", borderRadius: 14,
              border: `1px solid ${C.green}`, color: C.green, background: C.surface,
              textDecoration: "none", fontSize: 15, fontWeight: 800,
            }}>
              설치 없이 웹에서 시작하기
            </a>
            <p style={{ fontSize: 12.5, lineHeight: 1.75, color: C.text2, margin: "12px 0 0" }}>
              {plan.iosWaiting ? <>아이폰 앱은 준비 중이에요. 그동안 웹에서 이용해 주세요.<br /></> : null}
              견적 요청은 로그인 후 이용할 수 있어요.
            </p>
          </>
        )}

        {plan.showTester && (
          <>
            {/* 처음 참여 안내 — 테스터 참여 선완료 필요 */}
            <div
              style={{
                marginTop: 14, background: C.beige, borderRadius: 14, padding: "14px 16px",
                border: `1px solid ${C.line}`, textAlign: "left",
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.green, marginBottom: 6 }}>
                💡 처음 참여하는 경우
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.75, color: C.text2, margin: 0 }}>
                테스트 대상으로 등록된 Google 계정으로 먼저 <b>‘테스터 참여’</b>를 완료해 주세요.<br />
                참여할 수 없다는 안내가 나오면 아래에 구글 메일을 남겨 주세요.
              </p>
            </div>

            <TesterSignupForm />
          </>
        )}

        {/* 인앱 브라우저 안내 */}
        <div
          style={{
            marginTop: 22, background: C.bg, borderRadius: 14, padding: "14px 16px",
            border: `1px solid ${C.line}`, textAlign: "left",
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.green, marginBottom: 6 }}>
            ℹ️ 버튼이 열리지 않나요?
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.75, color: C.text2, margin: 0 }}>
            인스타 앱에서 열리지 않을 경우, 오른쪽 위 메뉴에서 <b>“외부 브라우저로 열기”</b>를 선택해주세요.
          </p>
        </div>
      </div>

      {/* 신뢰 문구 */}
      <p style={{ fontSize: 12, lineHeight: 1.7, color: C.text3, margin: "22px 0 0", textAlign: "center", maxWidth: 420 }}>
        <RichText segs={downloadTrust(SHOW_BETA_UI).join("\n")} />
      </p>
    </div>
  );
}
