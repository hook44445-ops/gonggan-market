// ════════════════════════════════════════════════════════════════════
// 라운지 뉴스·트렌드 글 만들기(순수 함수 — 네트워크 없음, 테스트 가능) — 09-26
//   대표 지시: 「뉴스와 트렌드를 발행함으로 공간마켓 라운지 유입」 · 「인테리어 아닌 콘텐츠도 트렌드 요소로 유입」
//   지키는 선
//     · 지어내지 않는다 — 글에 들어가는 사실은 출처가 준 것(키워드·검색량·기사 제목·링크·예보 수치)뿐.
//     · 기사 본문·요약을 옮기지 않는다 — 제목과 링크, 언론사 이름만. 해설은 «공간마켓 체크포인트»로 따로.
//     · 사건·사고·정치·논란 키워드는 뺀다(집 이야기로 잇기에 부적절).
//   글 모양: RichContent(## 소제목 · - 목록 · **굵게** · [글](https://…) 링크).
// ════════════════════════════════════════════════════════════════════

// 사건·사고·정치·논란 — 트렌드 모음·뉴스 글에서 뺀다
const SENSITIVE = /(시체|시신|사체|유해|베팅|배팅|betting|토토|도박|카지노|사망|숨져|숨진|숨졌|별세|부고|사고|참사|살해|살인|폭행|성범죄|성폭|성추행|자살|극단|실종|추락|화재|폭발|마약|구속|체포|피의자|혐의|기소|재판|선고|징역|전쟁|테러|공습|지진|대통령|국회|여당|야당|의원|탄핵|선거|총선|대선|논란|의혹|열애|이혼|사기|피해자)/;
export const isSensitive = (text) => SENSITIVE.test(String(text ?? ""));

// 링크 글자에서 링크 문법을 깨는 글자만 정리 · 길면 자른다
const linkText = (s, max = 0) => {
  const t = String(s ?? "").replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
  return max && t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const HANGUL = /[가-힣]/;
const safeUrl = (u) => (/^https?:\/\/[^\s)]+$/.test(String(u ?? "")) ? String(u) : null);

// 키워드 → 공간으로 잇는 고리(있는 것만 · 사실 주장 없이 «점검 권유»만)
export const SPACE_HOOKS = [
  { re: /(전세|월세|임대차|계약갱신|보증금)/, category: "realestate",
    check: ["입주 전 누수·곰팡이·배관 상태를 사진으로 남겨 두기", "원상복구 범위를 계약서에 적어 두기"],
    question: "이사 들어갈 때 가장 먼저 확인하는 곳은 어디인가요?" },
  { re: /(이사|입주|새 ?아파트|분양|사전점검|하자)/, category: "move_in",
    check: ["사전점검 때 창틀·욕실 실리콘·바닥 들뜸 확인", "하자는 날짜 있는 사진으로 남기기"],
    question: "입주할 때 놓쳐서 아쉬웠던 것, 하나만 알려주세요." },
  { re: /(장마|폭우|호우|태풍|습도|곰팡이|결로|누수)/, category: "interior",
    check: ["베란다·창틀 배수구 막힘 확인", "벽 모서리 얼룩은 곰팡이 초기 신호일 수 있어요"],
    question: "비 오는 날 우리 집에서 제일 신경 쓰이는 곳은?" },
  { re: /(한파|영하|폭설|동파|난방)/, category: "interior",
    check: ["외벽 쪽 수도는 보온재로 감싸기", "난방 켜고 환기는 짧게 여러 번 — 결로 줄이기"],
    question: "겨울마다 우리 집에서 제일 추운 자리는 어디예요?" },
  { re: /(폭염|무더위|열대야|에어컨|냉방)/, category: "interior",
    check: ["에어컨 배관 구멍 마감·실외기 주변 통풍 확인", "서향 창은 차광 필름·커튼으로 체감 온도 낮추기"],
    question: "여름에 가장 더운 방, 어떻게 버티고 계세요?" },
  { re: /(인테리어|리모델링|도배|장판|마루|타일|욕실|주방|수납|가구|조명|집꾸미기|셀프)/, category: "interior",
    check: ["견적은 같은 범위로 2곳 이상 받아 비교하기", "추가 공사는 시작 전에 글로 남기기"],
    question: "지금 우리 집에서 제일 바꾸고 싶은 곳은?" },
  { re: /(층간소음|소음|방음)/, category: "interior",
    check: ["바닥 매트·가구 패드부터 — 작은 것부터 줄이기", "방음 공사는 범위와 효과를 먼저 물어보기"],
    question: "층간소음, 어떻게 풀어 보셨어요?" },
  { re: /(아파트|부동산|집값|주택|청약|재건축|재개발)/, category: "realestate",
    check: ["오래된 집은 배관·전기 상태부터 보기", "리모델링 비용은 평수보다 «범위»가 좌우해요"],
    question: "집을 고를 때 가장 먼저 보는 한 가지는?" },
];
export const hookFor = (text) => SPACE_HOOKS.find((h) => h.re.test(String(text ?? ""))) ?? null;

