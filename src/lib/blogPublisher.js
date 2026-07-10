// ════════════════════════════════════════════════════════════════════
// 공간라운지 Blog Publisher — Space Lounge → JAFA1 네이버 블로그 자동배포 (Phase 25)
//
//   구조: Space Lounge 글 → HTML 생성 → 대표이미지 → 본문/소제목/이미지 → SEO/태그 →
//         Space Lounge 링크 첨부 → (Provider 업로드) → URL 저장 → Activity/Usage 기록.
//   목적: JAFA1 블로그 검색 유입 → Space Lounge → 회원가입 선순환.
//
//   Provider 구조: 초기 NAVER(JAFA1). 향후 Tistory/Wordpress/Brunch 확장 가능(레지스트리).
//
//   ⚠️ 실제 네이버 업로드는 인증/프록시(서버리스)가 필요하다. 공개 클라이언트 쓰기 API 가 없고
//   서버리스 12함수·Cron·vercel.json 제약이 있어, 이 엔진은 "발행 준비물(HTML/SEO/공유메타)"을
//   완성하고 executor(주입) 또는 설정된 endpoint 로 전송한다. endpoint 미설정 시 '임시저장(준비)'
//   상태로 기록한다(회귀 없음 · 나중에 endpoint 만 넣으면 그대로 업로드).
//   ⚠️ Regression Zero: 순수 함수/localStorage · DB/Migration/Cron/새 서버리스 없음.
// ════════════════════════════════════════════════════════════════════

import { logActivity } from "./activityLog.js";
import { scoreShareability, shareCard } from "./shareability.js";
import { contentTypeMeta, classifyContentType } from "./contentTypes.js";

const CFG_KEY = "space_blog_publish_cfg_v1";
const LOG_KEY = "space_blog_publish_log_v1";

// ── Provider 레지스트리 ──────────────────────────────────────────────
export const BLOG_PROVIDERS = {
  naver:     { id: "naver",     label: "네이버 블로그 (JAFA1)", blogId: "jafa1", enabled: true },
  tistory:   { id: "tistory",   label: "티스토리",             enabled: false },
  wordpress: { id: "wordpress", label: "워드프레스",           enabled: false },
  brunch:    { id: "brunch",    label: "브런치",               enabled: false },
};

export const DEFAULT_BLOG_CFG = {
  enabled: false,           // 블로그 자동발행 ON/OFF (기본 OFF)
  draftMode: true,          // 임시저장 (기본 ON)
  instant: false,           // 즉시발행 (기본 OFF)
  testMode: false,          // 테스트모드
  maxRetry: 3,              // Retry 횟수
  coverImage: true,         // 대표이미지 포함
  seoAuto: true,            // SEO 자동생성
  tagAuto: true,            // 태그 자동생성
  appendUrl: true,          // 마지막에 Space Lounge URL 첨부
  dailyMax: 8,              // 하루 최대 업로드
  provider: "naver",        // 대상 Provider
  spaceLoungeUrl: "https://gonggan-market.vercel.app", // Space Lounge 링크(관리자 설정)
  endpoint: "",             // 업로드 endpoint(웹훅/프록시). 비면 임시저장(준비) 상태.
  // 발행 대상 콘텐츠 타입(기본 ON, 긴급뉴스만 기본 OFF).
  typeMorningBrief: true, typeQt: true, typeAstrology: true,
  typeSpaceMarket: true, typeSeries: true, typeTimeTrend: true, typeBreaking: false,
};

