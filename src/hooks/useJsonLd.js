import { useEffect } from "react";

// 화면 진입 시 구조화 데이터(JSON-LD)를 <head> 에 넣고, 나갈 때 걷어낸다.
// useDocumentMeta 의 upsert/원복 규칙과 같은 성격 — 표시 전용이며 라우팅·DB·API 무변경.
//
// key 는 화면마다 고유해야 한다(같은 key 의 이전 태그를 먼저 지우고 새로 넣는다).
// 배열 안의 null/undefined 는 건너뛴다 — faqSchema() 처럼 빈 입력에서 null 을 주는
// 빌더를 조건문 없이 그대로 나열할 수 있게 하기 위함.
export function useJsonLd(key, schemas) {
  // 스키마 내용이 실제로 바뀔 때만 다시 쓰도록 직렬화 결과를 의존성으로 쓴다
  // (매 렌더마다 새 배열 리터럴이 들어와도 DOM 을 건드리지 않는다).
  const payload = JSON.stringify((schemas || []).filter(Boolean));

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    let list;
    try {
      list = JSON.parse(payload);
    } catch {
      return undefined;
    }
    if (!list.length) return undefined;

    const attr = `jsonld-${key}`;
    document.head.querySelectorAll(`script[data-gg-jsonld="${attr}"]`).forEach((el) => el.remove());

    const nodes = list.map((schema) => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-gg-jsonld", attr);
      // </script> 로 마크업을 탈출하지 못하게 이스케이프 — api/prerender.js 와 같은 규칙.
      el.textContent = JSON.stringify(schema).replace(/</g, "\\u003c");
      document.head.appendChild(el);
      return el;
    });

    return () => nodes.forEach((el) => el.remove());
  }, [key, payload]);
}

export default useJsonLd;
