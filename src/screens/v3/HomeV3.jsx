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
import { Page, Section, Card, Row, Hero, PhotoTile, TrustRow, EmptyInvite, Progress, FoldText } from "../../components/v3/ui";
import { C, R, S } from "../../constants";
import { SHOW_BETA_UI } from "../../constants/release"; // 베타면 결제 약속 대신 «기록이 남는다»를 말한다(정식 전환 시 원문 복귀)

// 의뢰인이 가장 먼저 고르는 것은 '어떤 공간인가'다. 요청 모달의 공간 유형(SPACE_TYPES)과 같은 이름을 쓴다
// → 누르면 그 유형이 미리 골라진 채로 견적 요청이 열린다.
const SPACE_TILES = [
  { type: "아파트 전체", sub: "전체 리모델링", img: "/images/living.webp" },
  { type: "아파트 부분", sub: "주방·욕실·도배", img: "/images/kitchen.webp" },
  { type: "원룸/오피스텔", sub: "원룸·투룸", img: "/images/space-officetel.webp" },
  { type: "카페/식당", sub: "매장 인테리어", img: "/images/cafe.webp" },
  { type: "오피스", sub: "사무실", img: "/images/space-office.webp" },
  { type: "상가", sub: "상가·점포", img: "/images/space-shop.webp" },
];

const STEPS = [
  { n: "1", title: "1분 요청", sub: "공간과 예산만 알려 주세요" },
  { n: "2", title: "견적 비교", sub: "검증 업체 견적을 한눈에" },
  { n: "3", title: "안전 결제", sub: "공사 단계마다 나눠 지급" },
];

