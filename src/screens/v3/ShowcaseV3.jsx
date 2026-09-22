// ─────────────────────────────────────────────────────
// 시공 사례 v3 — 모음(격자) + 상세.
//
// 예전에는 홈의 사진·「더보기」가 업체 상세(portfolio)로 갔는데, 어느 업체인지 고르지 않은
// 채로 넘어가 빈 화면이 떴다. 사례는 리뷰에서 나오므로 리뷰 자체를 보여주는 화면을 따로 둔다.
//  · 모음: 공간 유형 칩(실제 있는 유형만) + 2열 사진 격자
//  · 상세: 큰 사진(전/후 전환) · 사진 넘기기 · 후기 본문 · 「비슷하게 견적 받기」 · 업체 보기(연결될 때만)
// ─────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { Page, Card, EmptyInvite, FoldText } from "../../components/v3/ui";
import { C, R, S, SHADOW } from "../../constants";
import { showcaseTypes } from "../../lib/showcases";

function TopBar({ title, onBack }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: C.bg, display: "flex", alignItems: "center",
      gap: S.sm, padding: `${S.md}px 0`, margin: `0 -${S.xl}px`, paddingLeft: S.lg, paddingRight: S.lg,
      borderBottom: `1px solid ${C.bgWarm}` }}>
      <button onClick={onBack} aria-label="뒤로" style={{ background: "none", border: "none", fontSize: 22,
        lineHeight: 1, cursor: "pointer", color: C.text1, padding: 4 }}>←</button>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, letterSpacing: "-0.3px" }}>{title}</div>
    </div>
  );
}

function Stars({ value }) {
  if (!value) return null;
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return <span aria-label={`별점 ${v}점`} style={{ color: "#F5A524", fontSize: 13, letterSpacing: 1 }}>{"★".repeat(v)}<span style={{ color: C.bgWarm }}>{"★".repeat(5 - v)}</span></span>;
}

function Img({ src, style, onFail }) {
  return src
    ? <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; onFail?.(src); }}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />
    : null;
}

