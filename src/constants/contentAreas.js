// ════════════════════════════════════════════════════════════════════
// 공간라운지 Content Areas — 콘텐츠 영역 레지스트리 (Phase 12)
//
//   생성 엔진(categoryVoiceWriter/LLM/Workbench)은 수정하지 않는다. 이 파일은 "지원 분야"를
//   확장하기 위한 순수 데이터 레지스트리다. 각 영역을 Category Voice · Coverage · Keyword ·
//   Prompt(의도) 로 "분리 관리"한다.
//
//   · voiceId        : categoryVoice.js 의 voice 로 매핑(엔진이 실제로 사용하는 톤/구성/정책).
//   · spaceLinkPolicy: 공간 연결 정책 — 억지 연결 금지. 필요할 때만 light.
//   · category       : 대응하는 라운지 카테고리 id(없으면 개념 영역 → 키워드로 감지).
//   · keywords       : 감지/검색 키워드.  recommended: 추천/자동확장 키워드.
//   · prompt         : 이 영역의 프롬프트 의도(톤/스타일/전문성/주의). voice.tone 이 실제 반영 지점.
//
//   Space is Everything 철학은 유지하되 공간에 억지로 끼워맞추지 않는다(카테고리 본질 우선).
// ════════════════════════════════════════════════════════════════════

