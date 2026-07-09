// ════════════════════════════════════════════════════════════════════
// 공간라운지 Space Media Surface — 콘텐츠 플랫폼 (Phase 7 · Phase 9 플랫폼화)
//
//   Phase 3~6 엔진을 사용자에게 "보여주는" 화면이다. 새 엔진을 만들지 않고, 이미 존재하는
//   순수 함수 엔진(composeMagazine/composeArchive/spaceSearch/composeTopicHub 등)을 그대로
//   호출한다. Phase 9 는 그 결과를 Platform Data Layer(platformData/recommendation)로 재구성해
//   "실제 콘텐츠 플랫폼"처럼 만든다(Engine Reuse · Additive · Regression Zero).
//
//   6개 표면: 매거진 · 추천 · 아카이브 · 지식검색 · 백과 · 저장
//   데이터는 기존 getLoungePosts("all")만 읽는다. DB/Supabase/API 무변경.
//   읽음/검색/저장 기록은 전부 localStorage(클라이언트)일 뿐이다.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { C, R, S, SHADOW } from "../constants";
import { CATEGORY_LABEL, LOUNGE_CATEGORIES } from "../constants/lounge";
import { getLoungePosts } from "../lib/supabase";
import { getBookmarkIds, getBookmarkEntries, toggleBookmark } from "../utils/bookmarks";
import { recordRead, getRecentReadIds, hasReadHistory } from "../utils/readHistory";
import { getRecentSearches, recordSearch, removeSearch } from "../utils/searchHistory";

// ── 기존 엔진(순수 함수) 호출만 — 수정 금지 ──
import { spaceSearch } from "../lib/spaceSearch";
import { KNOWLEDGE_CHAINS } from "../constants/knowledgeMap";
// ── Phase 9 Platform Data Layer(helper) — 엔진 결과 재구성만 ──
import {
  buildMagazineHome, buildArchiveView, ARCHIVE_SORTS,
  autocomplete, popularSearches, relatedSearches,
  buildEncyclopediaView, buildBookmarkView, BOOKMARK_SORTS,
} from "../lib/platformData";
import { recommendFromHistory } from "../lib/recommendation";

const TABS = [
  { id: "magazine",     label: "📖 매거진" },
  { id: "recommend",    label: "✨ 추천" },
  { id: "archive",      label: "🗂️ 아카이브" },
  { id: "search",       label: "🔍 지식검색" },
  { id: "encyclopedia", label: "🌐 백과" },
  { id: "bookmark",     label: "🔖 저장" },
];

const catLabel = (id) => CATEGORY_LABEL[id] || id;
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }); } catch { return ""; } };
// 요약(⑦) — 본문 마크다운 마커 제거 후 한 줄.
const excerptOf = (content = "") =>
  String(content).replace(/^#{1,6}\s+/gm, "").replace(/^[-•]\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 100);

export default function SpaceMediaScreen({ onBack, onOpenPost }) {
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("magazine");
  const [bookmarks, setBookmarks] = useState(() => new Set(getBookmarkIds()));
  const [bmEntries, setBmEntries] = useState(() => getBookmarkEntries());
  const [readIds, setReadIds]     = useState(() => getRecentReadIds(30));

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await getLoungePosts("all");
        if (alive) setPosts(Array.isArray(data) ? data.filter((p) => p && p.id != null && p.title) : []);
      } catch { if (alive) setPosts([]); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const byId = useMemo(() => { const m = new Map(); posts.forEach((p) => m.set(String(p.id), p)); return m; }, [posts]);

  // 글 열기 — 로컬 읽음 기록(추천/이어서 읽기용) 후 기존 상세 화면으로.
  const open = (id) => {
    recordRead(id);
    setReadIds(getRecentReadIds(30));
    const full = byId.get(String(id));
    onOpenPost?.(full ?? { id, _deeplink: true });
  };

  const onToggleBookmark = (id) => {
    const next = toggleBookmark(id);
    setBookmarks(new Set(next));
    setBmEntries(getBookmarkEntries());
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", paddingBottom: 48 }}>
      {/* 헤더 */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.brandD, color: "#fff", padding: `${S.md}px ${S.lg}px`, boxShadow: SHADOW.soft }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: R.md, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>←</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Space 매거진</div>
            <div style={{ fontSize: 10.5, color: "#B5D4C5" }}>글과 사진으로 세상을 기록합니다 — Space is Everything</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: S.md, overflowX: "auto" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ whiteSpace: "nowrap", padding: "6px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: tab === t.id ? "#fff" : "rgba(255,255,255,0.12)", color: tab === t.id ? C.brandD : "#fff", border: "none" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: S.lg, maxWidth: 920, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.text3 }}>공간 이야기를 불러오는 중…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.text3 }}>아직 표시할 공간 이야기가 없습니다.</div>
        ) : (
          <>
            {tab === "magazine"     && <MagazineSurface     posts={posts} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} savedIds={bmEntries.map((e) => e.id)} readIds={readIds} />}
            {tab === "recommend"    && <RecommendSurface    posts={posts} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} readIds={readIds} onGoMagazine={() => setTab("magazine")} />}
            {tab === "archive"      && <ArchiveSurface      posts={posts} open={open} />}
            {tab === "search"       && <SearchSurface       posts={posts} open={open} />}
            {tab === "encyclopedia" && <EncyclopediaSurface posts={posts} open={open} />}
            {tab === "bookmark"     && <BookmarkSurface     posts={posts} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} entries={bmEntries} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── 공용 조각 ────────────────────────────────────────────────────────
function SectionTitle({ children, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginBottom: S.sm, marginTop: S.xl }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, letterSpacing: -0.3 }}>{children}</div>
        {sub && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function BookmarkBtn({ id, bookmarks, onToggleBookmark }) {
  const on = bookmarks.has(String(id));
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggleBookmark(id); }} title={on ? "저장 해제" : "저장"}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, color: on ? C.gold : C.text4 }}>
      {on ? "🔖" : "🏷️"}
    </button>
  );
}

