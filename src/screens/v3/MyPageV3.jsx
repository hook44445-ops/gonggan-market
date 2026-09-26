// ─────────────────────────────────────────────────────
// 마이페이지 v3 — 재설계본 (관리자 토글: UI v2 ↔ v3)
//
// v2 의 문제
//  · MainApp 안에 1,223줄 인라인 · 높이 약 4,500px
//  · 같은 진입점이 3중 중복 (저장 업체 = 통계 타일 = 하단탭 '관심')
//  · 빈 섹션 4개가 큰 회색 박스로 연속 배치되어 화면을 잡아먹음
//  · 라운지 알림설정(카테고리 칩 19개)이 마이페이지 본문에 통째로 박힘
//
// v3 의 방향
//  · 상단 히어로로 첫인상을 잡고, 아래는 '행'으로 접어 밀도를 높인다
//  · 빈 상태는 회색 박스 대신 한 줄 '초대'(EmptyInvite)로 — 우울하지 않게
//  · 설정 상세는 하위 화면으로 넘기고 진입점만 남긴다
//  · 색은 C 토큰만 사용 → 고객(그린)/파트너(네이비) 자동 전환
// ─────────────────────────────────────────────────────
import { Page, Section, Card, Row, StatTiles, EmptyInvite, Hero, Progress, QuietList } from "../../components/v3/ui";
import { C, R, S } from "../../constants";
import { SHOW_BETA_UI, PAYMENTS_LIVE } from "../../constants/release"; // 베타면 «안전결제 기록» 대신 «계약·공사 기록»
import { BIZ_ROWS } from "../../components/AppFooter";