export const CONTENT_AREAS = [
  { id: "economy", label: "경제", voiceId: "analytical", spaceLinkPolicy: "light", category: "realestate",
    keywords: ["경제", "금리", "물가", "환율", "인플레이션", "경기", "gdp"],
    recommended: ["금리", "물가", "환율", "소비", "고용", "GDP", "무역", "성장률"],
    prompt: { tone: "데이터 중심·균형", style: "숫자 우선, 단정 대신 근거", expertise: "거시지표 해석", caution: "과장·확정 예측 금지" } },

  { id: "kr_stock", label: "국내주식", voiceId: "analytical", spaceLinkPolicy: "none", category: "stock",
    keywords: ["국내주식", "코스피", "코스닥", "배당", "실적", "공매도", "삼성전자"],
    recommended: ["반도체", "배당", "ETF", "실적", "코스피", "테마주"],
    prompt: { tone: "데이터·리스크 명시", style: "뉴스 요약 가능, 투자 권유 금지", expertise: "종목·산업 흐름", caution: "투자 권유 금지·리스크 명시" } },

  { id: "us_stock", label: "해외주식", voiceId: "analytical", spaceLinkPolicy: "none", category: "stock",
    keywords: ["해외주식", "미국주식", "나스닥", "에스앤피", "s&p", "테슬라", "엔비디아"],
    recommended: ["미국주식", "나스닥", "ETF", "실적", "반도체", "빅테크"],
    prompt: { tone: "데이터·리스크 명시", style: "환율·시차 고려, 투자 권유 금지", expertise: "글로벌 시장", caution: "투자 권유 금지·리스크 명시" } },

  { id: "realestate", label: "부동산", voiceId: "analytical", spaceLinkPolicy: "light", category: "realestate",
    keywords: ["부동산", "집값", "전세", "월세", "청약", "분양", "재건축"],
    recommended: ["금리", "청약", "전세", "분양", "규제", "입지"],
    prompt: { tone: "데이터·균형", style: "지역·시기 맥락", expertise: "시장·정책", caution: "확정 예측 금지" } },

  { id: "startup", label: "창업", voiceId: "practical", spaceLinkPolicy: "light", category: "startup",
    keywords: ["창업", "상가", "매장", "자영업", "프랜차이즈", "사업계획"],
    recommended: ["상권", "비용", "인허가", "프랜차이즈", "마케팅", "손익"],
    prompt: { tone: "실용·구체", style: "체크리스트·비용", expertise: "창업 준비", caution: "성공 보장 금지" } },

  { id: "ai", label: "AI", voiceId: "analytical", spaceLinkPolicy: "light", category: null,
    keywords: ["ai", "인공지능", "챗gpt", "chatgpt", "gpt", "생성형", "llm", "머신러닝"],
    recommended: ["생성형 AI", "활용법", "프롬프트", "자동화", "최신 모델", "트렌드"],
    prompt: { tone: "기술 설명·정확", style: "쉽게 + 실제 활용 + 최신 트렌드", expertise: "AI 기술·응용", caution: "과장 금지·출처 의식" } },

  { id: "it", label: "IT", voiceId: "tech", spaceLinkPolicy: "light", category: null,
    keywords: ["아이티", "소프트웨어", "개발자", "프로그래밍", "클라우드", "테크", "앱 개발"],
    recommended: ["개발", "클라우드", "보안", "오픈소스", "생산성 도구", "트렌드"],
    prompt: { tone: "기술·트렌드", style: "핵심 개념 + 실제 활용", expertise: "IT 산업·도구", caution: "과장 금지" } },

  { id: "science", label: "과학", voiceId: "informational", spaceLinkPolicy: "none", category: null,
    keywords: ["과학", "연구", "우주", "물리", "화학", "생물", "실험", "논문"],
    recommended: ["연구", "우주", "생명과학", "물리", "기후", "발견"],
    prompt: { tone: "정보·정확", style: "쉬운 설명, 출처 의식", expertise: "과학 일반", caution: "과장·비약 금지" } },

  { id: "book", label: "좋은 책", voiceId: "review_pick", spaceLinkPolicy: "none", category: null,
    keywords: ["독서", "서평", "베스트셀러", "완독", "좋은 책", "책 추천", "책추천", "도서 추천", "읽은 책"],
    recommended: ["베스트셀러", "인문", "경제경영", "소설", "자기계발", "에세이"],
    prompt: { tone: "핵심 메시지 중심", style: "줄거리보다 메시지·적용점", expertise: "독서·리뷰", caution: "스포일러 주의·추천 대상 명시" } },

  { id: "movie", label: "영화", voiceId: "review_pick", spaceLinkPolicy: "none", category: null,
    keywords: ["영화", "개봉", "시사회", "감독", "스크린", "영화 추천"],
    recommended: ["개봉작", "추천 영화", "감독", "장르", "OTT 영화", "명작"],
    prompt: { tone: "감상·핵심 중심", style: "스포일러 최소, 추천 대상 명시", expertise: "영화 리뷰", caution: "스포일러 주의" } },

  { id: "drama", label: "드라마", voiceId: "review_pick", spaceLinkPolicy: "none", category: null,
    keywords: ["드라마", "시리즈", "넷플릭스", "오티티", "ott", "회차", "정주행"],
    recommended: ["넷플릭스", "정주행", "화제작", "출연진", "결말", "추천 드라마"],
    prompt: { tone: "감상·핵심 중심", style: "스포일러 최소", expertise: "드라마 리뷰", caution: "스포일러 주의" } },

  { id: "game", label: "게임", voiceId: "review_pick", spaceLinkPolicy: "none", category: null,
    keywords: ["게임", "플레이", "콘솔", "스팀", "공략", "출시", "인디게임"],
    recommended: ["신작", "공략", "추천 게임", "콘솔", "인디", "업데이트"],
    prompt: { tone: "경험·핵심 중심", style: "재미 요소·추천 대상", expertise: "게임 리뷰", caution: "과장 금지" } },

  { id: "auto", label: "자동차", voiceId: "informational", spaceLinkPolicy: "light", category: null,
    keywords: ["자동차", "전기차", "시승", "연비", "suv", "차량", "신차"],
    recommended: ["전기차", "시승", "연비", "신차", "유지비", "안전"],
    prompt: { tone: "정보·실용", style: "스펙 + 실사용 관점", expertise: "자동차", caution: "광고성 표현 지양" } },

  { id: "travel", label: "여행", voiceId: "experiential", spaceLinkPolicy: "light", category: "travel",
    keywords: ["여행", "코스", "숙소", "항공", "관광", "당일치기", "여행지"],
    recommended: ["코스", "계절", "이동시간", "숙소", "맛집", "예산"],
    prompt: { tone: "경험·생생함", style: "코스·계절·이동시간", expertise: "여행 정보", caution: "실제 정보 우선" } },

  { id: "food", label: "맛집", voiceId: "experiential", spaceLinkPolicy: "light", category: "restaurant",
    keywords: ["맛집", "식당", "카페", "메뉴", "웨이팅", "가성비"],
    recommended: ["분위기", "가격", "메뉴", "웨이팅", "추천 대상", "주차"],
    prompt: { tone: "경험·생생함", style: "분위기·가격·추천 대상", expertise: "맛집 리뷰", caution: "광고성 지양" } },

  { id: "health", label: "건강", voiceId: "careful_health", spaceLinkPolicy: "none", category: "health",
    keywords: ["건강", "운동", "수면", "다이어트", "영양", "스트레칭"],
    recommended: ["수면", "운동", "식단", "스트레스", "루틴", "예방"],
    prompt: { tone: "조심스럽게·일반정보", style: "진단·처방 아님 전제", expertise: "건강 일반", caution: "전문가 상담 안내" } },

  { id: "self_dev", label: "자기계발", voiceId: "growth", spaceLinkPolicy: "none", category: null,
    keywords: ["자기계발", "습관", "생산성", "루틴", "동기부여", "목표설정", "시간관리"],
    recommended: ["습관", "생산성", "루틴", "목표", "시간관리", "몰입"],
    prompt: { tone: "실천 중심", style: "오늘 할 수 있는 것 위주", expertise: "자기계발", caution: "단정·과장 금지" } },

  { id: "history", label: "역사", voiceId: "contemplative", spaceLinkPolicy: "none", category: null,
    keywords: ["역사", "조선", "고려", "세계사", "유적", "왕조", "근현대사"],
    recommended: ["조선", "세계사", "인물", "사건", "유적", "배경"],
    prompt: { tone: "차분·깊이", style: "맥락·배경 중심", expertise: "역사", caution: "사실 확인·해석 균형" } },

  { id: "philosophy", label: "철학", voiceId: "contemplative", spaceLinkPolicy: "none", category: null,
    keywords: ["철학", "사유", "존재", "윤리", "형이상학", "니체", "칸트"],
    recommended: ["존재", "윤리", "사유", "삶의 의미", "사상가", "개념"],
    prompt: { tone: "차분·깊이", style: "개념을 쉽게 풀되 깊이 유지", expertise: "철학", caution: "특정 사상 강요 금지" } },
];

const norm = (s) => String(s ?? "").toLowerCase();

// 토픽 텍스트로 콘텐츠 영역 감지(첫 매칭). 없으면 null.
export function contentAreaFor(topic = "") {
  const t = norm(topic);
  if (!t) return null;
  return CONTENT_AREAS.find((a) => a.keywords.some((k) => t.includes(norm(k)))) || null;
}

// 추천/자동확장 키워드 — 영역 감지 후 연관 키워드 반환.
export function recommendedKeywordsFor(topic = "") {
  return contentAreaFor(topic)?.recommended ?? [];
}

// Space Coverage(spaceCoverage.js)로 넘길 커버리지 엔트리 형태로 변환.
export function contentCoverageAreas() {
  return CONTENT_AREAS.map((a) => ({ id: a.id, label: a.label, category: a.category, keywords: a.keywords }));
}