export function getBlogConfig() {
  try { return { ...DEFAULT_BLOG_CFG, ...(JSON.parse(localStorage.getItem(CFG_KEY) ?? "{}") || {}) }; }
  catch { return { ...DEFAULT_BLOG_CFG }; }
}
export function setBlogConfig(patch) {
  const next = { ...getBlogConfig(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function getBlogLog() {
  try { const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function appendBlogLog(entry) {
  const rec = { at: Date.now(), ...entry };
  try { localStorage.setItem(LOG_KEY, JSON.stringify([rec, ...getBlogLog()].slice(0, 300))); } catch {}
  return rec;
}

// ── HTML 유틸(Markdown 금지 · 안전 이스케이프) ──────────────────────
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Markdown/plain 본문 → 블로그 HTML(소제목/문단/리스트/이미지). Markdown 문법은 HTML 로 변환한다.
function bodyToHtml(body, images = []) {
  const lines = String(body ?? "").split(/\r?\n/);
  const out = [];
  let imgIdx = 0;
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = Math.min(3, h[1].length) + 1; // h2~h4
      out.push(`<h${lvl} style="margin:28px 0 12px;font-weight:700;">${esc(h[2])}</h${lvl}>`);
      // 소제목 뒤에 이미지가 있으면 한 장 삽입.
      if (images[imgIdx]) { out.push(`<p style="text-align:center;margin:16px 0;"><img src="${esc(images[imgIdx])}" style="max-width:100%;border-radius:8px;" /></p>`); imgIdx += 1; }
      continue;
    }
    const li = line.match(/^[-*·]\s+(.*)$/);
    if (li) { if (!inList) { out.push('<ul style="margin:8px 0 8px 18px;">'); inList = true; } out.push(`<li style="margin:4px 0;">${esc(li[1])}</li>`); continue; }
    closeList();
    out.push(`<p style="margin:12px 0;line-height:1.8;">${esc(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

// Space Lounge 링크 푸터.
export function spaceLoungeFooter(cfg = getBlogConfig()) {
  const url = cfg.spaceLoungeUrl || DEFAULT_BLOG_CFG.spaceLoungeUrl;
  return [
    '<hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5;" />',
    '<p style="margin:12px 0;">더 다양한 콘텐츠는 Space Lounge에서 확인하세요.</p>',
    `<p style="margin:12px 0;"><a href="${esc(url)}" target="_blank" rel="noopener">▶ Space Lounge 바로가기</a></p>`,
    '<p style="margin:12px 0;color:#888;">#공간라운지 #SpaceLounge #공간마켓</p>',
  ].join("\n");
}

// SEO 자동 생성.
export function buildBlogSeo(post = {}) {
  const title = String(post.title ?? "").trim();
  const body = String(post.content ?? post.body ?? "").replace(/[#*>-]/g, " ").replace(/\s+/g, " ").trim();
  const contentType = post.contentType || classifyContentType(title);
  const typeLabel = contentTypeMeta(contentType).label;
  const base = ["공간라운지", "SpaceLounge", "공간마켓", typeLabel];
  // 제목/본문에서 키워드 후보(2글자+ 명사류 근사).
  const words = (title + " " + body.slice(0, 200)).split(/[\s,·:;!?()[\]"']+/).filter((w) => w.length >= 2);
  const seen = new Set(), keywords = [];
  for (const w of [...base, ...words]) { const k = w.trim(); if (k && !seen.has(k)) { seen.add(k); keywords.push(k); } if (keywords.length >= 12) break; }
  return {
    seoTitle: (title ? `${title} | 공간라운지` : "공간라운지").slice(0, 70),
    description: (body.slice(0, 150) || title).trim(),
    keywords,
    tags: keywords.slice(0, 8),
    category: typeLabel,
  };
}

// 전체 블로그 HTML(제목→대표이미지→본문→푸터).
export function buildBlogHtml(post = {}, cfg = getBlogConfig()) {
  const title = String(post.title ?? "").trim();
  const images = Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : [];
  const cover = cfg.coverImage && images[0] ? images[0] : null;
  const restImages = cover ? images.slice(1) : images;
  const parts = [];
  parts.push(`<h1 style="font-size:24px;font-weight:800;margin:0 0 20px;">${esc(title)}</h1>`);
  if (cover) parts.push(`<p style="text-align:center;margin:0 0 24px;"><img src="${esc(cover)}" style="max-width:100%;border-radius:10px;" /></p>`);
  parts.push(bodyToHtml(post.content ?? post.body ?? "", restImages));
  if (cfg.appendUrl) parts.push(spaceLoungeFooter(cfg));
  return `<div style="font-family:-apple-system,'Noto Sans KR',sans-serif;color:#222;">\n${parts.join("\n")}\n</div>`;
}

// 발행 준비물 일괄 생성(HTML+SEO+공유메타+대상).
export function buildBlogPost(post = {}, cfg = getBlogConfig()) {
  const contentType = post.contentType || classifyContentType(post.title || "");
  const withType = { ...post, contentType };
  return {
    provider: cfg.provider,
    providerLabel: BLOG_PROVIDERS[cfg.provider]?.label || cfg.provider,
    contentType,
    title: post.title,
    html: buildBlogHtml(withType, cfg),
    seo: cfg.seoAuto ? buildBlogSeo(withType) : null,
    tags: cfg.tagAuto ? buildBlogSeo(withType).tags : [],
    shareMeta: shareCard(withType),
    shareability: scoreShareability({ title: post.title, body: post.content ?? post.body, contentType }),
  };
}

// 콘텐츠 타입이 블로그 발행 대상인가?(설정 토글).
export function isBlogEligible(contentType, cfg = getBlogConfig()) {
  const map = {
    morning_brief: cfg.typeMorningBrief, qt: cfg.typeQt, astrology: cfg.typeAstrology,
    space_market: cfg.typeSpaceMarket, series: cfg.typeSeries,
    trend_past: cfg.typeTimeTrend, trend_present: cfg.typeTimeTrend, trend_future: cfg.typeTimeTrend,
    breaking: cfg.typeBreaking,
  };
  return map[contentType] !== false && (contentType in map ? map[contentType] !== false : true);
}

const isToday = (ts, now) => { const d = new Date(ts), n = new Date(now); return d.toDateString() === n.toDateString(); };
export function todayBlogCount(now = Date.now()) {
  return getBlogLog().filter((e) => e.status === "published" && isToday(e.at, now)).length;
}

// ── 발행 실행 ────────────────────────────────────────────────────────
//   executor(선택): async ({html, seo, title, provider, mode}) => { url } | throws.
//   미주입 & endpoint 미설정 → '준비(prepared)' 상태로 기록(임시저장). endpoint 있으면 fetch 시도.
export async function publishToBlog(post, { executor = null, cfg = getBlogConfig(), now = Date.now() } = {}) {
  const built = buildBlogPost(post, cfg);
  const mode = cfg.instant ? "publish" : "draft";
  logActivity("blog_start", { title: post.title, contentType: built.contentType, note: `${built.providerLabel} · ${mode}` });
  logActivity("blog_html", { title: post.title, note: `HTML ${built.html.length}자 · 태그 ${built.tags.length}` });

  const doUpload = executor
    || (cfg.endpoint ? async (payload) => {
        const res = await fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`endpoint ${res.status}`);
        const data = await res.json().catch(() => ({}));
        return { url: data.url || null };
      } : null);

  // 실제 업로더가 없으면 준비 상태로 저장(회귀 없음 · 나중에 endpoint 연결).
  if (!doUpload) {
    const rec = appendBlogLog({ title: post.title, contentType: built.contentType, provider: cfg.provider, status: "prepared",
      mode, htmlLength: built.html.length, tags: built.tags, shareability: built.shareability.shareScore, url: null,
      note: "업로드 endpoint 미설정 — 발행 준비 완료(임시저장)" });
    logActivity("blog_prepared", { title: post.title, contentType: built.contentType, shareabilityScore: built.shareability.shareScore, note: "endpoint 미설정 · 준비 완료" });
    return { status: "prepared", built, rec };
  }

  let attempt = 0, lastErr = null;
  while (attempt < (cfg.maxRetry || 1)) {
    attempt += 1;
    try {
      const { url } = await doUpload({ title: post.title, html: built.html, seo: built.seo, tags: built.tags, provider: cfg.provider, mode, blogId: BLOG_PROVIDERS[cfg.provider]?.blogId });
      const rec = appendBlogLog({ title: post.title, contentType: built.contentType, provider: cfg.provider,
        status: cfg.instant ? "published" : "drafted", mode, url: url || null, htmlLength: built.html.length,
        tags: built.tags, shareability: built.shareability.shareScore, attempts: attempt });
      logActivity("blog_url", { title: post.title, note: url || "(URL 없음)" });
      logActivity(cfg.instant ? "blog_published" : "blog_drafted", { title: post.title, contentType: built.contentType,
        shareabilityScore: built.shareability.shareScore, ok: true, note: url || mode });
      return { status: rec.status, url: url || null, built, rec };
    } catch (e) {
      lastErr = e?.message ?? String(e);
      logActivity("blog_retry", { title: post.title, ok: false, note: `${attempt}/${cfg.maxRetry} · ${lastErr}` });
    }
  }
  const rec = appendBlogLog({ title: post.title, contentType: built.contentType, provider: cfg.provider, status: "failed", mode, error: lastErr, attempts: attempt });
  logActivity("blog_failed", { title: post.title, ok: false, note: lastErr });
  return { status: "failed", error: lastErr, built, rec };
}

// ── 블로그 Usage 통계 ────────────────────────────────────────────────
export function blogUsageStats(now = Date.now()) {
  const log = getBlogLog();
  const inWin = (e, ms) => now - e.at <= ms;
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const done = (e) => e.status === "published" || e.status === "drafted" || e.status === "prepared";
  const rangeCount = (pred) => log.filter((e) => pred(e) && done(e)).length;

  const today = log.filter((e) => e.at >= startOfDay.getTime());
  const attempts = today.filter((e) => ["published", "drafted", "prepared", "failed"].includes(e.status)).length;
  const fails = today.filter((e) => e.status === "failed").length;
  const retries = today.filter((e) => e.status === "failed" || (e.attempts || 0) > 1).reduce((n, e) => n + Math.max(0, (e.attempts || 1) - 1), 0);
  const durs = today.filter((e) => Number.isFinite(e.durationMs)).map((e) => e.durationMs);

  return {
    today: rangeCount((e) => e.at >= startOfDay.getTime()),
    week: rangeCount((e) => inWin(e, 7 * 864e5)),
    month: rangeCount((e) => inWin(e, 30 * 864e5)),
    all: log.filter(done).length,
    successRate: attempts ? Math.round(((attempts - fails) / attempts) * 100) : null,
    failures: fails,
    retries,
    avgUploadMs: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
    dailyUsed: todayBlogCount(now),
  };
}
