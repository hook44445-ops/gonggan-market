// 토스 PG 심사용 공개 법적고지 페이지 (로그인 없이 접근 가능).
// 라우터 미사용 SPA 이므로 App.jsx 에서 window.location.pathname === "/privacy" | "/terms"
// 일 때 이 화면을 렌더한다. 외부 링크가 아닌 앱 내부 라우트(/privacy, /terms)로 동작한다.

const BIZ = {
  상호: "공간사이",
  대표자: "김태웅",
  사업자등록번호: "270-53-00885",
  주소: "경기도 성남시 중원구 성남대로1151번길 5, 2층 202호",
  고객센터: "010-2740-6030",
  이메일: "gongganmarket.biz@gmail.com",
};

const PRIVACY = {
  title: "공간마켓 개인정보처리방침",
  intro:
    '공간사이(이하 "회사")는 개인정보보호법 등 관련 법령을 준수하며 이용자의 개인정보를 안전하게 보호하기 위해 최선을 다합니다.',
  sections: [
    {
      h: "1. 수집하는 개인정보 항목",
      lead: "회사는 다음과 같은 개인정보를 수집할 수 있습니다.",
      items: [
        "이름",
        "휴대전화번호",
        "이메일 주소",
        "위치정보(사용자 동의 시)",
        "서비스 이용기록",
        "접속 로그",
        "기기 정보",
      ],
    },
    {
      h: "2. 개인정보 수집 목적",
      lead: "수집한 개인정보는 다음 목적을 위해 사용됩니다.",
      items: [
        "회원가입 및 본인확인",
        "견적 요청 및 업체 매칭",
        "계약 및 에스크로 서비스 제공",
        "고객 상담 및 민원 처리",
        "서비스 개선 및 운영",
        "법령상 의무 이행",
      ],
    },
    {
      h: "3. 개인정보 보관 기간",
      body:
        "회사는 수집 목적 달성 시까지 개인정보를 보관합니다.\n단, 관계 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.",
    },
    {
      h: "4. 개인정보 제3자 제공",
      body:
        "회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.\n단, 법령에 의한 경우는 예외로 합니다.",
    },
    {
      h: "5. 개인정보 처리 위탁",
      lead: "회사는 서비스 제공을 위해 일부 업무를 외부 업체에 위탁할 수 있습니다.",
      items: [
        "Supabase (데이터 저장)",
        "Toss Payments (결제 처리)",
        "Google Firebase (알림 서비스)",
      ],
    },
    {
      h: "6. 이용자의 권리",
      lead: "이용자는 언제든지 다음 권리를 행사할 수 있습니다.",
      items: ["개인정보 열람", "개인정보 수정", "개인정보 삭제", "회원 탈퇴"],
    },
    {
      h: "7. 개인정보 보호책임자",
      body: [
        `상호 : ${BIZ.상호}`,
        `대표자 : ${BIZ.대표자}`,
        `사업자등록번호 : ${BIZ.사업자등록번호}`,
        `이메일 : ${BIZ.이메일}`,
        `전화번호 : ${BIZ.고객센터}`,
      ].join("\n"),
    },
    {
      h: "8. 회원탈퇴 및 개인정보 삭제",
      body:
        "회원은 언제든지 앱 내 [마이페이지 → 설정 → 회원탈퇴] 또는 계정 삭제 페이지(https://gongganmarket.com/delete-account)에서 회원탈퇴를 요청할 수 있습니다.\n" +
        "회원탈퇴 시 이름·휴대전화번호 등 개인정보는 지체 없이 삭제(또는 익명화)되며, 관계 법령에 따라 보관이 필요한 정보(거래·정산 기록 등)는 해당 보관 기간 동안 보관 후 파기됩니다.\n" +
        "단, 진행 중인 거래(프로젝트)가 있는 경우 거래 완료 또는 취소 후 탈퇴가 가능합니다.",
    },
    { h: "9. 시행일", body: "2026년 6월 10일" },
  ],
};

const TERMS = {
  title: "공간마켓 이용약관",
  intro: "",
  sections: [
    {
      h: "제1조 목적",
      body:
        '본 약관은 공간사이(이하 "회사")가 제공하는 공간마켓 서비스 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.',
    },
    {
      h: "제2조 회원가입",
      body:
        "회원은 본 약관에 동의한 후 회원가입을 완료함으로써 서비스를 이용할 수 있습니다.",
    },
    {
      h: "제3조 서비스 내용",
      lead: "회사는 다음 서비스를 제공합니다.",
      items: [
        "공간 시공 견적 요청",
        "업체 입찰",
        "상담 및 계약",
        "에스크로 결제",
        "후기 및 평점 서비스",
      ],
    },
    {
      h: "제4조 회원의 의무",
      lead: "회원은 다음 행위를 해서는 안 됩니다.",
      items: ["허위 정보 등록", "타인 정보 도용", "서비스 운영 방해", "불법 행위"],
    },
    {
      h: "제5조 결제 및 환불",
      body:
        "결제는 회사가 제공하는 결제수단을 통해 진행됩니다.\n환불은 관련 법령 및 회사 정책에 따라 처리됩니다.",
    },
    {
      h: "제6조 서비스 제한",
      lead: "회사는 다음 경우 서비스 이용을 제한할 수 있습니다.",
      items: ["약관 위반", "불법 행위", "타 이용자 피해 발생"],
    },
    {
      h: "제7조 면책조항",
      body:
        "회사는 천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.",
    },
    {
      h: "제8조 분쟁 해결",
      body: "회사와 이용자 간 분쟁은 대한민국 법률에 따라 해결합니다.",
    },
    {
      h: "제9조 사업자 정보",
      body: [
        `상호 : ${BIZ.상호}`,
        `대표자 : ${BIZ.대표자}`,
        `사업자등록번호 : ${BIZ.사업자등록번호}`,
        `주소 : ${BIZ.주소}`,
        `고객센터 : ${BIZ.고객센터}`,
        `이메일 : ${BIZ.이메일}`,
      ].join("\n"),
    },
    { h: "제10조 시행일", body: "2026년 6월 10일" },
  ],
};

function goHome() {
  // 라우터 미사용 — 홈으로 이동 시 전체 새로고침으로 안전하게 루트 진입.
  window.location.href = "/";
}

export default function LegalScreen({ type }) {
  const doc = type === "terms" ? TERMS : PRIVACY;
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
