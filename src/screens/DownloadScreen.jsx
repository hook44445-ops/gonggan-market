// 공간마켓 다운로드 안내 페이지 (/download)
// 인스타 프로필 링크 등 인앱 브라우저에서 Play Store 이동이 막히는 문제를 위한
// 모바일 우선 랜딩. 라우터 미사용 SPA — App.jsx 에서
// window.location.pathname === "/download" 일 때 이 화면을 렌더한다.

// 비공개 테스트 참여(Opt-in) 페이지 — 테스터 참여 완료 후에만 다운로드 버튼이 노출된다.
const PLAY_URL =
  "https://play.google.com/apps/testing/com.gonggansai.gongganmarket";

const C = {
  green: "#2E5F4B", greenDark: "#1D3D2F", beige: "#F5F1EA", bg: "#f3f0ea",
  surface: "#ffffff", text1: "#3a352c", text2: "#5a5346", text3: "#7a7464",
  line: "#e4ddd0", accent: "#B5D4C5",
};

export default function DownloadScreen() {
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
          공간마켓
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
        <div
          style={{
            display: "inline-block", background: C.beige, color: C.green,
            fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "6px 14px",
            marginBottom: 16, letterSpacing: "-0.2px",
          }}
        >
          비공개 사전체험판
        </div>

        <h1 style={{ fontSize: 21, fontWeight: 800, color: C.text1, margin: "0 0 14px", lineHeight: 1.4, letterSpacing: "-0.4px" }}>
          공간마켓 비공개 사전체험판
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.85, color: C.text2, margin: "0 0 26px" }}>
          현재 공간마켓은 비공개 사전체험판으로 운영 중입니다.<br />
          아래 버튼을 누르면 Google Play 비공개 테스트 참여 페이지로 이동합니다.<br /><br />
          ① ‘테스터 참여’ 버튼을 눌러 테스트에 참여합니다.<br />
          ② 참여가 완료되면 ‘Google Play에서 다운로드’ 버튼이 나타납니다.<br />
          ③ 공간마켓 앱을 설치하여 이용해주세요.
        </p>

        <a
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", width: "100%", boxSizing: "border-box",
            background: C.green, color: "#fff", textDecoration: "none",
            fontSize: 16, fontWeight: 800, padding: "16px 18px", borderRadius: 14,
            boxShadow: "0 6px 16px rgba(46,95,75,0.3)", letterSpacing: "-0.3px",
          }}
        >
          공간마켓 앱 동의하고 다운로드하기
        </a>

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
            Google Play에서 먼저 <b>‘테스터 참여’</b>를 완료해야 다운로드가 가능합니다.
          </p>
        </div>

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
        공간마켓은 검증된 업체와 단계별 에스크로로<br />믿을 수 있는 인테리어 거래를 돕습니다.
      </p>
    </div>
  );
}
