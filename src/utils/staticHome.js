// 빌드 때 index.html #root 안에 홈 본문을 넣는다(vite.config.js seoStaticHome) — 10-02 로컬 점검 «Yeti 에게 홈 본문 0자».
//
// 왜 이 방법(a)인가 — Edge Middleware(b) 대신:
//   · 새 서버·엣지 함수가 없다(Vercel Hobby 함수 12/12 · 미들웨어가 한도에 들어가는지 확인 못 함).
//   · UA 목록에 없는 수집기(새 AI 봇 등)도 본문을 받는다 — UA 판별에 기대지 않는다.
//   · 문장은 봇 프리렌더와 같은 함수(prerenderParts.homeBodyHtml)라 갈라지지 않는다.
// 사람(JS 켜짐)에게는: <head> 맨 앞 한 줄 스크립트가 <html> 에 «gm-js» 를 달고, 그때만 이 본문을 숨긴다(깜빡임 없음).
//   React(createRoot)가 처음 그릴 때 #root 안을 비우고 화면을 그린다 — 같은 문장이 화면에 그대로 있다(클로킹 아님).
// 다른 SPA 주소(/my 등)도 이 index.html 을 받지만, index.html 의 canonical 이 «/» 라 같은 문서로 묶인다(예전과 같음).
import { homeBodyHtml } from './prerenderParts.js';
import { SITE_URL } from './siteSeo.js';

export const STATIC_HOME_CLASS = 'gm-seo-static';
const HEAD_SNIPPET = `<script>document.documentElement.className+=' gm-js'</script><style>.gm-js .${STATIC_HOME_CLASS}{display:none}</style>`;

export function staticHomeHtml(html, { beta = true, site = SITE_URL } = {}) {
  if (typeof html !== 'string' || !html.includes('<div id="root"></div>')) return html;   // 이미 넣었거나 모양이 다르면 그대로
  return html
    .replace('<head>', `<head>\n    ${HEAD_SNIPPET}`)
    .replace('<div id="root"></div>', `<div id="root"><div class="${STATIC_HOME_CLASS}">${homeBodyHtml({ site, beta })}</div></div>`);
}
