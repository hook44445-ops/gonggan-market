// ════════════════════════════════════════════════════════════════════
// 공간라운지 Category Voice System (Phase 8)
//
//   Space is Everything 은 최상위 "철학"이다. 하지만 글은 억지로 공간에 끼워맞추지 않고
//   각 카테고리의 본질에 맞게 쓴다 — 연애 글은 연애답게, 자격증 글은 정보답게,
//   종교 글은 깊이 있게, 주식 글은 데이터답게.
//
//   각 voice 는 { label, tone, spaceLinkPolicy, sections }. spaceLinkPolicy:
//     · natural : 공간이 본질적으로 관련(인테리어/집꾸미기/창업 등) — 자연스러운 연결 허용
//     · light   : 필요할 때만 가볍게(경제/여행/AI)
//     · none    : 공간 연결 강요 금지(연애/MBTI/자격증/종교/건강)
//
//   순수 데이터. 생성기(categoryVoiceWriter)와 유용성 점수(contentUsefulness)가 참조한다.
// ════════════════════════════════════════════════════════════════════

export const CATEGORY_VOICES = {
  practical: {
    label: "실용·정보",
    tone: "실용적이고 구체적으로. 체크리스트·비용·주의사항 중심.",
    spaceLinkPolicy: "natural",
    sections: ["핵심 요약", "꼭 확인할 것", "비용·주의사항", "마무리"],
  },
  empathy: {
    label: "공감·심리",
    tone: "공감하며 관계의 흐름과 마음을 짚는다. 훈수보다 이해.",
    spaceLinkPolicy: "none",
    sections: ["어떤 마음일까", "관계의 흐름", "생각해볼 점", "마무리"],
  },
  insight_light: {
    label: "가벼운 통찰",
    tone: "가볍고 재미있지만 통찰이 있는 심리 콘텐츠.",
    spaceLinkPolicy: "none",
    sections: ["한눈에", "이런 특징", "이렇게 보면 재밌다", "마무리"],
  },
  informational: {
    label: "정보·가이드",
    tone: "정보형. 일정·준비·공부법·전망 중심. 과장 없이.",
    spaceLinkPolicy: "none",
    sections: ["개요", "일정·준비", "공부법·팁", "전망", "마무리"],
  },
  contemplative: {
    label: "묵상·문화·역사",
    tone: "조용하고 깊이 있게. 문화·역사·묵상 관점. 특정 신앙 강요 없이.",
    spaceLinkPolicy: "none",
    sections: ["오늘의 화두", "배경·역사", "깊이 들여다보기", "마무리"],
  },
  analytical: {
    label: "데이터·분석",
    tone: "데이터 기반, 과장 금지, 균형. 단정적 예측 지양.",
    spaceLinkPolicy: "light",
    sections: ["무슨 일이 있었나", "왜 중요한가", "데이터로 보기", "앞으로 볼 것", "마무리"],
  },
  experiential: {
    label: "경험·사진",
    tone: "경험 중심으로 생생하게. 사진과 함께 보는 콘텐츠.",
    spaceLinkPolicy: "light",
    sections: ["다녀온 곳", "좋았던 점", "실전 팁", "마무리"],
  },
  careful_health: {
    label: "건강 일반정보",
    tone: "조심스럽게, 일반 정보 중심. 진단·처방이 아님을 전제.",
    spaceLinkPolicy: "none",
    sections: ["무엇이 궁금한가", "일반적으로 알려진 것", "생활 속 실천", "주의(전문가 상담)", "마무리"],
  },
  general: {
    label: "일반",
    tone: "편안하고 읽기 쉽게.",
    spaceLinkPolicy: "light",
    sections: ["도입", "본문", "마무리"],
  },
  // ── Phase 12 추가 voice(콘텐츠 영역 확장) ──
  tech: {
    label: "기술·트렌드",
    tone: "기술을 쉽게 설명하고 실제 활용과 최신 트렌드를 짚는다. 과장 없이 정확하게.",
    spaceLinkPolicy: "light",
    sections: ["한눈에", "어떻게 작동하나", "실제 활용", "최신 트렌드", "마무리"],
  },
  review_pick: {
    label: "리뷰·추천",
    tone: "줄거리·스포일러보다 핵심 메시지와 적용점 중심. 추천 대상을 분명히.",
    spaceLinkPolicy: "none",
    sections: ["한줄 소개", "핵심 메시지", "이런 점이 좋다", "추천 대상", "마무리"],
  },
  growth: {
    label: "자기계발·실천",
    tone: "실천 중심으로 구체적으로. 단정·과장 없이, 오늘 할 수 있는 것 위주.",
    spaceLinkPolicy: "none",
    sections: ["왜 중요한가", "핵심 원칙", "오늘부터 실천", "주의할 점", "마무리"],
  },
};

