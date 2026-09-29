import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";
import { TempBadge, Stars, Divider } from "../components/common";
import ReviewModal from "../components/ReviewModal";
import ImageViewerModal from "../components/ImageViewerModal";
import { calcTempDelta, clampTemp } from "../utils/calculations";
import { getReviews, createReview, createReviewReward, getEscrowWithPayouts, getEstimateForRequest } from "../lib/supabase";
import { ratingUrlFor, recordAsk } from "../lib/storeRating";
import { sendTieredNotification } from "../utils/notify";
import { recommendMessage, REFERRAL_REWARD } from "../lib/referral";
import { myRefCode } from "../lib/myRefCode";
import { suggestCarePresets, warrantyCareItem } from "../lib/homeCare";
import { addHomeCareItem } from "../lib/supabase";
import { kstDay } from "../lib/pageViews";

const normalizeReview = (row) => ({
  id:              row.id,
  user:            row.user_name         ?? "익명",
  region:          row.region            ?? "—",
  rating:          row.rating,
  date:            row.created_at?.slice(0, 10).replace(/-/g, ".") ?? "",
  type:            row.space_type        ?? "시공 완료",
  content:         row.content,
  tags:            row.tags              ?? [],
  reply:           row.reply             ?? null,
  beforeImageUrls: row.before_image_urls ?? [],
  afterImageUrls:  row.after_image_urls  ?? [],
  imageUrls:       row.image_urls        ?? [], // deprecated compat
  contractId:      row.contract_id       ?? null,
});

