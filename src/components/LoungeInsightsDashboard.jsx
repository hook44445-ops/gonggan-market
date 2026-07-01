import { useState, useEffect, useMemo } from "react";
import { C, R, S } from "../constants";
import { CATEGORY_LABEL } from "../constants/lounge";
import { adminGetLoungePosts, getLoungeReports } from "../lib/supabase";

// ── 라운지 인사이트(LOUNGE INSIGHTS MVP) — 관리자 전용 콘텐츠 성과 대시보드 ────────
// 목적: 베타·정식 공통으로 운영자가 "어떤 글/카테고리가 반응이 좋은지" 매일 확인.
// 원칙: 신규 DB/RPC/Migration 없음. 기존 lounge_posts / lounge_reports 컬럼만 사용.
//       집계는 전부 클라이언트에서 수행(무거운 통계 쿼리 없음).
// 데이터 소스:
//   · adminGetLoungePosts({ hidden:null }) — 숨김 포함 전체(관리자 RLS read)
//   · getLoungeReports() — lounge_reports(관리자 RLS read). 대부분 로컬 신고라 낮을 수 있음 → fallback.
// 미지원 지표(무리한 Migration 대신 "준비 중" 처리):
//   · 저장 수(saves): lounge_saves 는 owner-only RLS 라 관리자 집계 불가 → "준비 중".
//   · 조회수 "증가"(시계열 스냅샷 없음) → "최근 7일 작성 글 · 조회수순" 근사치로 표기.

const DAY = 24 * 60 * 60 * 1000;

// 콘텐츠 오디언스 버킷 — 기존 category master(LOUNGE_CATEGORIES) id 기준.
// '사장님 수다(staff_talk/staff-talk)'는 현재 마스터에 없지만, 향후 추가돼도 정상 집계되도록 미리 포함(방어적).
const AUDIENCE = {
  business: {
    label: "업체향 (사장님)",
    icon: "🏢",
    sub: "시공후기·창업·직원고민·사장님 수다",
    ids: ["review", "startup", "jobs", "staff_talk", "staff-talk"],
  },
  customer: {
    label: "고객향",
    icon: "🏠",
    sub: "인테리어·집꾸미기·견적고민·이사입주",
    ids: ["interior", "room_deco", "quote_worry", "move_in"],
  },
};

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const catLabel = (id) => CATEGORY_LABEL[id] ?? id ?? "—";
const fmtDate = (t) =>
  t ? new Date(t).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—";
const titleOf = (p) => {
  const t = (p.title ?? "").trim();
  if (t) return t;
  const c = (p.content ?? "").trim().replace(/\s+/g, " ");
  return c ? (c.length > 40 ? c.slice(0, 40) + "…" : c) : "(제목 없음)";
};
// 딥링크 — /lounge/posts/:id 파서(MainApp)가 처리. 새 탭으로 열어 관리자 화면 상태 보존.
const postPath = (p) => `/lounge/posts/${p.id}`;