// 집과 관계없는 날 — 계절 한 줄 + 참여 질문(날짜로 돌린다: 같은 날은 같은 결과)
const SEASON_LINES = {
  winter: ["겨울엔 창가 결로부터 — 아침에 창틀 물기 한 번 닦아 주세요.", "난방비는 문틈·창틈에서 새요. 문풍지 하나로도 달라져요."],
  spring: ["봄맞이 정리는 현관부터 — 신발장 한 칸만 비워도 집이 넓어져요.", "환기하기 좋은 계절, 욕실 실리콘 곰팡이도 같이 보세요."],
  summer: ["장마 전 배수구 점검 — 베란다 물빠짐 한 번 확인해 두세요.", "에어컨 켜기 전 필터 청소, 전기요금과 냄새를 같이 잡아요."],
  autumn: ["환절기엔 창틀 실리콘과 결로부터 — 오늘 창가 한 번 보세요.", "가을은 이사·도배가 몰리는 때, 견적은 미리 비교해 두세요."],
};
const QUESTIONS = [
  "오늘 우리 집에서 가장 오래 머문 자리는 어디였나요?",
  "요즘 우리 집에서 제일 마음에 드는 한 곳을 자랑해 주세요.",
  "집에서 쉬는 날, 제일 먼저 하는 일은 뭐예요?",
  "우리 집에서 제일 버리고 싶은 물건 하나는?",
  "지금 방 안에서 바꾸고 싶은 것 딱 하나만 꼽는다면?",
];
const seasonOf = (month) => (month <= 2 || month === 12 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn");
const dayIndex = (d) => Math.floor(Date.UTC(d.y, d.m - 1, d.d) / 86400000);

// KST 날짜 {y,m,d}
export function kstYmd(now = Date.now()) {
  const k = new Date(now + 9 * 3600 * 1000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate() };
}
export const ymdKey = ({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// ① 오늘의 트렌드 모음 — Google 트렌드(한국) 급상승 키워드
//   trends: [{ keyword, traffic, news: [{ title, url, source }] }]
export function composeTrendRoundup(trends, { now = Date.now(), max = 7 } = {}) {
  const ymd = kstYmd(now);
  // 기사 한 건 이상(한글 제목 · 민감어 없음)이 붙은 키워드만 — 출처 없는 키워드는 싣지 않는다
  const picked = (Array.isArray(trends) ? trends : [])
    .filter((t) => t?.keyword && !isSensitive(t.keyword))
    .map((t) => ({ ...t, news: (t.news ?? []).filter((n) => safeUrl(n?.url) && HANGUL.test(n?.title ?? "") && !isSensitive(n?.title)) }))
    .filter((t) => t.news.length > 0)
    .slice(0, max);
  if (picked.length < 3) return null;   // 너무 적으면 쓰지 않는다

  const lines = picked.map((t) => {
    const n = t.news[0];
    const traffic = t.traffic ? ` · 검색 ${t.traffic}` : "";
    return n
      ? `- **${linkText(t.keyword)}**${traffic} — [${linkText(n.title, 60)}](${n.url})${n.source ? ` (${linkText(n.source)})` : ""}`
      : `- **${linkText(t.keyword)}**${traffic}`;
  });

  const allText = picked.map((t) => `${t.keyword} ${(t.news[0]?.title ?? "")}`).join(" ");
  const hook = hookFor(allText);
  const di = dayIndex(ymd);
  const season = SEASON_LINES[seasonOf(ymd.m)];
  const spaceLine = hook ? `오늘 키워드 중 집과 닿는 이야기가 있어요 — ${hook.check[0]}.` : season[di % season.length];
  const question = hook?.question ?? QUESTIONS[di % QUESTIONS.length];

  const content = [
    `구글 트렌드(한국) 기준, 오늘 검색이 크게 늘어난 키워드예요. 기사 원문은 각 언론사 링크에서 확인하세요.`,
    ``,
    `## 오늘의 키워드`,
    ...lines,
    ``,
    `## 공간 한 줄`,
    spaceLine,
    ``,
    `## 오늘의 질문`,
    `${question} 댓글로 들려주세요.`,
    ``,
    `출처: Google 트렌드(trends.google.com, 한국) · 기사 제목과 링크는 해당 언론사`,
  ].join("\n");

  return {
    title: `오늘의 트렌드 ${ymd.m}월 ${ymd.d}일 — ${linkText(picked[0].keyword)} 외 ${picked.length - 1}개`,
    content,
    category: "daily",
    ai_topic: `트렌드 모음 ${ymdKey(ymd)}`,
  };
}

// ② 공간 뉴스 한 건 — 뉴스 검색 결과 1건(제목·링크·언론사)
//   item: { title, url, source, pubDate }
export function composeNewsPost(item, { now = Date.now() } = {}) {
  const url = safeUrl(item?.url);
  const title = linkText(item?.title);
  if (!url || !title || isSensitive(title)) return null;
  const hook = hookFor(title);
  if (!hook) return null;   // 집과 잇는 고리가 없으면 쓰지 않는다
  const ymd = kstYmd(now);
  const content = [
    `오늘 나온 기사 한 건을 공간 쪽에서 짚어 봐요. 기사 내용은 원문 링크에서 확인하세요.`,
    ``,
    `## 기사`,
    `- [${title}](${url})${item.source ? ` (${linkText(item.source)})` : ""}`,
    ``,
    `## 공간마켓 체크포인트`,
    ...hook.check.map((c) => `- ${c}`),
    ``,
    `## 여러분은요?`,
    `${hook.question} 댓글로 경험을 나눠 주세요.`,
    ``,
    `출처: 기사 제목과 링크는 해당 언론사`,
  ].join("\n");
  return {
    title: `[공간 뉴스] ${title}`.slice(0, 80),
    content,
    category: hook.category,
    ai_topic: `공간 뉴스 ${ymdKey(ymd)} ${url}`.slice(0, 300),
  };
}

// ③ 날씨와 집 — 기상청 단기예보(내일) 수치로만
//   fc: { date:'YYYYMMDD', tmn, tmx, pop, pcp, place }
export function composeWeatherPost(fc) {
  if (!fc) return null;
  const place = fc.place || "서울";
  const md = fc.date ? `${Number(fc.date.slice(4, 6))}월 ${Number(fc.date.slice(6, 8))}일` : "내일";
  let kind = null;
  if (fc.tmn != null && fc.tmn <= -5) kind = "cold";
  else if (fc.tmx != null && fc.tmx >= 33) kind = "heat";
  else if (fc.pop != null && fc.pop >= 70) kind = "rain";
  if (!kind) return null;   // 평범한 날은 쓰지 않는다

  const facts = [
    fc.tmn != null ? `최저 ${fc.tmn}℃` : null,
    fc.tmx != null ? `최고 ${fc.tmx}℃` : null,
    fc.pop != null ? `강수확률 ${fc.pop}%` : null,
    fc.pcp ? `강수량 ${fc.pcp}` : null,
  ].filter(Boolean).join(" · ");
  const hook = SPACE_HOOKS.find((h) => h.re.test(kind === "cold" ? "한파" : kind === "heat" ? "폭염" : "장마"));
  const head = kind === "cold" ? `${place} 최저 ${fc.tmn}℃ — 수도 동파·결로 대비`
    : kind === "heat" ? `${place} 최고 ${fc.tmx}℃ — 더위 먹는 집 점검`
    : `${place} 강수확률 ${fc.pop}% — 비 오기 전 집 점검`;
  const content = [
    `${md} ${place} 예보예요(기상청 단기예보).`,
    ``,
    `## 예보`,
    `- ${facts}`,
    ``,
    `## 오늘 해 두면 좋은 것`,
    ...hook.check.map((c) => `- ${c}`),
    ``,
    `## 여러분은요?`,
    `${hook.question} 댓글로 들려주세요.`,
    ``,
    `출처: 기상청 단기예보(공공데이터포털)`,
  ].join("\n");
  return { title: `[날씨와 집] ${md} ${head}`, content, category: "interior", ai_topic: `날씨와 집 ${fc.date ?? ""} ${kind}` };
}
