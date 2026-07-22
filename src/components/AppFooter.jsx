// 사업자 정보 푸터 (토스 PG 승인용) — LandingScreen 하단 정보 영역에 배치.
// 작은 서브텍스트 · 회색 톤 · 비강조. 기존 공간마켓 스타일(차분한 베이지/그레이)에 맞춘다.
export const BIZ_ROWS = [
  ["상호", "공간사이"],
  ["대표자", "김태웅"],
  ["사업자등록번호", "270-53-00885"],
  ["통신판매업신고번호", "신고 준비 중"],
  ["주소", "경기도 성남시 성남대로1151번길 5, 2층 202호"],
  ["고객센터", "010-2740-6030"],
  ["이메일", "gongganmarket.biz@gmail.com"],
];

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
      {/* 법적고지 링크 — 토스 PG 심사용. 앱 내부 라우트(/privacy, /terms). */}
      <div style={{ marginTop: 10, fontSize: 11, color: "#7A7670" }}>
        <a href="/privacy" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          개인정보처리방침
        </a>
        <span style={{ color: "#c4bcae", margin: "0 8px" }}>·</span>
        <a href="/terms" style={{ color: "#8a8275", textDecoration: "underline", fontWeight: 600 }}>
          이용약관
        </a>
      </div>
    </div>
  );
}