function MagCard({ card, open, bookmarks, onToggleBookmark }) {
  return (
    <div onClick={() => open(card.id)}
      style={{ minWidth: 200, maxWidth: 200, background: "#fff", borderRadius: R.lg, overflow: "hidden", border: `1px solid ${C.bgWarm}`, cursor: "pointer", boxShadow: SHADOW.soft }}>
      <div style={{ height: 120, background: C.surface2, position: "relative" }}>
        {card.cover
          ? <img src={card.cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.text4, fontSize: 12 }}>{catLabel(card.category)}</div>}
        {bookmarks && (
          <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.9)", borderRadius: R.full, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookmarkBtn id={card.id} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />
          </div>
        )}
      </div>
      <div style={{ padding: 11 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 36 }}>{card.title}</div>
        <div style={{ fontSize: 10, color: C.text3, marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: C.brand, fontWeight: 700 }}>{catLabel(card.category)}</span>
          <span>· {card.readingLabel}</span>
          {card.author?.label && <span>· {card.author.label}</span>}
        </div>
      </div>
    </div>
  );
}

function CardRow({ title, cards, open, bookmarks, onToggleBookmark, sub }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div>
      <SectionTitle sub={sub}>{title}</SectionTitle>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {cards.map((c) => <MagCard key={c.id} card={c} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />)}
      </div>
    </div>
  );
}

