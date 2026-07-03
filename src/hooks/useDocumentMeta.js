import { useEffect } from "react";

// 정적 페이지(홈/다운로드/파트너/약관 등) 진입 시 title/description/canonical/OG 를
// 페이지별로 갱신한다. LoungePostDetailScreen 의 기존 SEO 메타 갱신 패턴과 동일한
// upsert(없으면 생성, 있으면 값 교체) + 언마운트 시 원복 규칙을 공유 훅으로 추출한 것.
//   ⚠️ 표시 전용 — 라우팅/DB/API 무변경. index.html 의 기본값은 그대로 두고
//      페이지 진입 시에만 document.head 를 덮어썼다가 복원한다.
export function useDocumentMeta({ title, description, path, ogImage }) {
  useEffect(() => {
    if (!title) return undefined;
    const prevTitle = document.title;
    document.title = title;

    const upsert = (selector, create) => {
      let el = document.head.querySelector(selector);
      const created = !el;
      if (!el) { el = create(); document.head.appendChild(el); }
      const prev = created ? null : el.getAttribute("content");
      return { el, created, prev };
    };

    const canonicalHref = path ? `${window.location.origin}${path}` : null;
    const ogImageAbs = ogImage
      ? (ogImage.startsWith("http") ? ogImage : `${window.location.origin}${ogImage}`)
      : null;

    const targets = [];
    if (description != null) {
      targets.push({ ...upsert('meta[name="description"]', () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; }), val: description });
      targets.push({ ...upsert('meta[property="og:description"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:description"); return m; }), val: description });
      targets.push({ ...upsert('meta[name="twitter:description"]', () => { const m = document.createElement("meta"); m.setAttribute("name", "twitter:description"); return m; }), val: description });
    }
    targets.push({ ...upsert('meta[property="og:title"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m; }), val: title });
    targets.push({ ...upsert('meta[name="twitter:title"]', () => { const m = document.createElement("meta"); m.setAttribute("name", "twitter:title"); return m; }), val: title });
    if (canonicalHref) {
      targets.push({ ...upsert('meta[property="og:url"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:url"); return m; }), val: canonicalHref });
    }
    if (ogImageAbs) {
      targets.push({ ...upsert('meta[property="og:image"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:image"); return m; }), val: ogImageAbs });
      targets.push({ ...upsert('meta[name="twitter:image"]', () => { const m = document.createElement("meta"); m.setAttribute("name", "twitter:image"); return m; }), val: ogImageAbs });
    }
    targets.forEach((t) => t.el.setAttribute("content", t.val));

    let canonicalEl = null;
    let canonicalCreated = false;
    let canonicalPrev = null;
    if (canonicalHref) {
      canonicalEl = document.head.querySelector('link[rel="canonical"]');
      canonicalCreated = !canonicalEl;
      canonicalPrev = canonicalCreated ? null : canonicalEl.getAttribute("href");
      if (!canonicalEl) { canonicalEl = document.createElement("link"); canonicalEl.setAttribute("rel", "canonical"); document.head.appendChild(canonicalEl); }
      canonicalEl.setAttribute("href", canonicalHref);
    }

    return () => {
      document.title = prevTitle;
      targets.forEach((t) => {
        if (t.created) t.el.remove();
        else if (t.prev != null) t.el.setAttribute("content", t.prev);
      });
      if (canonicalEl) {
        if (canonicalCreated) canonicalEl.remove();
        else if (canonicalPrev != null) canonicalEl.setAttribute("href", canonicalPrev);
      }
    };
  }, [title, description, path, ogImage]);
}