// 라운지 카테고리 id → voice.
const CATEGORY_VOICE_MAP = {
  interior: "practical", review: "practical", quote_worry: "practical",
  room_deco: "practical", move_in: "practical", startup: "practical",
  "staff-talk": "practical", pet: "practical",
  dating: "empathy", marriage: "empathy",
  realestate: "analytical", stock: "analytical", jobs: "analytical",
  travel: "experiential", restaurant: "experiential",
  health: "careful_health", exercise: "careful_health",
  daily: "general", local: "general", humor: "general", free: "general",
};

// 개념 영역(라운지 카테고리가 없는 주제) 감지 — 토픽 키워드로 voice 를 덮어쓴다.
//   MBTI·자격증·종교·AI·인도점성술 등. (사주·타로는 별도 정책상 확장 제외 대상)
const CONCEPT_VOICES = [
  { area: "mbti",      voice: "insight_light",  match: ["mbti", "엠비티아이", "성격유형", "16personalities", "intj", "enfp"] },
  { area: "cert",      voice: "informational",  match: ["자격증", "시험", "합격", "필기", "실기", "공무원", "toeic", "자격"] },
  { area: "religion",  voice: "contemplative",  match: ["종교", "교회", "성경", "불교", "사찰", "성당", "명상", "기도", "묵상", "예배"] },
  { area: "astrology", voice: "informational",  match: ["점성술", "별자리", "인도점성", "베다", "조티시"] },
  { area: "ai",        voice: "analytical",     match: ["ai", "인공지능", "챗gpt", "chatgpt", "gpt", "로봇", "생성형"] },
  { area: "society",   voice: "analytical",     match: ["사회", "정책", "복지", "저출산", "고령화", "이슈"] },
  // ── Phase 12 콘텐츠 영역 확장(개념 영역 감지 · 충돌 안전 키워드) ──
  { area: "economy",   voice: "analytical",  match: ["경제", "금리", "물가", "환율", "인플레이션", "gdp"] },
  { area: "kr_stock",  voice: "analytical",  match: ["코스피", "코스닥", "국내주식", "배당", "공매도"] },
  { area: "us_stock",  voice: "analytical",  match: ["미국주식", "해외주식", "나스닥", "에스앤피", "테슬라", "엔비디아"] },
  { area: "it",        voice: "tech",        match: ["소프트웨어", "개발자", "프로그래밍", "클라우드", "아이티"] },
  { area: "science",   voice: "informational", match: ["과학", "우주", "물리학", "화학", "생물학", "논문"] },
  { area: "book",      voice: "review_pick", match: ["독서", "서평", "베스트셀러", "완독", "좋은 책", "책 추천", "책추천", "도서"] },
  { area: "movie",     voice: "review_pick", match: ["영화", "개봉작", "시사회"] },
  { area: "drama",     voice: "review_pick", match: ["드라마", "넷플릭스", "정주행"] },
  { area: "game",      voice: "review_pick", match: ["게임", "공략", "콘솔", "스팀"] },
  { area: "auto",      voice: "informational", match: ["자동차", "전기차", "시승", "연비"] },
  { area: "self_dev",  voice: "growth",      match: ["자기계발", "습관 형성", "생산성", "루틴", "동기부여", "시간관리"] },
  { area: "history",   voice: "contemplative", match: ["역사", "조선시대", "세계사", "왕조"] },
  { area: "philosophy", voice: "contemplative", match: ["철학", "형이상학", "니체", "칸트", "윤리학"] },
];

const norm = (s) => String(s ?? "").toLowerCase();

// 카테고리 + 토픽으로 voice 를 결정한다. 개념 영역이 감지되면 그 voice 가 우선.
//   반환: { id, area, ...voice }
export function voiceFor(category, topic = "") {
  const t = norm(topic);
  const concept = CONCEPT_VOICES.find((c) => c.match.some((m) => t.includes(norm(m))));
  if (concept) return { id: concept.voice, area: concept.area, ...CATEGORY_VOICES[concept.voice] };
  const key = CATEGORY_VOICE_MAP[category] || "general";
  return { id: key, area: category || null, ...CATEGORY_VOICES[key] };
}