function PostRow({ post, open, bookmarks, onToggleBookmark, excerpt, badge, reason }) {
  const cover = Array.isArray(post.image_urls) ? post.image_urls[0] : null;
  return (
    <div onClick={() => open(post.id)}
      style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.bgWarm}`, cursor: "pointer" }}>
      {cover && <img src={cover} alt="" loading="lazy" style={{ width: 64, height: 64, borderRadius: R.md, objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text1, lineHeight: 1.4 }}>{post.title}</div>
        {excerpt && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{excerpt}</div>}
        <div style={{ fontSize: 10.5, color: C.text3, marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: C.brand, fontWeight: 700 }}>{catLabel(post.category)}</span>
          {badge && <span style={{ background: C.brandL, color: C.brandD, borderRadius: R.full, padding: "1px 6px", fontSize: 9.5, fontWeight: 700 }}>{badge}</span>}
          <span>· 👁 {post.view_count ?? 0}</span>
          <span>· ❤ {post.like_count ?? 0}</span>
          {post.created_at && <span>· {fmtDate(post.created_at)}</span>}
        </div>
        {reason && <div style={{ fontSize: 10, color: C.brand, marginTop: 3 }}>↳ {reason}</div>}
      </div>
      {bookmarks && <div style={{ alignSelf: "center" }}><BookmarkBtn id={post.id} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} /></div>}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 12, padding: "5px 11px", borderRadius: R.full, cursor: "pointer", fontWeight: 700,
        background: active ? C.brand : "#fff", color: active ? "#fff" : C.text2, border: `1px solid ${active ? C.brand : C.bgWarm}` }}>
      {children}
    </button>
  );
}

// ── 1) Magazine ──────────────────────────────────────────────────────
function MagazineSurface({ posts, open, bookmarks, onToggleBookmark, savedIds, readIds }) {
  const mag = useMemo(() => buildMagazineHome(posts, { savedIds, recentReadIds: readIds }), [posts, savedIds, readIds]);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: C.text2, marginBottom: S.sm }}>
        <span style={{ background: C.surface2, borderRadius: R.full, padding: "4px 10px" }}>🌡️ 라운지 온도 {mag.insight.temperature}°</span>
        <span style={{ background: C.surface2, borderRadius: R.full, padding: "4px 10px" }}>전체 {mag.insight.totalPosts}글</span>
        <span style={{ background: C.surface2, borderRadius: R.full, padding: "4px 10px" }}>오늘 {mag.insight.todayPosts}글</span>
      </div>

      {/* Hero — 큰 사진 + 큰 타이포(매거진 커버) */}
      {mag.hero && (
        <div onClick={() => open(mag.hero.id)}
          style={{ borderRadius: R.xl, overflow: "hidden", cursor: "pointer", position: "relative", marginBottom: S.lg, boxShadow: SHADOW.card, background: C.brandD, minHeight: 200 }}>
          {mag.hero.cover && <img src={mag.hero.cover} alt="" style={{ width: "100%", height: 260, objectFit: "cover", opacity: 0.9 }} />}
          <div style={{ position: mag.hero.cover ? "absolute" : "static", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: S.xl, background: mag.hero.cover ? "linear-gradient(transparent, rgba(0,0,0,0.72))" : "transparent" }}>
            <div style={{ color: "#fff", fontSize: 10.5, fontWeight: 700, opacity: 0.9 }}>오늘의 Space · {catLabel(mag.hero.category)}</div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, lineHeight: 1.32, marginTop: 6, letterSpacing: -0.4 }}>{mag.hero.title}</div>
            <div style={{ color: "#e6ede9", fontSize: 11.5, marginTop: 8 }}>{mag.hero.readingLabel}{mag.hero.author?.label ? ` · ${mag.hero.author.label}` : ""}</div>
          </div>
        </div>
      )}

      {/* Editor's Pick */}
      {mag.editorsPick && (
        <div onClick={() => open(mag.editorsPick.id)}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${C.gold}`, borderRadius: R.lg, padding: "12px 14px", cursor: "pointer", marginBottom: S.md }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 800, letterSpacing: 0.5 }}>EDITOR'S PICK</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{mag.editorsPick.title}</div>
          </div>
          <span style={{ fontSize: 10.5, color: C.text3 }}>{mag.editorsPick.readingLabel}</span>
        </div>
      )}

      {/* Trending(상승) */}
      {mag.trending?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>🔥 상승</span>
          {mag.trending.map((t) => (
            <span key={t.category ?? t.label} style={{ fontSize: 11, background: C.pinkL, color: C.pinkD, borderRadius: R.full, padding: "3px 9px" }}>{catLabel(t.category) ?? t.label}</span>
          ))}
        </div>
      )}

      {/* 이어서 읽기 */}
      <CardRow title="이어서 읽기" sub="최근에 열어본 공간 이야기" cards={mag.continueReading} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />

      {/* 엔진 섹션(오늘의 Space/Deep/인기/이번 주 Best/새로운 글) */}
      {mag.sections.map((sec) => (
        <CardRow key={sec.id} title={sec.title} cards={sec.cards} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />
      ))}

      {/* 많이 저장된 글 */}
      <CardRow title="많이 저장된 글" sub="이 기기에서 저장한 이야기" cards={mag.mostSaved} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />

      {/* 카테고리 추천 */}
      {mag.categoryPicks.length > 0 && (
        <>
          <SectionTitle sub="관심 있는 공간 주제로 바로 들어가기">카테고리 추천</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {mag.categoryPicks.map((c) => (
              <span key={c.category} style={{ fontSize: 12, background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "6px 12px", color: C.text2 }}>
                {c.label} <span style={{ color: C.brand, fontWeight: 700 }}>{c.count}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 2) Recommendation ────────────────────────────────────────────────
function RecommendSurface({ posts, open, bookmarks, onToggleBookmark, readIds, onGoMagazine }) {
  const recs = useMemo(() => recommendFromHistory(posts, readIds, { n: 20 }), [posts, readIds]);
  const hasHistory = hasReadHistory();
  return (
    <div>
      <SectionTitle sub={hasHistory ? "최근 읽은 글과 공간 관점으로 연결된 이야기입니다." : "아직 읽은 글이 없어 인기 있는 공간 이야기를 보여드립니다."}>
        ✨ 당신을 위한 추천
      </SectionTitle>
      {!hasHistory && (
        <div onClick={onGoMagazine} style={{ background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: "12px 14px", marginBottom: S.md, cursor: "pointer", fontSize: 12, color: C.brandD }}>
          매거진에서 글을 몇 개 읽어보면, 당신의 공간 취향에 맞는 추천이 채워집니다 →
        </div>
      )}
      {recs.length === 0
        ? <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 13 }}>추천할 이야기가 아직 없습니다.</div>
        : recs.map((p) => (
          <PostRow key={p.id} post={p} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark}
            excerpt={excerptOf(p.content)} reason={p._reasonFrom ? `‘${p._reasonFrom}’ 을(를) 읽어서` : null} />
        ))}
    </div>
  );
}

// ── 3) Archive ───────────────────────────────────────────────────────
function ArchiveSurface({ posts, open }) {
  const [sort, setSort]   = useState("recent");
  const [bucket, setBucket] = useState(null);
  const [category, setCategory] = useState(null);
  const [tag, setTag]     = useState(null);
  const view = useMemo(() => buildArchiveView(posts, { sort, bucket, category, tag }), [posts, sort, bucket, category, tag]);
  const filterActive = bucket || category || tag;
  const clear = () => { setBucket(null); setCategory(null); setTag(null); };

  return (
    <div>
      <SectionTitle sub={`쌓여가는 ${view.total}개의 공간 이야기 — 시간이 지날수록 가치가 쌓입니다.`}
        right={<div style={{ display: "flex", gap: 5 }}>{ARCHIVE_SORTS.map((s) => <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</Chip>)}</div>}>
        🗂️ 아카이브
      </SectionTitle>

      {/* 시간 축 칩 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
        {view.byTime.filter((b) => b.count > 0).map((b) => (
          <Chip key={b.id} active={bucket === b.id} onClick={() => setBucket(bucket === b.id ? null : b.id)}>{b.label} {b.count}</Chip>
        ))}
      </div>

      {/* 카테고리 칩 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.sm }}>
        {view.byCategory.slice(0, 16).map((c) => (
          <Chip key={c.category} active={category === c.category} onClick={() => setCategory(category === c.category ? null : c.category)}>{c.label} {c.count}</Chip>
        ))}
      </div>

      {/* 태그 클라우드 */}
      {view.byTag.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.md }}>
          {view.byTag.slice(0, 24).map((t) => (
            <button key={t.tag} onClick={() => setTag(tag === t.tag ? null : t.tag)}
              style={{ fontSize: 11, color: tag === t.tag ? "#fff" : C.brandD, background: tag === t.tag ? C.brand : C.brandL, border: "none", borderRadius: R.full, padding: "3px 9px", cursor: "pointer" }}>
              #{t.tag}
            </button>
          ))}
        </div>
      )}

      {/* 결과 목록 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: S.md, marginBottom: 2 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text1 }}>
          {filterActive ? "선택한 조건" : "전체"} · {view.filteredCount}글
        </div>
        {filterActive && <button onClick={clear} style={{ fontSize: 11, color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>필터 해제</button>}
      </div>
      {view.list.length === 0
        ? <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 12.5 }}>조건에 맞는 글이 없습니다.</div>
        : view.list.slice(0, 50).map((p) => <PostRow key={p.id} post={p} open={open} />)}
    </div>
  );
}

// ── 4) Search ────────────────────────────────────────────────────────
function SearchSurface({ posts, open }) {
  const [q, setQ]         = useState("");
  const [submitted, setSubmitted] = useState("");
  const [recents, setRecents] = useState(() => getRecentSearches());
  const popular = useMemo(() => popularSearches(posts, { limit: 12 }), [posts]);
  const suggestions = useMemo(() => (q.trim() ? autocomplete(q, posts, { limit: 8 }) : []), [q, posts]);
  const res = useMemo(() => (submitted.trim() ? spaceSearch(submitted, posts, { limit: 30 }) : null), [submitted, posts]);
  const related = useMemo(() => relatedSearches(res), [res]);

  const run = (query) => {
    const v = String(query ?? "").trim();
    setQ(v); setSubmitted(v);
    if (v) setRecents(recordSearch(v));
  };
  const drop = (query) => setRecents(removeSearch(query));

  return (
    <div>
      <SectionTitle sub="게시글이 아니라 '지식'을 검색합니다. 직접 매칭이 없어도 공간 관점으로 연결된 글을 찾아줍니다.">🔍 지식 검색</SectionTitle>
      <form onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예) 신혼집, 누수, 창업, 금리…"
          style={{ width: "100%", padding: "13px 15px", border: `1.5px solid ${C.brandM}`, borderRadius: R.lg, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      </form>

      {/* 자동완성 */}
      {q.trim() && suggestions.length > 0 && !res && (
        <div style={{ marginTop: 6, background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.md, overflow: "hidden" }}>
          {suggestions.map((s) => (
            <div key={s} onClick={() => run(s)} style={{ padding: "9px 12px", fontSize: 13, color: C.text2, borderBottom: `1px solid ${C.surface2}`, cursor: "pointer" }}>🔎 {s}</div>
          ))}
        </div>
      )}

      {/* 검색 전 — 최근/인기 검색 */}
      {!res && (
        <>
          {recents.length > 0 && (
            <>
              <SectionTitle>최근 검색</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {recents.map((r) => (
                  <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "5px 8px 5px 11px" }}>
                    <span onClick={() => run(r)} style={{ cursor: "pointer", color: C.text2 }}>{r}</span>
                    <span onClick={() => drop(r)} style={{ cursor: "pointer", color: C.text4, fontSize: 13 }}>×</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <SectionTitle sub="지금 공간라운지에서 자주 등장하는 주제">인기 검색</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {popular.map((p, i) => (
              <button key={p} onClick={() => run(p)} style={{ fontSize: 12, background: C.brandL, color: C.brandD, border: "none", borderRadius: R.full, padding: "5px 11px", cursor: "pointer", fontWeight: 700 }}>
                {i < 3 ? "🔥 " : ""}{p}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 검색 결과 */}
      {res && (
        <>
          <div style={{ fontSize: 11.5, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>
            공간 관점: <b style={{ color: C.brand }}>{res.spaceKeyword}</b>
            {res.chain?.length > 0 && <span> · {res.chain.map((c) => catLabel(c)).join(" → ")}</span>}
          </div>
          {related.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
              <span style={{ fontSize: 11, color: C.text3, alignSelf: "center" }}>연관 검색</span>
              {related.map((r) => <button key={r} onClick={() => run(r)} style={{ fontSize: 11, background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "3px 9px", color: C.text2, cursor: "pointer" }}>{r}</button>)}
            </div>
          )}
          {res.categories.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
              {res.categories.map((c) => <span key={c.category} style={{ fontSize: 11, background: C.surface2, borderRadius: R.full, padding: "3px 9px", color: C.text2 }}>{c.label} {c.count}</span>)}
            </div>
          )}
          {res.results.length === 0
            ? <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>“{res.query}”에 대한 결과가 없습니다.</div>
            : res.results.map((p) => <PostRow key={p.id} post={p} open={open} excerpt={p._excerpt} badge={p._matched === "graph" ? "공간연결" : null} />)}
        </>
      )}
    </div>
  );
}

// ── 5) Encyclopedia ──────────────────────────────────────────────────
function EncyclopediaSurface({ posts, open }) {
  const cats = useMemo(() => {
    const present = new Set(posts.map((p) => p.category));
    return LOUNGE_CATEGORIES.filter((c) => c.group && present.has(c.id));
  }, [posts]);
  const [cat, setCat] = useState(null);
  const view = useMemo(() => (cat ? buildEncyclopediaView(cat, posts, { topN: 8 }) : null), [cat, posts]);

  return (
    <div>
      <SectionTitle sub="하나의 주제에서 관련 주제·관련 글·관련 키워드로 백과사전처럼 뻗어나갑니다. 모든 길은 공간으로 이어집니다.">🌐 Space 백과</SectionTitle>

      {/* 지식 사슬 */}
      <div style={{ marginBottom: S.md }}>
        {KNOWLEDGE_CHAINS.map((ch) => (
          <div key={ch.id} style={{ background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "9px 11px", marginBottom: 6 }}>
            <div style={{ fontSize: 10.5, color: C.text3, marginBottom: 4 }}>{ch.label}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              {ch.nodes.map((n, i) => (
                <span key={n + i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => setCat(n)} style={{ fontSize: 11.5, background: cat === n ? C.brand : C.brandL, color: cat === n ? "#fff" : C.brandD, border: "none", borderRadius: R.full, padding: "3px 9px", cursor: "pointer", fontWeight: 700 }}>{catLabel(n)}</button>
                  {i < ch.nodes.length - 1 && <span style={{ color: C.text4 }}>→</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 카테고리 선택 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.md }}>
        {cats.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
      </div>

      {view && (
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, letterSpacing: -0.3 }}>{view.label} <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>· {view.count}글</span></div>
          {view.cluster && <div style={{ fontSize: 11.5, color: C.brand, marginTop: 2 }}>{view.cluster.label}</div>}

          {/* 대표글 */}
          {view.representative && (
            <div onClick={() => open(view.representative.id)} style={{ marginTop: S.md, background: "#fff", border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: "12px 14px", cursor: "pointer" }}>
              <div style={{ fontSize: 10, color: C.brand, fontWeight: 800 }}>대표 글</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginTop: 2 }}>{view.representative.title}</div>
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 4 }}>{excerptOf(view.representative.content)}</div>
            </div>
          )}

          {/* 관련 키워드 */}
          {view.keywords.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginTop: S.md, marginBottom: 4 }}>관련 키워드</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {view.keywords.map((k) => <span key={k.tag} style={{ fontSize: 11, background: C.brandL, color: C.brandD, borderRadius: R.full, padding: "3px 9px" }}>#{k.tag}</span>)}
              </div>
            </>
          )}

          {/* 관련 주제(카테고리) */}
          {view.relatedCategories.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginTop: S.md, marginBottom: 4 }}>지식으로 연결된 주제</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {view.relatedCategories.map((rc) => (
                  <button key={rc.category} onClick={() => setCat(rc.category)} style={{ fontSize: 11.5, background: C.brandL, color: C.brandD, border: "none", borderRadius: R.full, padding: "4px 10px", cursor: "pointer" }}>
                    {rc.label}{rc.count > 0 ? <b> {rc.count}</b> : ""}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 관련 글(대표글 기준 Space Graph) */}
          {view.relatedArticles.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginTop: S.md, marginBottom: 4 }}>관련 글</div>
              {view.relatedArticles.map((p) => <PostRow key={p.id} post={p} open={open} />)}
            </>
          )}

          {/* 대표 글 목록 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginTop: S.md, marginBottom: 4 }}>이 주제의 글</div>
          {view.topPosts.length === 0
            ? <div style={{ fontSize: 12, color: C.text3, padding: "10px 0" }}>이 주제의 글이 아직 없습니다.</div>
            : view.topPosts.map((p) => <PostRow key={p.id} post={p} open={open} />)}
        </div>
      )}
      {!view && <div style={{ textAlign: "center", padding: "24px 0", color: C.text3, fontSize: 12.5 }}>위 사슬이나 카테고리를 선택해 백과를 펼쳐보세요.</div>}
    </div>
  );
}

// ── 6) Bookmark ──────────────────────────────────────────────────────
function BookmarkSurface({ posts, open, bookmarks, onToggleBookmark, entries }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [category, setCategory] = useState("all");
  const view = useMemo(() => buildBookmarkView(posts, entries, { q, sort, category }), [posts, entries, q, sort, category]);

  return (
    <div>
      <SectionTitle sub="이 기기에 저장한 공간 이야기입니다(로컬 저장)."
        right={<div style={{ display: "flex", gap: 5 }}>{BOOKMARK_SORTS.map((s) => <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</Chip>)}</div>}>
        🔖 저장한 이야기 ({view.total})
      </SectionTitle>

      {view.total === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.text3, fontSize: 13 }}>아직 저장한 글이 없습니다.<br />매거진·검색에서 🏷️ 를 눌러 저장해보세요.</div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="저장한 글 검색"
            style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: S.sm }} />
          {view.categories.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.sm }}>
              <Chip active={category === "all"} onClick={() => setCategory("all")}>전체 {view.total}</Chip>
              {view.categories.map((c) => <Chip key={c.category} active={category === c.category} onClick={() => setCategory(c.category)}>{c.label} {c.count}</Chip>)}
            </div>
          )}
          {view.saved.length === 0
            ? <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 12.5 }}>조건에 맞는 저장 글이 없습니다.</div>
            : view.saved.map((p) => <PostRow key={p.id} post={p} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} excerpt={excerptOf(p.content)} />)}
        </>
      )}
    </div>
  );
}