const Card = ({ children, style }) => (
  <div style={{ background: C.surface, borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}`, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: S.md, marginTop: S.xl }}>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{children}</div>
    {sub && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{sub}</div>}
  </div>
);

// 글 목록 행 — 제목/카테고리/작성일/조회·댓글·하트/신고·숨김/상세 링크
function PostRow({ p, metric, reportCount = 0 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, borderRadius: R.sm, padding: "1px 7px", whiteSpace: "nowrap" }}>
            {catLabel(p.category)}
          </span>
          {p.is_hidden && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.red, background: "#FEF0F0", borderRadius: R.sm, padding: "1px 7px" }}>숨김</span>
          )}
          {reportCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: "#FBF5E8", borderRadius: R.sm, padding: "1px 7px" }}>신고 {reportCount}</span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {titleOf(p)}
        </div>
        <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>
          {fmtDate(p.created_at)} · 👁 {fmt(p.view_count)} · 💬 {fmt(p.comment_count)} · ❤️ {fmt(p.like_count)}
        </div>
      </div>
      {metric && (
        <div style={{ textAlign: "right", minWidth: 54 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: metric.color }}>{fmt(metric.value(p))}</div>
          <div style={{ fontSize: 10, color: C.text4 }}>{metric.label}</div>
        </div>
      )}
      <a href={postPath(p)} target="_blank" rel="noreferrer"
        style={{ fontSize: 11, fontWeight: 700, color: C.brand, textDecoration: "none", whiteSpace: "nowrap", padding: "6px 8px" }}>
        상세 ↗
      </a>
    </div>
  );
}

function TopList({ title, sub, posts, metric, empty = "데이터가 없습니다" }) {
  return (
    <Card style={{ marginBottom: S.md }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.text3, marginBottom: S.sm }}>{sub}</div>}
      {posts.length === 0 ? (
        <div style={{ fontSize: 12, color: C.text3, padding: "16px 0", textAlign: "center" }}>{empty}</div>
      ) : (
        posts.map((p) => <PostRow key={p.id} p={p} metric={metric} reportCount={p._reportCount} />)
      )}
    </Card>
  );
}

export default function LoungeInsightsDashboard() {
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 대량이어도 안전하도록 상한 지정(무거운 통계 쿼리 대신 단순 select 후 클라 집계).
      const [postsRes, reportsRes] = await Promise.all([
        adminGetLoungePosts({ limit: 5000 }),
        getLoungeReports().catch(() => ({ data: [] })),
      ]);
      if (postsRes.error) setErr(postsRes.error.message ?? "글 조회 실패");
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    } catch (e) {
      setErr(e?.message ?? String(e));
      setPosts([]);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const agg = useMemo(() => {
    const now = Date.now();
    const since7d = now - 7 * DAY;
    const isRecent = (p) => p.created_at && new Date(p.created_at).getTime() >= since7d;

    // 글별 신고 수(lounge_reports, target_type='post') — 낮거나 0일 수 있음(로컬 신고 존재).
    const reportByPost = {};
    (reports || []).forEach((r) => {
      if (r.target_type === "post" && r.target_id) reportByPost[r.target_id] = (reportByPost[r.target_id] ?? 0) + 1;
    });
    const withReport = (p) => ({ ...p, _reportCount: reportByPost[p.id] ?? 0 });

    const total = posts.length;
    const recent7d = posts.filter(isRecent).length;
    const totalViews = posts.reduce((s, p) => s + (p.view_count ?? 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comment_count ?? 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.like_count ?? 0), 0);
    const totalReactions = totalComments + totalLikes; // 저장(saves)은 관리자 집계 불가 → 제외
    const hiddenCount = posts.filter((p) => p.is_hidden).length;
    const reportedPostCount = Object.keys(reportByPost).length;

    // 카테고리별 글 수(내림차순)
    const byCat = {};
    posts.forEach((p) => { const c = p.category ?? "daily"; byCat[c] = (byCat[c] ?? 0) + 1; });
    const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    // 오디언스 버킷 집계
    const audienceStat = (ids) => {
      const set = new Set(ids);
      const sub = posts.filter((p) => set.has(p.category));
      const views = sub.reduce((s, p) => s + (p.view_count ?? 0), 0);
      const reactions = sub.reduce((s, p) => s + (p.comment_count ?? 0) + (p.like_count ?? 0), 0);
      return { count: sub.length, views, reactions, avgViews: sub.length ? Math.round(views / sub.length) : 0 };
    };
    const business = audienceStat(AUDIENCE.business.ids);
    const customer = audienceStat(AUDIENCE.customer.ids);

    const topBy = (fn) => [...posts].map(withReport).sort((a, b) => fn(b) - fn(a)).slice(0, 10);
    const topViews = topBy((p) => p.view_count ?? 0);
    const topComments = topBy((p) => p.comment_count ?? 0);
    const topLikes = topBy((p) => p.like_count ?? 0);

    // 최근 7일 작성 글 · 조회수순(시계열 스냅샷이 없어 "증가" 대신 근사).
    const recentTopViews = posts.filter(isRecent).map(withReport)
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 10);

    // 신고/숨김 목록 — 숨김이거나 신고 1건 이상. 신고 수 · 조회수 순.
    const flagged = posts.map(withReport)
      .filter((p) => p.is_hidden || p._reportCount > 0)
      .sort((a, b) => (b._reportCount - a._reportCount) || ((b.view_count ?? 0) - (a.view_count ?? 0)))
      .slice(0, 20);

    return {
      total, recent7d, totalViews, totalReactions, totalComments, totalLikes,
      hiddenCount, reportedPostCount, catRows,
      business, customer, topViews, topComments, topLikes, recentTopViews, flagged,
    };
  }, [posts, reports]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>인사이트 집계 중...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>📈 라운지 인사이트</div>
        <button onClick={load}
          style={{ fontSize: 11, fontWeight: 700, color: C.brand, background: C.brandL, border: "none", borderRadius: R.md, padding: "6px 12px", cursor: "pointer" }}>
          새로고침
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.md }}>
        관리자 전용 · 라운지 콘텐츠 성과 요약(읽기 전용). 신규 DB 변경 없이 기존 데이터로 집계합니다.
      </div>
      {err && (
        <div style={{ background: "#FEF0F0", color: C.red, borderRadius: R.md, padding: "10px 12px", fontSize: 12, marginBottom: S.md }}>
          일부 데이터를 불러오지 못했습니다: {err}
        </div>
      )}

      {/* ── 상단 요약 카드 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.sm }}>
        {[
          ["전체 글 수", agg.total, C.brand],
          ["최근 7일 글 수", agg.recent7d, C.green],
          ["총 조회수", agg.totalViews, C.navy ?? C.brand],
          ["총 반응 수", agg.totalReactions, C.gold],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: C.surface, borderRadius: R.lg, padding: S.xl, textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color }}>{fmt(val)}</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.text4, marginBottom: S.sm }}>
        총 반응 수 = 댓글 {fmt(agg.totalComments)} + 하트 {fmt(agg.totalLikes)}. 저장(saves)은 권한 정책상 관리자 집계 미지원(준비 중).
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.md }}>
        {[
          ["숨김 글 수", agg.hiddenCount, C.red],
          ["신고 접수 글 수", agg.reportedPostCount, C.gold],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: C.surface, borderRadius: R.lg, padding: `${S.md}px ${S.xl}px`, textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 20, fontWeight: 900, color }}>{fmt(val)}</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── 오디언스 성과 비교 ── */}
      <SectionTitle sub="기존 카테고리 기준 그룹핑 · '사장님 수다(staff_talk)'는 추가 시 자동 집계">콘텐츠 성과 비교 (업체향 / 고객향)</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.md }}>
        {[["business", agg.business], ["customer", agg.customer]].map(([key, st]) => {
          const meta = AUDIENCE[key];
          return (
            <Card key={key}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{meta.icon} {meta.label}</div>
              <div style={{ fontSize: 10.5, color: C.text4, marginBottom: S.sm }}>{meta.sub}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: C.text3 }}>글 수</span><span style={{ fontWeight: 700, color: C.text1 }}>{fmt(st.count)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: C.text3 }}>총 조회수</span><span style={{ fontWeight: 700, color: C.text1 }}>{fmt(st.views)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: C.text3 }}>총 반응(댓글+하트)</span><span style={{ fontWeight: 700, color: C.text1 }}>{fmt(st.reactions)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: C.text3 }}>평균 조회수</span><span style={{ fontWeight: 700, color: C.brand }}>{fmt(st.avgViews)}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── 카테고리별 글 수 ── */}
      <SectionTitle>카테고리별 글 수</SectionTitle>
      <Card style={{ marginBottom: S.md }}>
        {agg.catRows.length === 0 ? (
          <div style={{ fontSize: 12, color: C.text3, padding: "16px 0", textAlign: "center" }}>데이터가 없습니다</div>
        ) : agg.catRows.map(([cat, n]) => {
          const pct = agg.total ? Math.round((n / agg.total) * 100) : 0;
          return (
            <div key={cat} style={{ padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: C.text1 }}>{catLabel(cat)}</span>
                <span style={{ color: C.text3 }}>{fmt(n)}건 · {pct}%</span>
              </div>
              <div style={{ height: 6, background: C.bgWarm, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: C.brand }} />
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── TOP 글 목록 ── */}
      <SectionTitle>반응 TOP 글</SectionTitle>
      <TopList title="👁 조회수 TOP 10" posts={agg.topViews} metric={{ label: "조회", color: C.brand, value: (p) => p.view_count }} />
      <TopList title="💬 댓글 TOP 10" posts={agg.topComments} metric={{ label: "댓글", color: C.green, value: (p) => p.comment_count }} />
      <TopList title="❤️ 하트 TOP 10" posts={agg.topLikes} metric={{ label: "하트", color: C.red, value: (p) => p.like_count }} />
      <TopList title="🕒 최근 7일 인기 글" sub="시계열 스냅샷이 없어 '최근 7일 작성 글 · 조회수순'으로 표시합니다."
        posts={agg.recentTopViews} metric={{ label: "조회", color: C.brand, value: (p) => p.view_count }} empty="최근 7일 작성된 글이 없습니다" />

      {/* ── 저장 TOP (준비 중) ── */}
      <Card style={{ marginBottom: S.md }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🔖 저장 TOP 10</div>
        <div style={{ fontSize: 12, color: C.text3, padding: "16px 0", textAlign: "center", lineHeight: 1.7 }}>
          준비 중 — 저장(lounge_saves)은 소유자 전용 권한(RLS)이라 관리자 집계가 지원되지 않습니다.<br/>
          집계용 컬럼/권한이 마련되면 표시됩니다.
        </div>
      </Card>

      {/* ── 신고/숨김 글 ── */}
      <SectionTitle sub="숨김 처리됐거나 신고가 접수된 글. 상세에서 개별 조치 가능.">신고 · 숨김 글</SectionTitle>
      <TopList title="🚩 신고/숨김 글 목록" posts={agg.flagged}
        metric={{ label: "신고", color: C.gold, value: (p) => p._reportCount }} empty="신고·숨김 처리된 글이 없습니다" />
    </div>
  );
}
