// ════════════════════════════════════════════════════════════════════
// 공간라운지 Space Media Surface (Phase 7)
//
//   Phase 3~6 에서 만든 엔진을 사용자에게 "보여주는" 화면이다. 새 엔진을 만들지 않고,
//   이미 존재하는 순수 함수 엔진을 그대로 호출해 UI 로만 연결한다(Engine Reuse · Additive).
//
//   5개 표면:
//     1) Magazine   — composeMagazine()      (매거진 홈)
//     2) Archive    — composeArchive()        (시간/카테고리/태그 아카이브)
//     3) Search     — spaceSearch()           (공간 관점 지식 검색)
//     4) Encyclopedia — composeTopicHub()/KNOWLEDGE_CHAINS (지식 백과)
//     5) Bookmark   — localStorage(bookmarks) (저장한 공간 이야기)
//
//   데이터는 기존 getLoungePosts("all")(공개 라운지 글)만 읽는다. DB/Supabase 무변경.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { C, R, S, SHADOW } from "../constants";
import { CATEGORY_LABEL, LOUNGE_CATEGORIES } from "../constants/lounge";
import { getLoungePosts } from "../lib/supabase";
import { getBookmarkIds, toggleBookmark } from "../utils/bookmarks";

// ── 기존 엔진(순수 함수) 호출만 — 수정 금지 ──
import { composeMagazine } from "../lib/magazine";
import { composeArchive } from "../lib/archive";
import { spaceSearch } from "../lib/spaceSearch";
import { composeTopicHub } from "../lib/topicHub";
import { KNOWLEDGE_CHAINS } from "../constants/knowledgeMap";

const TABS = [
  { id: "magazine",     label: "📖 매거진" },
  { id: "archive",      label: "🗂️ 아카이브" },
  { id: "search",       label: "🔍 지식검색" },
  { id: "encyclopedia", label: "🌐 백과" },
  { id: "bookmark",     label: "🔖 저장" },
];

const catLabel = (id) => CATEGORY_LABEL[id] || id;
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }); } catch { return ""; } };

export default function SpaceMediaScreen({ onBack, onOpenPost }) {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("magazine");
  const [bookmarks, setBookmarks] = useState(() => new Set(getBookmarkIds()));

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
  const open = (id) => { const full = byId.get(String(id)); onOpenPost?.(full ?? { id, _deeplink: true }); };

  const onToggleBookmark = (id) => {
    const next = toggleBookmark(id);
    setBookmarks(new Set(next));
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.brandD, color: "#fff", padding: `${S.md}px ${S.lg}px`, boxShadow: SHADOW.soft }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: R.md, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Space 매거진</div>
            <div style={{ fontSize: 10.5, color: "#B5D4C5" }}>세상의 모든 이야기를 공간으로 — Space is Everything</div>
          </div>
        </div>
        {/* 탭 */}
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

      <div style={{ padding: S.lg, maxWidth: 900, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3 }}>공간 이야기를 불러오는 중…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3 }}>아직 표시할 공간 이야기가 없습니다.</div>
        ) : (
          <>
            {tab === "magazine"     && <MagazineSurface     posts={posts} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />}
            {tab === "archive"      && <ArchiveSurface      posts={posts} open={open} />}
            {tab === "search"       && <SearchSurface       posts={posts} open={open} />}
            {tab === "encyclopedia" && <EncyclopediaSurface posts={posts} open={open} onGoSearch={() => setTab("search")} />}
            {tab === "bookmark"     && <BookmarkSurface     posts={posts} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── 공용 조각 ────────────────────────────────────────────────────────
function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: S.sm, marginTop: S.lg }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{children}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BookmarkBtn({ id, bookmarks, onToggleBookmark }) {
  const on = bookmarks.has(String(id));
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggleBookmark(id); }}
      title={on ? "저장 해제" : "저장"}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, color: on ? C.gold : C.text4 }}>
      {on ? "🔖" : "🏷️"}
    </button>
  );
}