function SpaceTile({ type, sub, img, onClick }) {
  return (
    <button onClick={onClick} style={{ position: "relative", padding: 0, border: "none", borderRadius: R.lg, overflow: "hidden",
      aspectRatio: "1 / 1", cursor: "pointer", background: `linear-gradient(145deg, ${C.brandL}, ${C.brandM})`, textAlign: "left" }}>
      {img && <img src={img} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: img
        ? "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)" : "none" }} />
      <div style={{ position: "absolute", left: 10, right: 8, bottom: 9, color: img ? "#fff" : C.brandD }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.3px", lineHeight: 1.25 }}>{type}</div>
        <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  );
}

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
  openRequest = null,      // 의뢰인: 진행 중이 아닌 최근 요청 { title, bidCount, onOpen }
  onGo = () => {},
  onNewRequest,
  onRequestType,           // 의뢰인: 공간 유형을 고른 채 견적 요청 열기(type)
  requestsSlot = null,     // 파트너: 입찰할 새 견적 요청 목록(MainApp 이 그린다)
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
              { label: "요청 보기", primary: true, onClick: () => document.getElementById("partner-requests")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
              { label: "파트너센터", onClick: () => onGo("dashboard") },
            ]}
          />
        ) : (
          <Hero
            eyebrow="인테리어 · 집수리 비교견적"
            title="아무에게나 맡길 수 없으니까"
            sub={SHOW_BETA_UI
              ? "검증된 업체 3곳의 견적을 1분 만에 비교하고, 계약부터 공사 사진까지 한곳에 기록해 드립니다."
              : "검증된 업체 3곳의 견적을 1분 만에 비교하고, 공사대금은 단계별로 안전하게 지켜드립니다."}
            chips={SHOW_BETA_UI ? ["가입비 0원", "견적 무료", "계약·공사 기록"] : ["가입비 0원", "견적 무료", "공간안전결제"]}
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

      {/* ── 파트너: 새 견적 요청 — 홈에서 바로 보고 입찰한다 ─────────── */}
      {isCompany && requestsSlot && (
        <div id="partner-requests" style={{ scrollMarginTop: 120 }}>{requestsSlot}</div>
      )}

      {/* ── 의뢰인: 보낸 요청의 상태 — 견적이 왔으면 비교하러 가게 ─────── */}
      {!isCompany && !activeContract && openRequest && (
        <Card tone="brand" onClick={openRequest.onOpen}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: S.md }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>내 견적 요청</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginTop: 3 }}>{openRequest.title}</div>
              <div style={{ fontSize: 12.5, color: C.text2, marginTop: 3 }}>
                {openRequest.bidCount > 0 ? `견적 ${openRequest.bidCount}건이 도착했어요` : "업체들이 요청을 보고 있어요"}
              </div>
            </div>
            <span style={{ flex: "0 0 auto", background: C.brand, color: "#fff", borderRadius: R.full, padding: "8px 14px",
              fontSize: 12.5, fontWeight: 800 }}>{openRequest.bidCount > 0 ? "비교하기" : "보기"}</span>
          </div>
        </Card>
      )}

      {/* ── 의뢰인: 어떤 공간인지부터 고르게 — 누르면 유형이 골라진 요청이 열린다 ── */}
      {!isCompany && (
        <Section title="어떤 공간을 고치세요?">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: S.sm }}>
            {SPACE_TILES.map((t) => (
              <SpaceTile key={t.type} {...t} onClick={() => (onRequestType ? onRequestType(t.type) : onNewRequest?.())} />
            ))}
          </div>
        </Section>
      )}

      {/* ── 신뢰 — 업체 수가 적을 때 숫자('1곳')는 오히려 불안하다 → 약속으로 보여준다 ── */}
      {isCompany || companiesCount >= 10 ? (
        <TrustRow
          items={[
            { value: `${companiesCount}곳`, label: "검증 업체" },
            { value: `${Number(avgTemp).toFixed(1)}°`, label: "평균 공간온도" },
            { value: `${completedCount}건`, label: "누적 완료" },
          ]}
        />
      ) : (
        <Section title="견적은 이렇게 진행돼요">
          <Card pad={`${S.md}px ${S.sm}px`}>
            <div style={{ display: "flex" }}>
              {STEPS.map((st, i) => (
                <div key={st.n} style={{ flex: 1, textAlign: "center", position: "relative", padding: `0 ${S.xs}px` }}>
                  {i > 0 && <div aria-hidden style={{ position: "absolute", left: -6, top: 12, color: C.text4, fontSize: 12 }}>›</div>}
                  <div style={{ width: 26, height: 26, borderRadius: "50%", margin: "0 auto", background: C.brandL, color: C.brand,
                    fontSize: 12.5, fontWeight: 900, display: "grid", placeItems: "center" }}>{st.n}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginTop: 6 }}>{st.title}</div>
                  <div style={{ fontSize: 10.5, color: C.text3, marginTop: 2, lineHeight: 1.4 }}>{st.sub}</div>
                </div>
              ))}
            </div>
          </Card>
        </Section>
      )}

      {/* ── 시공 사례 — 첫인상의 핵심. 사진을 크게 ───────────────── */}
      <Section title="시공 사례" action={showcases.length > 0 ? "전체 보기" : null} onAction={() => onGo("showcase")}>
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
                <FoldText text={`“${r.text}”`} lines={3} style={{ fontSize: 13, color: C.text2, lineHeight: 1.65 }} />
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
              <Row emoji="📋" label="받은 요청" sub="입찰할 견적 요청" badge={newRequestCount || null}
                onClick={() => document.getElementById("partner-requests")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
              <Row emoji="🗺️" label="지역 지도" sub="내 영업지역 확인" onClick={() => onGo("map")} />
              <Row emoji="💬" label="라운지" sub="사장님 수다 · 노하우" onClick={() => onGo("lounge")} last />
            </>
          ) : (
            <>
              <Row emoji="🗺️" label="지역 지도" sub="가까운 업체 찾기" onClick={() => onGo("map")} />
              <Row emoji="💬" label="라운지" sub="인테리어 이야기 · 후기" onClick={() => onGo("lounge")} />
              <Row emoji="🛡️" label={SHOW_BETA_UI ? "공간안전결제 · 정식 오픈 예정" : "공간안전결제란?"} sub={SHOW_BETA_UI ? "토스페이먼츠 승인 뒤 열리는 단계별 지급 구조" : "단계별 안전 지급 구조"} onClick={() => { window.location.href = "/safe-payment"; }} last />
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