function ReviewCard({ rv, isNew }) {
  const [showBefore, setShowBefore] = useState(false);
  const [viewer, setViewer] = useState(null);

  const hasAfter  = rv.afterImageUrls.length  > 0;
  const hasBefore = rv.beforeImageUrls.length > 0;
  const hasLegacy = rv.imageUrls.length        > 0;
  const hasPhotos = hasAfter || hasBefore || hasLegacy;

  const displayUrls = showBefore ? rv.beforeImageUrls : (hasAfter ? rv.afterImageUrls : rv.imageUrls);

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md,
      border:`1.5px solid ${isNew ? C.brand : C.bgWarm}`,
      animation: isNew ? "fadeUp 0.4s ease" : "none" }}>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.md }}>
        <div style={{ display:"flex", gap:S.md, alignItems:"center" }}>
          <div style={{ width:40, height:40, borderRadius:"50%",
            background:`hsl(${typeof rv.id === "number" ? rv.id*55 : 120},40%,88%)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, fontWeight:900, color:C.text2 }}>{rv.user[0]}</div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{rv.user}</div>
              {hasPhotos && (
                <span style={{ background:"#FFF8EC", color:"#8A5C00", borderRadius:R.full,
                  padding:"1px 8px", fontSize:10, fontWeight:700, border:"1px solid #F5D97A" }}>
                  📷 포토리뷰
                </span>
              )}
            </div>
            <div style={{ fontSize:12, color:C.text3 }}>📍 {rv.region} · {rv.date}</div>
          </div>
        </div>
        <Stars rating={rv.rating} size={13} />
      </div>

      <div style={{ background:C.surface2, borderRadius:R.md, padding:"8px 12px", marginBottom:S.md }}>
        <span style={{ fontSize:12, color:C.text3 }}>🏠 {rv.type}</span>
      </div>

      {rv.tags?.length > 0 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.md }}>
          {rv.tags.map(t => (
            <span key={t} style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
              padding:"3px 10px", fontSize:11, fontWeight:700 }}>✓ {t}</span>
          ))}
        </div>
      )}

      <div style={{ fontSize:14, color:C.text2, lineHeight:1.7,
        marginBottom: hasPhotos ? S.md : 0 }}>{rv.content}</div>

      {hasPhotos && (
        <div>
          {/* BEFORE/AFTER toggle — only if both exist */}
          {hasAfter && hasBefore && (
            <div style={{ display:"flex", gap:6, marginBottom:S.sm }}>
              <button onClick={() => setShowBefore(false)}
                style={{ padding:"4px 12px", borderRadius:R.full, fontSize:11, fontWeight:800,
                  border:"none", cursor:"pointer",
                  background: !showBefore ? C.brand : C.bgWarm,
                  color:      !showBefore ? "#fff"  : C.text3 }}>
                AFTER
              </button>
              <button onClick={() => setShowBefore(true)}
                style={{ padding:"4px 12px", borderRadius:R.full, fontSize:11, fontWeight:800,
                  border:"none", cursor:"pointer",
                  background: showBefore ? "#3A5FCC" : C.bgWarm,
                  color:      showBefore ? "#fff"    : C.text3 }}>
                BEFORE
              </button>
            </div>
          )}

          {/* Label when only one type */}
          {!hasBefore && hasAfter && (
            <div style={{ fontSize:10, fontWeight:800, color:C.brand, marginBottom:4 }}>AFTER</div>
          )}
          {!hasAfter && hasBefore && (
            <div style={{ fontSize:10, fontWeight:800, color:"#3A5FCC", marginBottom:4 }}>BEFORE</div>
          )}

          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {displayUrls.slice(0, 5).map((url, i) => (
              <img key={i} src={url} alt={`review-${i}`}
                onClick={() => setViewer({ images: displayUrls, index: i })}
                style={{ width:80, height:80, objectFit:"cover", borderRadius:R.md,
                  border:`1px solid ${C.bgWarm}`, cursor:"pointer" }}
                onError={e => { e.target.style.display = "none"; }} />
            ))}
          </div>

          {SHOW_DEBUG_UI && viewer && (
            <div style={{ marginTop:8, padding:"6px 10px", background:"rgba(0,0,0,0.88)",
              color:"#0f0", borderRadius:6, fontSize:10, fontFamily:"monospace", lineHeight:1.8 }}>
              [DEV:review-viewer]<br/>
              <span style={{ color:"#4ff" }}>review_id: {String(rv.id).slice(0,8)}</span><br/>
              image_count: {displayUrls.length} | modal_open: {String(!!viewer)}<br/>
              current_index: {viewer.index}<br/>
              <span style={{ color:"#ff0" }}>image_url: …{(viewer.images?.[viewer.index] ?? "").slice(-28)}</span>
            </div>
          )}
        </div>
      )}

      {viewer && (
        <ImageViewerModal
          images={viewer.images}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}

      {rv.reply && (
        <div style={{ background:C.surface2, borderRadius:R.md, padding:S.md, marginTop:S.md,
          borderLeft:`3px solid ${C.brand}` }}>
          <div style={{ fontSize:11, fontWeight:800, color:C.brand, marginBottom:4 }}>🏠 업체 답글</div>
          <div style={{ fontSize:13, color:C.text2, lineHeight:1.6 }}>{rv.reply}</div>
        </div>
      )}
    </div>
  );
}

// 좋은 후기 직후 «이 업체를 지인에게» — 업체 페이지 링크(+내 초대 코드). 받은 사람이 가입하면 나 +30 · 친구 +20.
function RecommendSheet({ company, code, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = recommendMessage(company?.name, company?.slug ?? company?.id, code);
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "공간마켓", text }); onClose(); } catch { /* 공유 취소 */ }
      return;
    }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(onClose, 1200); }
    catch { window.prompt("아래 내용을 복사해 보내 주세요", text); }
  };
  return (
    <div role="dialog" aria-label="업체 추천" style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.55)", zIndex:30,
      display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:480, background:C.surface,
        borderRadius:"22px 22px 0 0", padding:"24px 22px 30px", textAlign:"center" }}>
        <div style={{ fontSize:30 }}>🤝</div>
        <div style={{ fontSize:17, fontWeight:800, color:C.text1, marginTop:6 }}>집 고칠 지인이 있다면</div>
        <div style={{ fontSize:13.5, color:C.text2, lineHeight:1.65, marginTop:8 }}>
          {company?.name ?? "이 업체"}를 소개해 주세요.<br />지인이 이 링크로 가입하면 나는 공간토큰 {REFERRAL_REWARD.inviter}개, 지인은 {REFERRAL_REWARD.invitee}개를 받아요.
        </div>
        <button onClick={share} style={{ marginTop:18, width:"100%", padding:"15px", borderRadius:R.lg, background:C.brand, color:"#fff",
          border:"none", fontSize:15, fontWeight:800, cursor:"pointer" }}>{copied ? "복사했어요" : "카카오톡·문자로 소개하기"}</button>
        <button onClick={onClose} style={{ marginTop:10, width:"100%", padding:"12px", background:"none",
          border:"none", color:C.text3, fontSize:13.5, fontWeight:700, cursor:"pointer" }}>다음에 할게요</button>
      </div>
    </div>
  );
}

export default function ReviewScreen({ company, onBack, currentUser, requestId, contractId, onEarnToken }) {
  const [reviews,          setReviews]          = useState(company?.reviewList ?? []);
  const [showModal,        setShowModal]        = useState(false);
  const [newId,            setNewId]            = useState(null);
  const [localTemp,        setLocalTemp]        = useState(company?.temp ?? 36.5);
  const [alreadyReviewed,  setAlreadyReviewed]  = useState(false);
  // 스토어 별점 요청 — 별 4~5개 후기를 막 남긴 순간에만(주소가 없으면 null 이라 안 보인다 · lib/storeRating)
  const [storeAsk, setStoreAsk] = useState(null);
  // 업체 추천 부탁 — 별 4~5개 후기 직후. 스토어 별점 창이 있으면 그걸 닫은 뒤에 뜬다.
  const [recommend, setRecommend] = useState(null);   // { pending, code } | null
  // 내 집 관리 수첩(165)에 적어 두기 — 후기 글에서 고른 항목(최대 3개). 한 번 누르면 오늘 날짜로 들어간다.
  const [careSuggest, setCareSuggest] = useState(null);   // { items: [preset], added: Set<kind>, err } | null
  const closeStoreAsk = () => { setStoreAsk(null); setRecommend(r => (r?.pending ? { ...r, pending: false } : r)); };
  const [submitDebug,      setSubmitDebug]      = useState(null);
  // C-2: 중복 제출 가드 + optimistic ID 충돌 방지용 카운터
  const submittingRef = useRef(false);
  const tmpSeqRef     = useRef(0);

  const avg = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0.0";

  useEffect(() => {
    if (!company?.id) return;
    let alive = true; // H-F: 언마운트 후 도착한 stale 응답이 state를 덮어쓰는 것 방지
    getReviews(company.id).then(({ data, error }) => {
      if (!alive) return;
      if (error) return;
      if (data && data.length > 0) {
        const normalized = data.map(normalizeReview);
        setReviews(normalized);
        if (contractId) {
          setAlreadyReviewed(normalized.some(r => r.contractId === contractId));
        }
      }
    });
    return () => { alive = false; };
  }, [company?.id, contractId]);

  const handleSubmit = async (data) => {
    // C-2: 빠른 연속 제출 차단 (이미 처리 중이면 무시)
    if (submittingRef.current) return;
    submittingRef.current = true;

    const now = new Date();
    // C-2: Date.now() 단독 사용 시 같은 ms에 충돌 가능 → 시퀀스 카운터 결합으로 유니크 보장
    const tmpId = `tmp-review-${Date.now()}-${tmpSeqRef.current++}`;
    const nr = {
      id:              tmpId,
      user:            currentUser?.name  ?? "나",
      region:          currentUser?.region ?? "—",
      rating:          data.rating,
      date:            `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`,
      type:            "시공 완료",
      content:         data.content,
      tags:            data.tags,
      beforeImageUrls: data.beforeImageUrls ?? [],
      afterImageUrls:  data.afterImageUrls  ?? [],
      imageUrls:       data.imageUrls        ?? [],
      reply:           null,
    };
    // Optimistic update — show immediately, rolled back on DB failure
    setReviews(r => [nr, ...r]);
    setNewId(nr.id);
    setTimeout(() => setNewId(null), 3000);

    const hasPhotos = (data.beforeImageUrls?.length ?? 0) + (data.afterImageUrls?.length ?? 0) > 0;
    const delta = calcTempDelta(data.rating, hasPhotos);
    setLocalTemp(t => clampTemp(t + delta));

    const log = { company_id: company?.id?.slice(0, 8), contract_id: contractId?.slice(0, 8) ?? null, db_ok: false, db_err: null, reward_ok: false };

    if (!company?.id) {
      // 회사 정보가 없으면 저장할 수 없으므로 낙관적 업데이트 롤백
      setReviews(r => r.filter(rv => rv.id !== tmpId));
      setLocalTemp(t => clampTemp(t - delta));
      submittingRef.current = false;
      return;
    }

    // 후기를 계약에 묶는다 — 화면이 계약 ID 를 못 받은 채 열리는 경로가 있어(C18 contract: null)
    // 요청 ID 로 계약을 찾아 채운다. 못 찾아도 후기는 저장한다.
    let reviewContractId = contractId ?? null;
    if (!reviewContractId && requestId) {
      try { reviewContractId = (await getEscrowWithPayouts(requestId)).data?.escrow?.id ?? null; } catch { /* 없음 */ }
    }
    log.contract_id = reviewContractId?.slice(0, 8) ?? null;

    try {
      const { data: reviewRow, error: reviewErr } = await createReview({
        company_id:        company.id,
        user_id:           currentUser?.id    ?? null,
        customer_id:       currentUser?.id    ?? null,
        request_id:        requestId          ?? null,
        contract_id:       reviewContractId,
        rating:            data.rating,
        content:           data.content,
        tags:              data.tags,
        before_image_urls: data.beforeImageUrls ?? [],
        after_image_urls:  data.afterImageUrls  ?? [],
        image_urls:        data.imageUrls       ?? [],
        user_name:         currentUser?.name    ?? "익명",
        region:            currentUser?.region  ?? null,
        space_type:        company.type         ?? null,
        status:            "published",
        // Part2 — 양방향 역할 + 구조화 점수
        reviewer_role:       "customer",
        target_role:         "company",
        budget_score:        data.budgetScore        ?? null,
        schedule_score:      data.scheduleScore      ?? null,
        communication_score: data.communicationScore ?? null,
        quality_score:       data.qualityScore       ?? null,
        would_recontract:    data.wouldRecontract    ?? null,
        review_photos:       data.imageUrls          ?? [],
      });

      log.db_ok  = !!reviewRow;
      log.db_err = reviewErr?.message ?? null;
      setSubmitDebug(log);

      if (reviewRow) {
        setAlreadyReviewed(true);
        const askUrl = ratingUrlFor(data.rating, {
          appStoreId: import.meta.env.VITE_APP_STORE_ID ?? "",
          playPublic: import.meta.env.VITE_PLAY_PUBLIC === "1",
        });
        if (askUrl) { recordAsk(); setStoreAsk(askUrl); }
        if (currentUser?.id && !currentUser?.isGuest) {
          const picks = suggestCarePresets(`${data.content ?? ""} ${(data.tags ?? []).join(" ")}`);
          if (picks.length) setCareSuggest({ items: picks, added: new Set(), err: null });
          // 견적서의 하자보수 기간 → «끝나기 전 점검» 한 줄을 맨 앞에(끝나기 한 달 전에 알림함·푸시로 알려 준다)
          if (requestId) {
            getEstimateForRequest(requestId).then(({ data: est }) => {
              const e = Array.isArray(est) ? est[0] : est;
              const w = warrantyCareItem({ warrantyNote: e?.warranty_note, companyName: company?.name, doneOn: kstDay() });
              if (!w) return;
              setCareSuggest((cs) => ({ items: [w, ...(cs?.items ?? [])], added: cs?.added ?? new Set(), err: cs?.err ?? null }));
            }).catch(() => {});
          }
        }
        if (Number(data.rating) >= 4 && currentUser?.id && !currentUser?.isGuest) {
          setRecommend({ pending: !!askUrl, code: null });
          myRefCode(currentUser.id).then(code => setRecommend(r => (r ? { ...r, code } : r))).catch(() => {});
        }
        // 공간온도는 서버가 후기 저장 때 올린다(migration 109) — 앱에서 직접 고치면 정책에 막혔다.

        // 신뢰 알림(3단계): 업체에 "후기 등록 · 공간온도 상승" 알림
        const ownerId = company.ownerId ?? company.owner_id ?? null;
        if (ownerId) {
          sendTieredNotification({
            userId:      ownerId,
            type:        "TEMP_UP",
            title:       "공간온도가 올랐어요",
            message:     `새 후기가 등록돼 공간온도가 올랐어요 🌡️ +${Number(delta || 0).toFixed(1)}°`,
            relatedId:   reviewRow.id,
            relatedType: "review",
            dedupe:      true,
          }).catch(() => {});
        }

        // 공사 후기 작성 보상 — 완료된 계약 1건당 1회 지급(+15). 중복방지는 useSpaceToken.earn이
        // 동일 action+description(계약 식별 포함) 존재 여부로 처리합니다.
        try {
          const rewardDesc = reviewContractId ? `공사 후기 작성 · 계약 ${reviewContractId}` : "공사 후기 작성";
          const granted = await onEarnToken?.("construction_review", rewardDesc);
          log.reward_ok = log.reward_ok || !!granted;
        } catch {}

        if (hasPhotos) {
          const { error: rewardErr } = await createReviewReward({
            review_id:   reviewRow.id,
            customer_id: currentUser?.id ?? null,
            reward_type: "COFFEE_COUPON",
            status:      "PENDING",
          }).catch(e => ({ error: e }));
          log.reward_ok  = !rewardErr;
          log.reward_err = rewardErr?.message ?? null;
          setSubmitDebug({ ...log });
        }
      } else {
        // DB 저장 실패 — 낙관적 업데이트 롤백
        setReviews(r => r.filter(rv => rv.id !== tmpId));
        setLocalTemp(t => clampTemp(t - delta));
      }
    } catch (e) {
      // 네트워크 등 예외로 throw된 경우에도 낙관적 업데이트 롤백
      log.db_err = e?.message ?? "submit_exception";
      setSubmitDebug({ ...log });
      setReviews(r => r.filter(rv => rv.id !== tmpId));
      setLocalTemp(t => clampTemp(t - delta));
    } finally {
      submittingRef.current = false;
    }
  };

  const photoReviewCount = reviews.filter(r =>
    (r.beforeImageUrls?.length ?? 0) > 0 ||
    (r.afterImageUrls?.length  ?? 0) > 0 ||
    (r.imageUrls?.length       ?? 0) > 0
  ).length;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>시공 후기</div>
          <div style={{ fontSize:12, color:C.text3 }}>{company.name} · {reviews.length}개</div>
        </div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>

        {careSuggest && (
          <div style={{ background:C.surface, border:`1px solid ${C.brandM}`, borderRadius:R.lg, padding:"12px 14px", marginBottom:S.lg }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <b style={{ fontSize:13.5, color:C.text1 }}>🏠 내 집 관리 수첩에 적어 둘까요?</b>
              <button onClick={() => setCareSuggest(null)} aria-label="닫기" style={{ background:"none", border:"none", color:C.text3, fontSize:16, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ fontSize:12, color:C.text3, marginTop:3 }}>오늘 날짜로 적어 두면 다음에 살펴볼 때를 알려 드려요</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
              {careSuggest.items.map((p) => {
                const done = careSuggest.added.has(p.kind);
                return (
                  <button key={p.kind} disabled={done}
                    onClick={async () => {
                      const row = p.kind === "warranty"
                        ? { kind: p.kind, label: p.label, cycle_months: p.cycle_months, done_on: p.done_on, memo: p.memo }
                        : { kind: p.kind, label: p.label, cycle_months: p.cycle, done_on: kstDay(), memo: `${company?.name ?? "업체"} 공사` .slice(0, 200) };
                      const res = await addHomeCareItem(currentUser.id, row).catch(() => null);
                      setCareSuggest((s) => s && (res?.data
                        ? { ...s, added: new Set([...s.added, p.kind]), err: null }
                        : { ...s, err: "지금은 적지 못했어요 · 마이 › 내 집 관리 수첩에서 적을 수 있어요" }));
                    }}
                    style={{ padding:"7px 11px", borderRadius:R.full, border:`1.5px solid ${done ? C.brand : C.bgWarm}`, background: done ? C.brandL : C.surface,
                      color: done ? C.brand : C.text2, fontSize:12.5, fontWeight:800, cursor: done ? "default" : "pointer" }}>
                    {done ? "✓ " : "+ "}{p.kind === "warranty" ? `🛠 하자보수 ${p.until}까지 · 한 달 전에 알림` : `${p.label} · ${p.cycle}개월`}
                  </button>
                );
              })}
            </div>
            {careSuggest.err && <div style={{ fontSize:12, color:"#B4432F", marginTop:6 }}>{careSuggest.err}</div>}
          </div>
        )}

        {/* Coupon incentive banner */}
        {SHOW_DEBUG_UI && submitDebug && (   /* 운영 화면에 [DEV:review-submit] 가 보이던 것(C18) — 개발 모드에서만 */
          <div style={{ background:"rgba(0,0,0,0.90)", color:"#0f0", borderRadius:8,
            padding:"8px 12px", fontSize:10, lineHeight:1.8, fontFamily:"monospace",
            marginBottom:S.md, overflowX:"auto" }}>
            [DEV:review-submit]<br/>
            <span style={{ color:"#4ff" }}>company: {submitDebug.company_id} | contract: {submitDebug.contract_id ?? "null"}</span><br/>
            <span style={{ color: submitDebug.db_ok ? "#0f0" : "#f66" }}>
              db_ok: {String(submitDebug.db_ok)} {submitDebug.db_err ? `| db_err: ${submitDebug.db_err}` : ""}
            </span><br/>
            <span style={{ color: submitDebug.reward_ok ? "#0f0" : "#888" }}>
              reward_ok: {String(!!submitDebug.reward_ok)} {submitDebug.reward_err ? `| reward_err: ${submitDebug.reward_err}` : ""}
            </span>
          </div>
        )}

        <div style={{ background:"#FFF8EC", borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, border:"1px solid #F5D97A",
          display:"flex", gap:S.md, alignItems:"flex-start" }}>
          <div style={{ fontSize:28, flexShrink:0 }}>☕</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"#8A5C00", marginBottom:4 }}>
              비포/애프터 포토리뷰 작성 시 커피쿠폰 지급
            </div>
            <div style={{ fontSize:12, color:"#A06B00", lineHeight:1.6 }}>
              공사 전·후 사진을 함께 등록하면 커피쿠폰을 드립니다.<br/>
              실제 거래 경험과 현장 사진이 포함된 리뷰에 한해 지급됩니다.
            </div>
          </div>
        </div>

        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.xxl, alignItems:"center", marginBottom:S.xl }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:52, fontWeight:900, color:C.text1, lineHeight:1 }}>{avg}</div>
              <Stars rating={Math.round(parseFloat(avg))} size={18} />
              <div style={{ fontSize:12, color:C.text3, marginTop:6 }}>{reviews.length}개</div>
            </div>
            <div style={{ flex:1 }}>
              {[5,4,3,2,1].map(star => {
                const cnt = reviews.filter(r => r.rating===star).length;
                const pct = reviews.length > 0 ? (cnt/reviews.length)*100 : 0;
                return (
                  <div key={star} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:11, color:C.text3, width:16, textAlign:"right" }}>{star}</span>
                    <div style={{ flex:1, height:6, background:C.bgWarm, borderRadius:R.full, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:C.gold, borderRadius:R.full }} />
                    </div>
                    <span style={{ fontSize:11, color:C.text3, width:20 }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Divider />
          <div style={{ marginTop:S.lg, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2 }}>🌡 공간온도</div>
            <TempBadge temp={localTemp} lg />
          </div>
          {photoReviewCount > 0 && (
            <div style={{ marginTop:S.sm, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:12, color:C.text3 }}>📷 포토리뷰</div>
              <span style={{ fontSize:12, fontWeight:700, color:C.brand }}>{photoReviewCount}건</span>
            </div>
          )}
        </div>

        {reviews.map(rv => (
          <ReviewCard key={rv.id} rv={rv} isNew={rv.id === newId} />
        ))}

        {reviews.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:13, color:C.text3 }}>아직 후기가 없어요</div>
          </div>
        )}
      </div>

      {/* 브랜드 클로징 문구 — 리뷰 작성 전 (공간사이 철학, 앱 내 3회 중 1회) */}
      {!alreadyReviewed && (
        <div style={{ padding:"0 20px 100px", textAlign:"center" }}>
          <div style={{ fontSize:13, color:"rgba(44,62,50,0.55)", letterSpacing:"-0.2px",
            fontWeight:500, lineHeight:1.7 }}>
            좋은 공간은 좋은 만남에서 시작됩니다.<br />
            함께해 주셔서 감사합니다.
          </div>
        </div>
      )}

      {!alreadyReviewed && (
        <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
          width:"calc(100% - 40px)", maxWidth:440, zIndex:10 }}>
          <button onClick={() => setShowModal(true)}
            style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
              border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15,
              cursor:"pointer", boxShadow:`0 8px 24px ${C.brand44}` }}>
            ✏️ 비포/애프터 포토리뷰 작성하기 (☕ 쿠폰 지급)
          </button>
        </div>
      )}

      {storeAsk && (
        <div role="dialog" aria-label="스토어 별점 부탁" style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.55)", zIndex:30,
          display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={closeStoreAsk}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:480, background:C.surface,
            borderRadius:"22px 22px 0 0", padding:"24px 22px 30px", textAlign:"center" }}>
            <div style={{ fontSize:30 }}>⭐</div>
            <div style={{ fontSize:17, fontWeight:800, color:C.text1, marginTop:6 }}>공간마켓이 도움이 됐다면</div>
            <div style={{ fontSize:13.5, color:C.text2, lineHeight:1.65, marginTop:8 }}>
              스토어에 별점을 남겨 주세요.<br />다음에 집을 고칠 이웃이 믿을 수 있는 업체를 더 쉽게 찾게 돼요.
            </div>
            <a href={storeAsk} target="_blank" rel="noopener noreferrer" onClick={closeStoreAsk}
              style={{ display:"block", marginTop:18, padding:"15px", borderRadius:R.lg, background:C.brand, color:"#fff",
                fontSize:15, fontWeight:800, textDecoration:"none" }}>별점 남기러 가기</a>
            <button onClick={closeStoreAsk} style={{ marginTop:10, width:"100%", padding:"12px", background:"none",
              border:"none", color:C.text3, fontSize:13.5, fontWeight:700, cursor:"pointer" }}>다음에 할게요</button>
          </div>
        </div>
      )}

      {recommend && !recommend.pending && !storeAsk && (
        <RecommendSheet company={company} code={recommend.code} onClose={() => setRecommend(null)} />
      )}

      {alreadyReviewed && (
        <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
          width:"calc(100% - 40px)", maxWidth:440, zIndex:10 }}>
          <div style={{ width:"100%", padding:S.xl, background:C.surface,
            border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, textAlign:"center",
            fontSize:13, fontWeight:700, color:C.text3 }}>
            ✅ 이 계약의 후기를 이미 작성하셨습니다
          </div>
        </div>
      )}

      {showModal && (
        <ReviewModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          companyId={company?.id}
          customerId={currentUser?.id}
          contractId={contractId ?? null}
        />
      )}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