export default function MyPageV3({
  user = {},
  activeRole = "consumer",
  stats = {},
  grade = null,            // { label, hint, pct }
  spaceTemp = 36.5,
  tokenBalance = 0,
  idVerified = false,
  onVerifyId,
  unreadTotal = 0,
  companyRegions = [],
  onGo = () => {},
  onLogout,
  onForgetDevice,
  onDeleteAccount,
  onShowAppInfo,
  onShowBusinessInfo,
  onTerms = () => {},
  onEditRegions,
  isModerator = false,     // 관리자·운영자 — 운영 입구를 보여 준다
  isAdmin = false,
}) {
  const isCompany = activeRole === "company";
  const name = user?.name || (isCompany ? "파트너" : "회원");
  const region = user?.region || "지역 미설정";

  const s = {
    requests:   stats.requests   ?? 0,
    inProgress: stats.inProgress ?? 0,
    completed:  stats.completed  ?? 0,
    saved:      stats.saved      ?? 0,
  };
  const hasAnyDeal = s.requests + s.inProgress + s.completed > 0;

  return (
    <Page>
      {/* ── 히어로 — 첫인상. 인사 + 상태 칩 + 핵심 행동 ───────────────── */}
      <div style={{ paddingTop: S.xl }}>
        <Hero
          eyebrow={`${region} · ${isCompany ? "검증 파트너" : "의뢰인"}`}
          title={`${name}님, 반가워요`}
          sub={isCompany
            ? "오늘 들어온 요청을 확인하고 견적을 보내보세요."
            : "좋은 공간은 좋은 만남에서 시작됩니다."}
          chips={[
            `공간온도 ${Number(spaceTemp).toFixed(1)}°`,
            ...(grade?.label ? [grade.label] : []),
            // 본인인증 칩은 진짜 제공자가 붙었을 때만(onVerifyId 가 있을 때) — constants/release IDENTITY_VERIFY_READY
            ...(onVerifyId ? [idVerified ? "본인인증 완료" : "본인인증 전"] : []),
          ]}
          actions={isCompany
            ? [{ label: "파트너센터", primary: true, onClick: () => onGo("dashboard") },
               { label: "포트폴리오", onClick: () => onGo("portfolio") }]
            : [{ label: "견적 시작하기", primary: true, onClick: () => onGo("newreq") },
               { label: "내 견적", onClick: () => onGo("timeline") }]}
        />
      </div>

      {/* ── 요약 통계 — 탭하면 바로 이동(별도 바로가기 버튼 줄을 없앤 이유) ── */}
      <StatTiles
        items={[
          // 파트너는 고객용 「내 견적」 화면이 아니라 파트너센터로 간다(예전엔 파트너도 고객 화면이 열렸다).
          { label: isCompany ? "새 요청" : "견적요청", value: s.requests,   emoji: "📝", onClick: () => onGo(isCompany ? "home" : "timeline") },
          { label: "진행중",   value: s.inProgress, emoji: "📦", onClick: () => onGo(isCompany ? "dashboard" : "timeline") },
          { label: "완료",     value: s.completed,  emoji: "✅", onClick: () => onGo(isCompany ? "dashboard" : "timeline") },
          { label: "저장",     value: s.saved,      emoji: "❤️", onClick: () => onGo("favorites") },
        ]}
      />

      {/* ── 등급 — 쌓이는 느낌을 주는 진행바 (값이 있을 때만) ─────────── */}
      {grade && (
        <Card tone="brand">
          <Progress pct={grade.pct} label={grade.label} right={grade.hint} />
        </Card>
      )}

      {/* ── 본인인증 — 미인증일 때만 노출. 완료되면 사라져 화면이 짧아진다 ── */}
      {onVerifyId && !idVerified && (
        <EmptyInvite
          text="본인인증을 마치면 더 안전하게 거래할 수 있어요."
          cta="인증하기"
          onCta={onVerifyId}
        />
      )}

      {/* ── 내 기록 — v2 의 빈 카드 4개를 '행 4개'로 접었다 ──────────── */}
      <Section title="내 기록">
        <Card pad={`0 ${S.lg}px`}>
          {isCompany ? (<>
            <Row emoji="🏗" label="진행 중인 공사" sub="단계 사진·정산 현황" badge={s.inProgress || null} onClick={() => onGo("dashboard")} />
            <Row emoji="✅" label="완료한 공사"   sub="정산 완료·고객 평가"   badge={s.completed || null}  onClick={() => onGo("dashboard")} last />
          </>) : (<>
            <Row emoji="🏠" label="공간 이력"   sub="완료된 시공 기록"       badge={s.completed || null} onClick={() => onGo("space-history")} />
            <Row emoji="📋" label="받은 견적"   sub="다음 공사 때 참고용"     badge={s.requests || null}  onClick={() => onGo("timeline")} />
            <Row emoji="🛡️" label={SHOW_BETA_UI ? "계약·공사 기록" : "안전결제 기록"} sub={SHOW_BETA_UI ? "진행한 계약과 공사 기록" : "공간안전결제로 완료한 거래"} onClick={() => onGo("timeline")} last />
          </>)}
        </Card>
        {!hasAnyDeal && (
          <EmptyInvite
            text="아직 기록이 없어요. 첫 견적을 받으면 여기에 쌓입니다."
            cta={isCompany ? "요청 보기" : "견적 받기"}
            onCta={() => onGo(isCompany ? "home" : "newreq")}
          />
        )}
      </Section>

      {/* ── 업체 전용 — 공간보증 / 영업지역 / 서류 ──────────────────── */}
      {isCompany && (
        <Section title="파트너 관리">
          <Card pad={`0 ${S.lg}px`}>
            <Row emoji="🛡️" label="내 한도 · 서류" sub="얼마까지 입찰 · 다음 계단" onClick={() => onGo("documents")} />
            <Row emoji="📍" label="영업지역"
                 sub={companyRegions.length ? companyRegions.join(" · ") : "최대 2곳까지 설정"}
                 onClick={onEditRegions} />
            <Row emoji="📄" label="서류 관리" sub="사업자등록증·증빙" onClick={() => onGo("documents")} last />
          </Card>
        </Section>
      )}

      {/* ── 운영 — 관리자·운영자만. 새 마이(v3)에 입구가 없어 댓글 숨김을 할 수 없었다(09-26) ── */}
      {isModerator && (
        <Section title="운영">
          <Card pad={`0 ${S.lg}px`}>
            {isAdmin && (
              <Row emoji="🛡️" label="관리자 화면" sub="업체·거래·라운지·설정" onClick={() => onGo("admin")} />
            )}
            <Row emoji="📋" label="운영자 게시판 관리" sub="추천글 등록 · 글·댓글 숨김" onClick={() => onGo("operator-board")} last />
          </Card>
        </Section>
      )}

      {/* ── 라운지 — 온도/토큰을 한 카드로 압축, 상세는 하위 화면으로 ── */}
      <Section title="라운지" action="둘러보기" onAction={() => onGo("lounge")}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: S.lg, marginBottom: S.md }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: C.text3 }}>공간온도</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.brand, lineHeight: 1.2 }}>
                {Number(spaceTemp).toFixed(1)}°
              </div>
            </div>
            <div style={{ width: 1, height: 34, background: C.bgWarm }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: C.text3 }}>보유 토큰</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.text1, lineHeight: 1.2 }}>
                {Number(tokenBalance).toLocaleString()}
              </div>
            </div>
            <button onClick={() => onGo("token-store")}
              style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.full,
                padding: "9px 16px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
              {PAYMENTS_LIVE ? "충전" : "모으기"}
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${C.bg}` }} />
          <Row emoji="✍️" label="내 활동" sub="내가 쓴 글 · 저장한 글 · 댓글" onClick={() => onGo("my-posts")} />
          <Row emoji="🔔" label="라운지 알림 설정" sub="관심 카테고리 · 새 글 알림" onClick={() => onGo("lounge-settings")} last />
        </Card>
      </Section>

      {/* ── 알림 · 고객센터 ─────────────────────────────────────────── */}
      <Section title="알림 · 도움">
        <Card pad={`0 ${S.lg}px`}>
          <Row emoji="🔔" label="알림함" badge={unreadTotal || null} onClick={() => onGo("notifications")} />
          <Row emoji="❓" label="자주 묻는 질문" sub={SHOW_BETA_UI ? "계약 · 대금 · 분쟁" : "에스크로 · 환불 · 분쟁"} onClick={() => onGo("help")} />
          <Row emoji="💬" label="고객센터 문의" sub="070-7954-2740" onClick={onShowAppInfo} last />
        </Card>
      </Section>

      {/* ── 설정 — 비중이 낮으므로 조용한 리스트로 ──────────────────── */}
      <Section title="설정">
        <QuietList
          items={[
            { label: "로그아웃", onClick: onLogout },
            { label: "이 기기 인증 삭제", onClick: onForgetDevice },
            { label: "회원탈퇴", onClick: onDeleteAccount, danger: true },
          ]}
        />
      </Section>

      {/* ── 앱 정보 · 법적 고지 ─────────────────────────────────────── */}
      <Section title="앱 정보">
        <QuietList
          items={[
            { label: "개인정보처리방침", onClick: () => onTerms("privacy") },
            { label: "이용약관",         onClick: () => onTerms("terms") },
            { label: "환불 정책",        onClick: () => onTerms("refund") },
            { label: "사업자 정보",      onClick: onShowBusinessInfo },
          ]}
        />
      </Section>

      {/* ── 사업자 정보 푸터 — 법적 필수(삭제 금지) ─────────────────── */}
      <div style={{ padding: `${S.lg}px 0 ${S.xxl}px`, textAlign: "center" }}>
        <div style={{ fontSize: 10.5, color: C.text4, lineHeight: 1.8 }}>
          {BIZ_ROWS.map(([k, v]) => (
            <div key={k}><span style={{ color: C.text4 }}>{k}</span> {v}</div>
          ))}
        </div>
      </div>
    </Page>
  );
}