// 가로 스크롤 매거진 카드(커버 이미지 포함).
function MagCard({ card, open, bookmarks, onToggleBookmark }) {
  return (
    <div onClick={() => open(card.id)}
      style={{ minWidth: 190, maxWidth: 190, background: "#fff", borderRadius: R.lg, overflow: "hidden", border: `1px solid ${C.bgWarm}`, cursor: "pointer", boxShadow: SHADOW.soft }}>
      <div style={{ height: 110, background: C.surface2, position: "relative" }}>
        {card.cover
          ? <img src={card.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.text4, fontSize: 12 }}>{catLabel(card.category)}</div>}
        {bookmarks && (
          <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.85)", borderRadius: R.full, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookmarkBtn id={card.id} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />
          </div>
        )}
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text1, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>{card.title}</div>
        <div style={{ fontSize: 10, color: C.text3, marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: C.brand, fontWeight: 700 }}>{catLabel(card.category)}</span>
          <span>· {card.readingLabel}</span>
          {card.author?.label && <span>· {card.author.label}</span>}
        </div>
      </div>
    </div>
  );
}

// 목록형 한 줄 카드(검색/아카이브/저장/허브 공용).
function PostRow({ post, open, bookmarks, onToggleBookmark, excerpt, badge }) {
  const cover = Array.isArray(post.image_urls) ? post.image_urls[0] : null;
  return (
    <div onClick={() => open(post.id)}
      style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.bgWarm}`, cursor: "pointer" }}>
      {cover && <img src={cover} alt="" style={{ width: 56, height: 56, borderRadius: R.md, objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, lineHeight: 1.35 }}>{post.title}</div>
        {excerpt && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{excerpt}</div>}
        <div style={{ fontSize: 10.5, color: C.text3, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: C.brand, fontWeight: 700 }}>{catLabel(post.category)}</span>
          {badge && <span style={{ background: C.brandL, color: C.brandD, borderRadius: R.full, padding: "1px 6px", fontSize: 9.5, fontWeight: 700 }}>{badge}</span>}
          <span>· 👁 {post.view_count ?? 0}</span>
          <span>· ❤ {post.like_count ?? 0}</span>
          {post.created_at && <span>· {fmtDate(post.created_at)}</span>}
        </div>
      </div>
      {bookmarks && <div style={{ alignSelf: "center" }}><BookmarkBtn id={post.id} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} /></div>}
    </div>
  );
}

// ── 1) Magazine ──────────────────────────────────────────────────────
function MagazineSurface({ posts, open, bookmarks, onToggleBookmark }) {
  const mag = useMemo(() => composeMagazine(posts), [posts]);
  return (
    <div>
      {/* Insight 헤더 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: C.text2, marginBottom: S.sm }}>
        <span style={{ background: "#fff", borderRadius: R.full, padding: "4px 10px", border: `1px solid ${C.bgWarm}` }}>🌡️ 라운지 온도 {mag.insight.temperature}°</span>
        <span style={{ background: "#fff", borderRadius: R.full, padding: "4px 10px", border: `1px solid ${C.bgWarm}` }}>전체 {mag.insight.totalPosts}글</span>
        <span style={{ background: "#fff", borderRadius: R.full, padding: "4px 10px", border: `1px solid ${C.bgWarm}` }}>오늘 {mag.insight.todayPosts}글</span>
      </div>

      {/* Hero */}
      {mag.hero && (
        <div onClick={() => open(mag.hero.id)}
          style={{ borderRadius: R.xl, overflow: "hidden", cursor: "pointer", position: "relative", marginBottom: S.md, boxShadow: SHADOW.card, background: C.brandD, minHeight: 180 }}>
          {mag.hero.cover && <img src={mag.hero.cover} alt="" style={{ width: "100%", height: 200, objectFit: "cover", opacity: 0.85 }} />}
          <div style={{ position: mag.hero.cover ? "absolute" : "static", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: S.lg, background: mag.hero.cover ? "linear-gradient(transparent, rgba(0,0,0,0.7))" : "transparent" }}>
            <div style={{ color: "#fff", fontSize: 10.5, fontWeight: 700, opacity: 0.9 }}>오늘의 Space · {catLabel(mag.hero.category)}</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, lineHeight: 1.35, marginTop: 4 }}>{mag.hero.title}</div>
            <div style={{ color: "#e6ede9", fontSize: 11, marginTop: 6 }}>{mag.hero.readingLabel} · {mag.hero.author?.label}</div>
          </div>
        </div>
      )}

      {/* Editor's Pick */}
      {mag.editorsPick && (
        <div onClick={() => open(mag.editorsPick.id)}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${C.gold}`, borderRadius: R.lg, padding: "10px 12px", cursor: "pointer", marginBottom: S.md }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 800 }}>EDITOR'S PICK</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{mag.editorsPick.title}</div>
          </div>
          <span style={{ fontSize: 10.5, color: C.text3 }}>{mag.editorsPick.readingLabel}</span>
        </div>
      )}

      {/* Trending */}
      {mag.trending?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>🔥 상승</span>
          {mag.trending.map((t) => (
            <span key={t.category ?? t.label} style={{ fontSize: 11, background: C.pinkL, color: C.pinkD, borderRadius: R.full, padding: "3px 9px" }}>
              {catLabel(t.category) ?? t.label}
            </span>
          ))}
        </div>
      )}

      {/* Sections (가로 스크롤) */}
      {mag.sections.map((sec) => (
        <div key={sec.id}>
          <SectionTitle>{sec.title}</SectionTitle>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {sec.cards.map((c) => <MagCard key={c.id} card={c} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 2) Archive ───────────────────────────────────────────────────────
function ArchiveSurface({ posts, open }) {
  const arc = useMemo(() => composeArchive(posts), [posts]);
  return (
    <div>
      <SectionTitle sub={`쌓여가는 ${arc.total}개의 공간 이야기 — 시간이 지날수록 가치가 쌓입니다.`}>🗂️ 아카이브</SectionTitle>

      {/* 시간 축 */}
      {arc.byTime.filter((b) => b.count > 0).map((b) => (
        <div key={b.id} style={{ marginBottom: S.md }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{b.label} <span style={{ color: C.text3, fontWeight: 600 }}>· {b.count}</span></div>
          {b.sample.map((p) => <PostRow key={p.id} post={p} open={open} />)}
        </div>
      ))}

      {/* 카테고리 축 */}
      <SectionTitle>카테고리별</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {arc.byCategory.map((c) => (
          <span key={c.category} style={{ fontSize: 12, background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "5px 11px", color: C.text2 }}>
            {c.label} <span style={{ color: C.brand, fontWeight: 700 }}>{c.count}</span>
          </span>
        ))}
      </div>

      {/* 태그 클라우드 */}
      {arc.byTag.length > 0 && (
        <>
          <SectionTitle>태그</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {arc.byTag.map((t) => (
              <span key={t.tag} style={{ fontSize: 11 + Math.min(t.count, 6), color: C.brandD, background: C.brandL, borderRadius: R.full, padding: "3px 9px" }}>
                #{t.tag}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 3) Search ────────────────────────────────────────────────────────
function SearchSurface({ posts, open }) {
  const [q, setQ] = useState("");
  const res = useMemo(() => (q.trim() ? spaceSearch(q, posts, { limit: 30 }) : null), [q, posts]);
  return (
    <div>
      <SectionTitle sub="게시글이 아니라 '지식'을 검색합니다. 직접 매칭이 없어도 공간 관점으로 연결된 글을 찾아줍니다.">🔍 지식 검색</SectionTitle>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예) 신혼집, 누수, 창업, 금리…"
        style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${C.brandM}`, borderRadius: R.lg, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />

      {res && (
        <>
          <div style={{ fontSize: 11.5, color: C.text3, margin: `${S.sm}px 0` }}>
            공간 관점: <b style={{ color: C.brand }}>{res.spaceKeyword}</b>
            {res.chain?.length > 0 && <span> · {res.chain.join(" → ")}</span>}
          </div>
          {res.categories.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
              {res.categories.map((c) => (
                <span key={c.category} style={{ fontSize: 11, background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "3px 9px", color: C.text2 }}>{c.label} {c.count}</span>
              ))}
            </div>
          )}
          {res.results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>“{res.query}”에 대한 결과가 없습니다.</div>
          ) : (
            res.results.map((p) => (
              <PostRow key={p.id} post={p} open={open} excerpt={p._excerpt} badge={p._matched === "graph" ? "공간연결" : null} />
            ))
          )}
        </>
      )}
    </div>
  );
}

// ── 4) Encyclopedia ──────────────────────────────────────────────────
function EncyclopediaSurface({ posts, open }) {
  // 실제 글이 있는 카테고리만 허브 후보로.
  const cats = useMemo(() => {
    const present = new Set(posts.map((p) => p.category));
    return LOUNGE_CATEGORIES.filter((c) => c.group && present.has(c.id));
  }, [posts]);
  const [cat, setCat] = useState(null);
  const hub = useMemo(() => (cat ? composeTopicHub(cat, posts, { topN: 8 }) : null), [cat, posts]);

  return (
    <div>
      <SectionTitle sub="하나의 주제에서 관련 주제·관련 글로 백과사전처럼 뻗어나갑니다. 모든 길은 공간으로 이어집니다.">🌐 Space 백과</SectionTitle>

      {/* 지식 사슬 */}
      <div style={{ marginBottom: S.md }}>
        {KNOWLEDGE_CHAINS.map((ch) => (
          <div key={ch.id} style={{ background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "8px 10px", marginBottom: 6 }}>
            <div style={{ fontSize: 10.5, color: C.text3, marginBottom: 3 }}>{ch.label}</div>
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
        {cats.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            style={{ fontSize: 12, padding: "5px 11px", borderRadius: R.full, cursor: "pointer", fontWeight: 700,
              background: cat === c.id ? C.brand : "#fff", color: cat === c.id ? "#fff" : C.text2, border: `1px solid ${cat === c.id ? C.brand : C.bgWarm}` }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 허브 상세 */}
      {hub && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{hub.label} <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>· {hub.count}글</span></div>
          {hub.cluster && <div style={{ fontSize: 11.5, color: C.brand, marginTop: 2 }}>{hub.cluster.label}</div>}

          {hub.relatedCategories.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginTop: S.md, marginBottom: 4 }}>지식으로 연결된 주제</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {hub.relatedCategories.map((rc) => (
                  <button key={rc.category} onClick={() => setCat(rc.category)}
                    style={{ fontSize: 11.5, background: C.brandL, color: C.brandD, border: "none", borderRadius: R.full, padding: "4px 10px", cursor: "pointer" }}>
                    {rc.label} {rc.count > 0 && <b>{rc.count}</b>}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginTop: S.md, marginBottom: 4 }}>대표 글</div>
          {hub.topPosts.length === 0
            ? <div style={{ fontSize: 12, color: C.text3, padding: "10px 0" }}>이 주제의 글이 아직 없습니다.</div>
            : hub.topPosts.map((p) => <PostRow key={p.id} post={p} open={open} />)}
        </div>
      )}
      {!hub && <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 12.5 }}>위 사슬이나 카테고리를 선택해 백과를 펼쳐보세요.</div>}
    </div>
  );
}

// ── 5) Bookmark ──────────────────────────────────────────────────────
function BookmarkSurface({ posts, open, bookmarks, onToggleBookmark }) {
  const saved = posts.filter((p) => bookmarks.has(String(p.id)));
  return (
    <div>
      <SectionTitle sub="이 기기에 저장한 공간 이야기입니다(로컬 저장).">🔖 저장한 이야기 ({saved.length})</SectionTitle>
      {saved.length === 0
        ? <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 13 }}>아직 저장한 글이 없습니다.<br />매거진·검색에서 🏷️ 를 눌러 저장해보세요.</div>
        : saved.map((p) => <PostRow key={p.id} post={p} open={open} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />)}
    </div>
  );
}