function Detail({ item, onBack, onRequest, onOpenCompany }) {
  // 열리지 않는 사진(삭제·만료된 주소)은 넘기기 목록에서 뺀다 — 빈 칸이 남지 않게.
  const [failed, setFailed] = useState([]);
  const onFail = (u) => setFailed((f) => (f.includes(u) ? f : [...f, u]));
  const all = item.gallery.length ? item.gallery : [item.photo];
  const photos = all.filter((u) => !failed.includes(u)).length ? all.filter((u) => !failed.includes(u)) : [item.photo];
  const [idx, setIdx] = useState(0);
  const [showBefore, setShowBefore] = useState(false);
  const cur = showBefore && item.before ? item.before : photos[Math.min(idx, photos.length - 1)];

  return (
    <Page>
      <TopBar title={item.title} onBack={onBack} />

      <div style={{ margin: `0 -${S.xl}px` }}>
        <div style={{ position: "relative", aspectRatio: "4 / 3", background: C.bgWarm }}>
          <Img src={cur} onFail={showBefore ? undefined : onFail} />
          {item.before && (
            <div style={{ position: "absolute", left: S.md, top: S.md, display: "flex", background: "rgba(0,0,0,0.45)",
              borderRadius: R.full, padding: 3 }}>
              {[["시공 후", false], ["시공 전", true]].map(([label, b]) => (
                <button key={label} onClick={() => setShowBefore(b)}
                  style={{ border: "none", borderRadius: R.full, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer",
                    background: showBefore === b ? "#fff" : "transparent", color: showBefore === b ? C.text1 : "#fff" }}>{label}</button>
              ))}
            </div>
          )}
          {!showBefore && photos.length > 1 && (
            <div style={{ position: "absolute", right: S.md, bottom: S.md, background: "rgba(0,0,0,0.5)", color: "#fff",
              borderRadius: R.full, padding: "4px 10px", fontSize: 11.5, fontWeight: 700 }}>{Math.min(idx, photos.length - 1) + 1} / {photos.length}</div>
          )}
        </div>
        {!showBefore && photos.length > 1 && (
          <div style={{ display: "flex", gap: 6, padding: `${S.sm}px ${S.xl}px 0`, overflowX: "auto" }}>
            {photos.map((p, i) => (
              <button key={p + i} onClick={() => setIdx(i)} aria-label={`사진 ${i + 1}`}
                style={{ flex: "0 0 64px", height: 48, padding: 0, borderRadius: R.md, overflow: "hidden", cursor: "pointer",
                  border: i === Math.min(idx, photos.length - 1) ? `2px solid ${C.brand}` : `1px solid ${C.bgWarm}`, background: C.bgWarm }}>
                <Img src={p} onFail={onFail} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap" }}>
          {item.spaceType && <span style={{ fontSize: 11.5, fontWeight: 800, color: C.brand, background: C.brandL,
            borderRadius: R.full, padding: "4px 10px" }}>{item.spaceType}</span>}
          {item.region && <span style={{ fontSize: 12, color: C.text3 }}>{item.region}</span>}
          <Stars value={item.rating} />
        </div>
        {item.company && <div style={{ marginTop: S.sm, fontSize: 13, color: C.text2 }}>시공 업체 <b style={{ color: C.text1 }}>{item.company}</b></div>}
      </div>

      {item.text ? (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.text3, marginBottom: 6 }}>의뢰인 후기</div>
          <FoldText text={item.text} lines={6} minChars={220} style={{ fontSize: 14, color: C.text1, lineHeight: 1.75 }} />
          <div style={{ fontSize: 12, color: C.text4, marginTop: S.sm }}>{item.author}</div>
        </Card>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        <button onClick={() => onRequest?.(item.spaceType)}
          style={{ height: 50, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15,
            fontWeight: 800, cursor: "pointer", boxShadow: SHADOW.brand }}>
          이런 공사, 무료로 견적 받기
        </button>
        {item.companyId && onOpenCompany && (
          <button onClick={() => onOpenCompany(item.companyId)}
            style={{ height: 46, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text1,
              fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            이 업체의 다른 시공 보기
          </button>
        )}
        <div style={{ fontSize: 11.5, color: C.text4, textAlign: "center" }}>견적은 무료이고, 비교만 해 봐도 괜찮아요.</div>
      </div>
    </Page>
  );
}

export default function ShowcaseV3({ items = [], initialId = null, onBack, onRequest, onOpenCompany }) {
  const [openId, setOpenId] = useState(initialId);
  const [type, setType] = useState(null);
  const types = useMemo(() => showcaseTypes(items), [items]);
  const list = type ? items.filter((x) => x.spaceType === type) : items;
  const open = openId ? items.find((x) => x.id === openId) : null;

  // 홈에서 사진을 눌러 바로 상세로 들어왔다면, 뒤로 가기는 홈으로 돌아간다.
  if (open) return <Detail item={open} onBack={() => (initialId ? onBack?.() : setOpenId(null))} onRequest={onRequest} onOpenCompany={onOpenCompany} />;

  return (
    <Page>
      <TopBar title="시공 사례" onBack={onBack} />
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginTop: -S.sm }}>
        공간마켓에서 공사를 마친 의뢰인의 사진과 후기예요. 마음에 드는 사례를 눌러 비슷한 공사를 요청해 보세요.
      </div>

      {types.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: `-${S.sm}px -${S.xl}px 0`, padding: `0 ${S.xl}px` }}>
          {[null, ...types].map((t) => (
            <button key={t ?? "all"} onClick={() => setType(t)}
              style={{ flex: "0 0 auto", border: `1px solid ${type === t ? C.brand : C.bgWarm}`, borderRadius: R.full,
                padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                background: type === t ? C.brand : C.surface, color: type === t ? "#fff" : C.text2 }}>{t ?? "전체"}</button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyInvite text="아직 보여드릴 시공 사례가 없어요." cta="무료 견적 받기" onCta={() => onRequest?.(null)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm }}>
          {list.map((x) => (
            <button key={x.id} onClick={() => setOpenId(x.id)}
              style={{ padding: 0, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden", background: C.surface,
                cursor: "pointer", textAlign: "left", boxShadow: SHADOW.soft }}>
              <div style={{ aspectRatio: "1 / 1", background: C.bgWarm }}><Img src={x.photo} /></div>
              <div style={{ padding: `${S.sm}px ${S.md}px ${S.md}px` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.title}</div>
                {x.meta && <div style={{ fontSize: 11, color: C.text3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.meta}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}
