import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { Stars } from "../components/common";
import ImageViewerModal from "../components/ImageViewerModal";
import { getReviewsByUser } from "../lib/supabase";

// 의뢰인이 '작성한' 리뷰만 표시한다. 조회 기준은 작성자(user_id == currentUser)이며
// 업체ID(company_id) 기준 조회가 아니다. 업체 공개 후기 화면(ReviewScreen)과는 별개.
const normalize = (row, companies = []) => {
  const co = row.companies ?? null;
  const req = row.requests ?? null;
  const companyName =
    co?.name ?? companies.find(c => c.id === row.company_id)?.name ?? "업체";
  const projectName =
    [req?.area, req?.space_type].filter(Boolean).join(" ") || row.space_type || "시공";
  return {
    id:              row.id,
    companyName,
    projectName,
    date:            row.created_at?.slice(0, 10).replace(/-/g, ".") ?? "",
    rating:          row.rating ?? 0,
    content:         row.content ?? "",
    tags:            row.tags ?? [],
    reply:           row.reply ?? null,
    beforeImageUrls: row.before_image_urls ?? [],
    afterImageUrls:  row.after_image_urls ?? [],
    imageUrls:       row.image_urls ?? [],
  };
};

function MyReviewCard({ rv }) {
  const [showBefore, setShowBefore] = useState(false);
  const [viewer, setViewer] = useState(null);

  const hasAfter  = rv.afterImageUrls.length > 0;
  const hasBefore = rv.beforeImageUrls.length > 0;
  const hasLegacy = rv.imageUrls.length > 0;
  const hasPhotos = hasAfter || hasBefore || hasLegacy;
  const displayUrls = showBefore ? rv.beforeImageUrls : (hasAfter ? rv.afterImageUrls : rv.imageUrls);

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md, border:`1px solid ${C.bgWarm}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.sm }}>
        <div style={{ minWidth:0, marginRight:S.md }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{rv.companyName}</div>
          <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>{rv.date}</div>
        </div>
        <Stars rating={rv.rating} size={13} />
      </div>

      <div style={{ background:C.surface2, borderRadius:R.md, padding:"8px 12px", marginBottom:S.md, display:"inline-block" }}>
        <span style={{ fontSize:12, color:C.text3 }}>🏠 {rv.projectName}</span>
      </div>

      {rv.tags?.length > 0 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.md }}>
          {rv.tags.map(t => (
            <span key={t} style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>✓ {t}</span>
          ))}
        </div>
      )}

      <div style={{ fontSize:14, color:C.text2, lineHeight:1.7, marginBottom: hasPhotos ? S.md : 0 }}>{rv.content}</div>

      {hasPhotos && (
        <div>
          {hasAfter && hasBefore && (
            <div style={{ display:"flex", gap:6, marginBottom:S.sm }}>
              <button onClick={() => setShowBefore(false)}
                style={{ padding:"4px 12px", borderRadius:R.full, fontSize:11, fontWeight:800, border:"none", cursor:"pointer",
                  background: !showBefore ? C.brand : C.bgWarm, color: !showBefore ? "#fff" : C.text3 }}>AFTER</button>
              <button onClick={() => setShowBefore(true)}
                style={{ padding:"4px 12px", borderRadius:R.full, fontSize:11, fontWeight:800, border:"none", cursor:"pointer",
                  background: showBefore ? "#3A5FCC" : C.bgWarm, color: showBefore ? "#fff" : C.text3 }}>BEFORE</button>
            </div>
          )}
          {!hasBefore && hasAfter && <div style={{ fontSize:10, fontWeight:800, color:C.brand, marginBottom:4 }}>AFTER</div>}
          {!hasAfter && hasBefore && <div style={{ fontSize:10, fontWeight:800, color:"#3A5FCC", marginBottom:4 }}>BEFORE</div>}

          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {displayUrls.slice(0, 5).map((url, i) => (
              <img key={i} src={url} alt={`my-review-${i}`}
                onClick={() => setViewer({ images: displayUrls, index: i })}
                style={{ width:80, height:80, objectFit:"cover", borderRadius:R.md, border:`1px solid ${C.bgWarm}`, cursor:"pointer" }}
                onError={e => { e.target.style.display = "none"; }} />
            ))}
          </div>
        </div>
      )}

      {viewer && (
        <ImageViewerModal images={viewer.images} startIndex={viewer.index} onClose={() => setViewer(null)} />
      )}

      {rv.reply && (
        <div style={{ background:C.surface2, borderRadius:R.md, padding:S.md, marginTop:S.md, borderLeft:`3px solid ${C.brand}` }}>
          <div style={{ fontSize:11, fontWeight:800, color:C.brand, marginBottom:4 }}>🏠 업체 답글</div>
          <div style={{ fontSize:13, color:C.text2, lineHeight:1.6 }}>{rv.reply}</div>
        </div>
      )}
    </div>
  );
}

export default function CustomerReviewHistoryScreen({ currentUser, companies = [], onBack }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { console.log("[REVIEW_NAV] CustomerReviewHistoryScreen mounted (내 리뷰 목록) · user =", currentUser?.id ?? null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    getReviewsByUser(currentUser.id).then(({ data, error }) => {
      if (!alive) return;
      if (!error && Array.isArray(data)) {
        setReviews(data.map(row => normalize(row, companies)));
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>내 리뷰</div>
          <div style={{ fontSize:12, color:C.text3 }}>내가 작성한 후기 {reviews.length}개</div>
        </div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", fontSize:13, color:C.text3 }}>불러오는 중…</div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:13, color:C.text3 }}>아직 작성한 리뷰가 없어요</div>
          </div>
        ) : (
          reviews.map(rv => <MyReviewCard key={rv.id} rv={rv} />)
        )}
      </div>
    </div>
  );
}
