// ─────────────────────────────────────────────────────
// 홈 v3 — 재설계본 (관리자 토글: UI v2 ↔ v3)
//
// 홈은 앱을 처음 여는 화면이라 '초반 매력도'를 좌우한다.
// v2 의 문제
//  · 고객 홈 720줄 / 업체 홈 320줄이 MainApp 에 인라인
//  · 약속·후기·인기글·요청·정렬·라운지·무드카드가 같은 무게로 나열돼 시선이 분산
//  · 운영 화면에 DEV 패널이 섞여 있음
//
// v3 의 방향
//  · 히어로 하나로 '무엇을 하는 앱인지 + 다음 행동'을 3초 안에 전달
//  · 사진(시공 사례)을 크게 — 인테리어는 결국 보여줘야 설득된다
//  · 신뢰 숫자 3개(검증 업체/안전결제/평균 응답)로 안심을 즉시 제공
//  · 진행 중인 계약이 있으면 그것을 최상단으로 올려 '할 일'을 먼저 보여준다
// ─────────────────────────────────────────────────────
import { Page, Section, Card, Row, Hero, PhotoTile, TrustRow, EmptyInvite, Progress } from "../../components/v3/ui";
import { C, R, S } from "../../constants";

export default function HomeV3({
  activeRole = "consumer",
  user = {},
  activeContract = null,   // { title, stageLabel, pct, onOpen }
  showcases = [],          // [{ id, photo, title, meta }]
  reviews = [],            // [{ id, text, author, company }]
  companiesCount = 0,
  avgTemp = 36.5,
  completedCount = 0,
  newRequestCount = 0,     // 업체: 오늘 들어온 요청
  onGo = () => {},
  onNewRequest,
  onOpenShowcase,
}) {
  const isCompany = activeRole === "company";
  const name = user?.name || (isCompany ? "파트너" : "고객");

  return (
    <Page>
      {/* ── 히어로 — 3초 안에 '무엇을/다음 행동' 전달 ─────────────── */}
      <div style={{ paddingTop: S.xl }}>
        {isCompany ? (
          <Hero
            eyebrow="공간사이 파트너"
            title={`${name}님, 오늘도 좋은 하루`}
            sub={newRequestCount > 0
              ? `오늘 새로 들어온 요청이 ${newRequestCount}건 있어요.`
              : "새 요청이 들어오면 바로 알려드릴게요."}
            chips={[`공간온도 ${Number(avgTemp).toFixed(1)}°`, `완료 ${completedCount}건`]}
            actions={[
              { label: "요청 보기", primary: true, onClick: () => onGo("home-requests") },
              { label: "파트너센터", onClick: () => onGo("dashboard") },
            ]}
          />
        ) : (
          <Hero
            eyebrow="인테리어 · 집수리 비교견적"
            title="아무에게나 맡길 수 없으니까"
            sub="검증된 업체 3곳의 견적을 1분 만에 비교하고, 공사대금은 단계별로 안전하게 지켜드립니다."
            chips={["가입비 0원", "견적 무료", "공간안전결제"]}
            actions={[{ label: "무료 견적 받기", primary: true, onClick: onNewRequest }]}
          />
        )}
      </div>

      {/* ── 진행 중인 계약 — 있으면 최상단. '지금 할 일'이 먼저다 ──── */}
      {activeContract && (
        <Card tone="brand" onClick={activeContract.onOpen}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.sm }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>진행 중인 공사</span>
            <span style={{ fontSize: 11.5, color: C.text3 }}>{activeContract.stageLabel}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            {activeContract.title}
          </div>
          <Progress pct={activeContract.pct} />
        </Card>
      )}

      {/* ── 신뢰 숫자 — 사회적 증거를 한 줄로 ───────────────────── */}
      <TrustRow
        items={[
          { value: `${companiesCount}곳`, label: "검증 업체" },
          { value: `${Number(avgTemp).toFixed(1)}°`, label: "평균 공간온도" },
          { value: `${completedCount}건`, label: "누적 완료" },
        ]}
      />

      {/* ── 시공 사례 — 첫인상의 핵심. 사진을 크게 ───────────────── */}
      <Section title="시공 사례" action="더보기" onAction={() => onGo("portfolio")}>
        {showcases.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
            {showcases.slice(0, 3).map((w, i) => (
              <PhotoTile key={w.id ?? i} src={w.photo} title={w.title} meta={w.meta}
                height={i === 0 ? 180 : 140}
                onClick={() => onOpenShowcase?.(w)} />
            ))}
          </div>
        ) : (
          <EmptyInvite text="곧 이 지역의 시공 사례를 보여드릴게요."
            cta={isCompany ? "포트폴리오 등록" : null}
            onCta={() => onGo("portfolio")} />
        )}
      </Section>

      {/* ── 후기 — 실제 목소리. 길게 나열하지 않고 2건만 ───────── */}
      {reviews.length > 0 && (
        <Section title="믿고 맡긴 후기">
          <Card pad={`0 ${S.lg}px`}>
            {reviews.slice(0, 2).map((r, i, arr) => (
              <div key={r.id ?? i} style={{ padding: `${S.md}px 0`,
                borderBottom: i === arr.length - 1 ? "none" : `1px solid ${C.bg}` }}>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.65 }}>“{r.text}”</div>
                <div style={{ fontSize: 11.5, color: C.text4, marginTop: 6 }}>
                  {r.author ?? "고객"}{r.company ? ` · ${r.company}` : ""}
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {/* ── 다음 행동 — 홈 하단에서 자연스럽게 다른 탭으로 연결 ──── */}
      <Section title={isCompany ? "파트너 메뉴" : "더 둘러보기"}>
        <Card pad={`0 ${S.lg}px`}>
          {isCompany ? (
            <>
              <Row emoji="📋" label="받은 요청" sub="입찰할 견적 요청" badge={newRequestCount || null} onClick={() => onGo("home-requests")} />
              <Row emoji="🗺️" label="지역 지도" sub="내 영업지역 확인" onClick={() => onGo("map")} />
              <Row emoji="💬" label="라운지" sub="사장님 수다 · 노하우" onClick={() => onGo("lounge")} last />
            </>
          ) : (
            <>
              <Row emoji="🗺️" label="지역 지도" sub="가까운 업체 찾기" onClick={() => onGo("map")} />
              <Row emoji="💬" label="라운지" sub="인테리어 이야기 · 후기" onClick={() => onGo("lounge")} />
              <Row emoji="🛡️" label="공간안전결제란?" sub="단계별 안전 지급 구조" onClick={() => { window.location.href = "/safe-payment"; }} last />
            </>
          )}
        </Card>
      </Section>

      {/* ── 브랜드 마무리 — 과하지 않게 한 줄 ───────────────────── */}
      <div style={{ textAlign: "center", padding: `${S.md}px 0 ${S.xxl}px`,
        fontSize: 12.5, color: C.text4, letterSpacing: "-0.2px" }}>
        좋은 공간은 좋은 만남에서 시작됩니다
      </div>
    </Page>
  );
}
