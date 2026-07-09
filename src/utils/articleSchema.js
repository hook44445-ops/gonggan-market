// ─────────────────────────────────────────────────────
// 공간라운지 Article Schema — 구조화 데이터 (Phase 5 · Space Media · SEO)
//
//   글 하나가 검색 자산이 되도록 구조를 준비한다: Article(JSON-LD) · Breadcrumb · Reading Time.
//   순수 ESM(의존성 최소: loungeSeo/readingExperience 만) — 클라이언트/서버 프리렌더 양쪽에서 사용 가능.
//   기존 buildPostMeta(title/description/og)를 대체하지 않고 "추가"로 구조화 데이터만 만든다.
// ─────────────────────────────────────────────────────

import { buildPostPath, buildPostMeta } from "./loungeSeo.js";
import { readingTime } from "../lib/readingExperience.js";
import { authorDisplayHint } from "../lib/authorSystem.js";

// ISO8601 duration (분 → PT#M) — schema.org timeRequired 용.
function ptMinutes(min) {
  return `PT${Math.max(1, Math.round(min))}M`;
}

// Article JSON-LD 객체. origin 은 절대 URL 합성을 위한 사이트 origin(예: https://gongganmarket.com).
export function buildArticleSchema(post, origin = "") {
  if (!post) return null;
  const meta = buildPostMeta(post);
  const url = origin ? `${origin}${buildPostPath(post)}` : buildPostPath(post);
  const imgs = Array.isArray(post.image_urls) ? post.image_urls : [];
  const image = imgs.length ? imgs : [origin ? `${origin}${meta.imagePath}` : meta.imagePath];
  const rt = readingTime(post.content ?? "", imgs.length);
  const authorName = authorDisplayHint(post) || "공간라운지 이웃";

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: String(post.title ?? meta.title).slice(0, 110),
    description: meta.description,
    image,
    author: { "@type": "Organization", name: authorName },
    publisher: { "@type": "Organization", name: "공간라운지 · Space Lounge" },
    datePublished: post.created_at ?? undefined,
    dateModified: post.updated_at ?? post.created_at ?? undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    timeRequired: ptMinutes(rt.minutes),
    wordCount: rt.chars,
  };
}

// BreadcrumbList JSON-LD — 홈 → 라운지 → 카테고리 → 글.
export function buildBreadcrumbSchema(post, categoryLabel, origin = "") {
  if (!post) return null;
  const abs = (path) => (origin ? `${origin}${path}` : path);
  const items = [
    { name: "공간라운지", path: "/lounge" },
  ];
  if (categoryLabel) items.push({ name: categoryLabel, path: "/lounge" });
  items.push({ name: String(post.title ?? "글").slice(0, 60), path: buildPostPath(post) });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

// <script type="application/ld+json"> 문자열 배열 — 프리렌더/헤드 주입용.
export function articleJsonLdTags(post, categoryLabel, origin = "") {
  const article = buildArticleSchema(post, origin);
  const crumb = buildBreadcrumbSchema(post, categoryLabel, origin);
  return [article, crumb].filter(Boolean).map((obj) => JSON.stringify(obj));
}
