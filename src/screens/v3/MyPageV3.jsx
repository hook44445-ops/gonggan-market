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
import { useEffect, useState } from "react";
import { companyPageUrl } from "../../lib/referral";
import CompanyQrSheet from "../../components/CompanyQrSheet";
import QuoteSheetMaker from "../../components/QuoteSheetMaker";
import PushNotificationSettings from "../../components/PushNotificationSettings";
import { getCompanyPageStats } from "../../lib/supabase";
import { statsLine } from "../../lib/pageViews";
import { slugProblem, normalizeSlug } from "../../lib/companySlug";
import { setCompanySlug } from "../../lib/supabase";
import { reviewRequestUrl, reviewRequestMessage } from "../../lib/externalReview";
import { partnerStartState, markPageShared, wasPageShared, markQrSaved, wasQrSaved } from "../../lib/partnerStart";
import CompanyProfileSheet from "../../components/CompanyProfileSheet";
import { myRefCode } from "../../lib/myRefCode";

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
  companyId = null,        // 업체 공개 페이지(/p/업체ID) 공유용
  companySlug = null,      // 짧은 주소(/p/짧은이름 · 149)
  onSlugChange,            // 저장되면 부모(myCompanyRow)에 반영
  companyRow = null,       // 시작 체크리스트 — verified · has_insurance · slug · (154) cover_url · logo_url · intro
  onCompanyRowChange,      // 페이지 꾸미기 저장 뒤 부모(myCompanyRow)에 반영
  partnerGrowth = null,    // 시작 체크리스트 — showcases · reviews · extReviews
}) {
  const isCompany = activeRole === "company";
  // 내 업체 페이지 공유 — 초대 코드를 미리 받아 둔다(버튼에서 기다리면 아이폰이 공유창을 막는다).
  const [refCode, setRefCode] = useState(null);
  const [pageShared, setPageShared] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  // 내 업체 페이지 방문 수(156) — SQL 전이거나 실패하면 원래 문구
  const [viewLine, setViewLine] = useState(null);
  useEffect(() => {
    if (!isCompany || !companyId) return;
    let alive = true;
    getCompanyPageStats(companyId).then(({ data, error }) => { if (alive && !error) setViewLine(statsLine(data)); }).catch(() => {});
    return () => { alive = false; };
  }, [isCompany, companyId]);
  const [qrSaved, setQrSaved] = useState(false);
  useEffect(() => {
    if (!isCompany || !companyId || !user?.id) return;
    let alive = true;
    myRefCode(user.id).then(c => { if (alive) setRefCode(c); });
    return () => { alive = false; };
  }, [isCompany, companyId, user?.id]);
  const shareCompanyPage = async () => {
    const url = companyPageUrl(companySlug || companyId, refCode);
    try {
      if (navigator.share) { await navigator.share({ title: user?.name || "공간마켓", url }); setPageShared(true); markPageShared(companyId); return; }
      await navigator.clipboard.writeText(url); setPageShared(true); markPageShared(companyId);
    } catch { /* 공유 취소 */ }
  };

  // 지인 공사 후기 부탁(151) — «공간마켓 밖 공사 후기»로 따로 보인다(평점·온도 X)
  const [reviewAsked, setReviewAsked] = useState(false);
  const askReview = async () => {
    const text = reviewRequestMessage(user?.name, reviewRequestUrl(companySlug || companyId, refCode));
    try {
      if (navigator.share) { await navigator.share({ title: "공사 후기 부탁", text }); setReviewAsked(true); return; }
      await navigator.clipboard.writeText(text); setReviewAsked(true);
    } catch { /* 공유 취소 */ }
  };

  // 내 업체 페이지 꾸미기(154)
  const [profileOpen, setProfileOpen] = useState(false);

  // 짧은 주소 정하기(149) — 명함·인스타에 넣을 수 있게. 규칙은 lib/companySlug(서버와 같음).
  const [slugOpen, setSlugOpen] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [slugMsg, setSlugMsg] = useState(null);
  const [slugBusy, setSlugBusy] = useState(false);
  const saveSlug = async () => {
    const v = normalizeSlug(slugDraft);
    const problem = v ? slugProblem(v) : null;
    if (problem) { setSlugMsg(problem); return; }
    setSlugBusy(true); setSlugMsg(null);
    const { data, error } = await setCompanySlug(companyId, v);
    setSlugBusy(false);
    if (error || !data?.ok) {
      const r = data?.reason;
      const m = String(error?.message ?? "");
      setSlugMsg(r === "TAKEN" ? "이미 다른 업체가 쓰는 주소예요" : r === "RESERVED" ? "쓸 수 없는 주소예요 — 다른 이름을 골라 주세요"
        : r === "BAD_SLUG" ? (slugProblem(v) || "주소 모양을 확인해 주세요")
        : /LOGIN_REQUIRED|JWT/.test(m) ? "로그인이 풀렸어요 — 인증번호로 다시 로그인해 주세요"
        : /company_set_slug/.test(m) ? "아직 준비 중이에요(SQL 149)" : "저장하지 못했어요");
      return;
    }
    onSlugChange?.(data.slug ?? null);
    setSlugOpen(false);
  };
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
            <Row emoji="✅" label="완료한 공사"   sub="정산 완료·고객 평가"   badge={s.completed || null}  onClick={() => onGo("dashboard")} />
            <Row emoji="🧾" label="내 작업 장부" sub="지인 공사까지 · 월 순이익 · 시간당 순이익" onClick={() => onGo("job-ledger")} last />
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
          {companyId && (() => {
            // 파트너 시작 체크리스트(09-28) — 다 끝나면 사라진다
            const st = partnerStartState({ company: companyRow ?? {}, growth: partnerGrowth,
              extReviews: partnerGrowth?.extReviews ?? 0, shared: pageShared || wasPageShared(companyId),
              qrSaved: qrSaved || wasQrSaved(companyId) });
            if (st.complete) return null;
            const run = (action) => {
              if (action === "documents") onGo("documents");
              else if (action === "slug") { setSlugDraft(companySlug ?? ""); setSlugMsg(null); setSlugOpen(true); }
              else if (action === "profile") setProfileOpen(true);
              else if (action === "portfolio") onGo("dashboard-portfolio");
              else if (action === "askReview") askReview();
              else if (action === "sharePage") shareCompanyPage();
              else if (action === "qr") setQrOpen(true);
            };
            return (
              <Card tone="brand">
                <Progress pct={Math.round((st.count / st.total) * 100)} label={`믿고 부르는 업체까지 ${st.count}/${st.total}`}
                  right={st.next ? `다음 · ${st.next.label}` : ""} />
                <div style={{ marginTop: S.md, display: "flex", flexDirection: "column", gap: 6 }}>
                  {st.items.map((it) => (
                    <button key={it.key} onClick={() => !it.done && run(it.action)} disabled={it.done}
                      style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: it.key === st.next?.key ? C.surface : "transparent",
                        border: it.key === st.next?.key ? `1px solid ${C.brandM}` : "1px solid transparent", borderRadius: R.md,
                        padding: "8px 10px", cursor: it.done ? "default" : "pointer" }}>
                      <span aria-hidden style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                        fontSize: 12, fontWeight: 900, background: it.done ? C.brand : C.surface, color: it.done ? "#fff" : C.text4,
                        border: it.done ? "none" : `1.5px solid ${C.bgWarm}` }}>{it.done ? "✓" : ""}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: it.done ? C.text3 : C.text1,
                          textDecoration: it.done ? "line-through" : "none" }}>{it.label}</span>
                        {!it.done && it.key === st.next?.key && <span style={{ display: "block", fontSize: 11.5, color: C.text3, marginTop: 2 }}>{it.hint}</span>}
                      </span>
                      {!it.done && <span style={{ color: C.text4, fontSize: 16 }}>›</span>}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })()}
          <Card pad={`0 ${S.lg}px`}>
            <Row emoji="🛡️" label="내 한도 · 서류" sub="얼마까지 입찰 · 다음 계단" onClick={() => onGo("documents")} />
            <Row emoji="📍" label="영업지역"
                 sub={companyRegions.length ? companyRegions.join(" · ") : "최대 2곳까지 설정"}
                 onClick={onEditRegions} />
            <Row emoji="📄" label="서류 관리" sub="사업자등록증·증빙" onClick={() => onGo("documents")} last={!companyId} />
            {companyId && (
              <Row emoji="📷" label="내 업체 페이지 꾸미기"
                   sub={companyRow?.cover_url || companyRow?.intro ? "커버·로고·소개 고치기" : "커버 사진 · 로고 · 소개글 올리기"}
                   onClick={() => setProfileOpen(true)} />
            )}
            {companyId && (
              <Row emoji="📌" label="내 업체 주소" sub={companySlug ? `gongganmarket.com/p/${companySlug}` : "짧은 주소 만들기 — 명함·인스타에 넣기 좋게"}
                   onClick={() => { setSlugDraft(companySlug ?? ""); setSlugMsg(null); setSlugOpen(true); }} />
            )}
            {companyId && (
              <Row emoji="⭐" label="지인 공사 후기 부탁" sub={reviewAsked ? "보냈어요 · «공간마켓 밖 공사 후기»로 따로 보여요" : "공간마켓 밖에서 한 공사 — 평점엔 안 들어가요"}
                   onClick={askReview} />
            )}
            {companyId && (
              <Row emoji="🔗" label="내 업체 페이지 공유" sub={pageShared ? "주소를 보냈어요 · 블로그·인스타·명함에도 걸어 보세요" : (viewLine ?? "시공 사례·후기를 누구나 보는 주소")}
                   onClick={shareCompanyPage} />
            )}
            {companyId && (
              <Row emoji="🔳" label="명함·전단용 QR코드" sub="폰 카메라로 찍으면 내 업체 페이지가 열려요"
                   onClick={() => setQrOpen(true)} />
            )}
            {companyId && (
              <Row emoji="🧾" label="간단 견적서 만들기" sub="지인·전화 공사 견적을 이미지로 · 내 페이지 QR 포함"
                   onClick={() => setQuoteOpen(true)} last />
            )}
          </Card>
        </Section>
      )}
      {pushOpen && user?.id && (
        <div role="dialog" aria-label="푸시 알림 설정" onClick={() => setPushOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: C.bg, borderRadius: "22px 22px 0 0", padding: "18px 16px 24px" }}>
            <PushNotificationSettings user={user} />
            <button onClick={() => setPushOpen(false)} style={{ width: "100%", padding: 12, background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>닫기</button>
          </div>
        </div>
      )}
      {quoteOpen && companyId && (
        <QuoteSheetMaker companyName={companyRow?.name ?? user?.name} phone={user?.phone ?? ""}
          pageUrl={companyPageUrl(companySlug || companyId, refCode)} onClose={() => setQuoteOpen(false)} />
      )}
      {qrOpen && companyId && (
        <CompanyQrSheet url={companyPageUrl(companySlug || companyId, refCode)} name={companyRow?.name ?? user?.name}
          onClose={() => setQrOpen(false)} onSaved={() => { markQrSaved(companyId); setQrSaved(true); }} />
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
          <Row emoji="🔔" label="라운지 알림 설정" sub="관심 카테고리 · 새 글 알림" onClick={() => onGo("lounge-settings")} />
          <Row emoji="📣" label="푸시 알림 · 이벤트 알림" sub="받을 알림 고르기 · 이벤트·혜택(광고) 수신 동의" onClick={() => setPushOpen(true)} last />
        </Card>
      </Section>

      {/* ── 알림 · 고객센터 ─────────────────────────────────────────── */}
      <Section title="알림 · 도움">
        <Card pad={`0 ${S.lg}px`}>
          <Row emoji="🤝" label={isCompany ? "동료 사장님 초대" : "친구 초대"} sub="내 초대 링크 · 가입한 사람 수" onClick={() => onGo("invite")} />
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
      {profileOpen && companyId && (
        <CompanyProfileSheet companyId={companyId} initial={companyRow ?? {}}
          onClose={() => setProfileOpen(false)}
          onSaved={(p) => { onCompanyRowChange?.(p); setProfileOpen(false); }} />
      )}
      {slugOpen && (
        <div onClick={() => setSlugOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 600,
          display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="내 업체 주소"
            style={{ width: "100%", maxWidth: 480, background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.text1 }}>내 업체 주소</div>
            <div style={{ fontSize: 12.5, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
              영문 소문자를 권해요(예: gangseo-repair). 한글도 되지만 일부 앱에서 주소가 길게 보여요.
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 14, border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, overflow: "hidden" }}>
              <span style={{ padding: "12px 0 12px 12px", fontSize: 14, color: C.text3, whiteSpace: "nowrap" }}>…/p/</span>
              <input value={slugDraft} onChange={(e) => { setSlugDraft(e.target.value); setSlugMsg(null); }} maxLength={20}
                aria-label="짧은 주소" placeholder="gangseo-repair" autoCapitalize="none" autoCorrect="off"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", padding: "12px 12px 12px 2px", fontSize: 15, color: C.text1 }} />
            </div>
            {slugMsg && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: C.red }}>{slugMsg}</div>}
            <div style={{ display: "flex", gap: S.sm, marginTop: 16 }}>
              <button onClick={() => setSlugOpen(false)} style={{ flex: 1, padding: "13px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
                background: C.surface, color: C.text2, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>취소</button>
              <button onClick={saveSlug} disabled={slugBusy} style={{ flex: 2, padding: "13px 0", borderRadius: R.md, border: "none",
                background: C.brand, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", opacity: slugBusy ? 0.7 : 1 }}>
                {slugBusy ? "저장 중…" : slugDraft.trim() ? "이 주소로 정하기" : "짧은 주소 없애기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
