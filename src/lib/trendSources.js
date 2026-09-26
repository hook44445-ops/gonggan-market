// ════════════════════════════════════════════════════════════════════
// 실제 트렌드·뉴스·날씨 가져오기(서버 전용 — 자율 사이클에서만 부른다) — 09-26
//   · Google 트렌드(한국) 급상승 RSS — 키 필요 없음.
//   · 네이버 뉴스 검색 API — NAVER_CLIENT_ID · NAVER_CLIENT_SECRET 이 있을 때만(대표가 Vercel 에 넣음).
//   · 기상청 단기예보(공공데이터포털) — KMA_SERVICE_KEY 가 있을 때만.
//   구글 뉴스 RSS 는 쓰지 않는다 — 피드에 «개인·비상업 용도만» 이라고 적혀 있다.
//   모두 8초 안에 못 받으면 빈 결과(사이클은 계속).
// ════════════════════════════════════════════════════════════════════

const TIMEOUT_MS = 8000;

async function fetchText(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": "gongganmarket-lounge/1.0", ...headers }, signal: ctl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

const decode = (s) => String(s ?? "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, "")
  .trim();
const tag = (xml, name) => { const m = String(xml).match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

// Google 트렌드 RSS → [{ keyword, traffic, news:[{title,url,source}] }]
export function parseGoogleTrendsRss(xml) {
  const items = String(xml ?? "").split("<item>").slice(1).map((c) => c.split("</item>")[0]);
  return items.map((it) => ({
    keyword: tag(it, "title"),
    traffic: tag(it, "ht:approx_traffic"),
    news: it.split("<ht:news_item>").slice(1).map((n) => ({
      title:  tag(n, "ht:news_item_title"),
      url:    tag(n, "ht:news_item_url"),
      source: tag(n, "ht:news_item_source"),
    })).filter((n) => n.title && n.url),
  })).filter((t) => t.keyword);
}

export async function fetchGoogleTrendsKR() {
  const xml = await fetchText("https://trends.google.com/trending/rss?geo=KR");
  return xml ? parseGoogleTrendsRss(xml) : [];
}

// 네이버 뉴스 검색 → [{ title, url, source, pubDate }] (source = 원문 주소의 도메인)
export async function fetchNaverNews(query, { display = 10 } = {}) {
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return { configured: false, items: [] };
  const body = await fetchText(
    `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`,
    { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret });
  if (!body) return { configured: true, items: [] };
  try {
    const j = JSON.parse(body);
    return {
      configured: true,
      items: (j.items ?? []).map((x) => {
        const url = x.originallink || x.link;
        let source = "";
        try { source = new URL(url).hostname.replace(/^www\./, ""); } catch { /* */ }
        return { title: decode(x.title), url, source, pubDate: x.pubDate };
      }),
    };
  } catch { return { configured: true, items: [] }; }
}

// 기상청 단기예보(서울 격자 60,127) — 내일 최저·최고·최대 강수확률·강수량
export async function fetchKmaTomorrow({ now = Date.now(), nx = 60, ny = 127, place = "서울" } = {}) {
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) return { configured: false, forecast: null };
  const k = new Date(now + 9 * 3600 * 1000);
  const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  // 02시 발표분(02:10 이후 제공)이 내일 최저·최고를 모두 담는다. 그 전이면 전날 23시 발표분.
  const early = k.getUTCHours() < 3;
  const baseDay = early ? new Date(k.getTime() - 86400000) : k;
  const baseTime = early ? "2300" : "0200";
  const tomorrow = ymd(new Date(k.getTime() + 86400000));
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${ymd(baseDay)}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
  const body = await fetchText(url);
  if (!body) return { configured: true, forecast: null };
  try {
    const items = JSON.parse(body)?.response?.body?.items?.item ?? [];
    const day = items.filter((i) => i.fcstDate === tomorrow);
    if (!day.length) return { configured: true, forecast: null };
    const num = (c) => day.filter((i) => i.category === c).map((i) => Number(i.fcstValue)).filter((v) => Number.isFinite(v));
    const tmn = num("TMN")[0] ?? null, tmx = num("TMX")[0] ?? null;
    const pops = num("POP");
    const pcp = day.filter((i) => i.category === "PCP" && i.fcstValue !== "강수없음").map((i) => i.fcstValue)[0] ?? null;
    return { configured: true, forecast: { date: tomorrow, tmn, tmx, pop: pops.length ? Math.max(...pops) : null, pcp, place } };
  } catch { return { configured: true, forecast: null }; }
}
