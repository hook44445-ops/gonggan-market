// ─────────────────────────────────────────────────────
// 공간마켓 라운지 — 자동 태그 / 인기 점수 / 검색 매칭 공용 유틸
// (Lounge Phase - Search & SEO v1.0)
//
// 순수 모듈(의존성 최소·DOM 없음). 제목/내용/지역/카테고리에서 태그를 실시간
// 도출하여 ① 검색 ② 인기글 ③ 지역검색 ④ 자동 태그 표시에 공통 재사용한다.
// DB·Migration 변경 없음. 추후 DB tags 컬럼 영속화로 무리 없이 확장 가능.
// ─────────────────────────────────────────────────────

import { REGIONS, CITY_DISTRICTS } from '../constants';
import { CATEGORY_LABEL } from '../constants/lounge';

// 지역 토큰 — 시/도(서울·경기·인천) + 구/시/군 풀네임 + 접미사 제거 베이스("부천시"→"부천").
// 길이 2 미만(중/동 등)은 오탐 방지를 위해 제외.
const REGION_TOKENS = (() => {
  const set = new Set(REGIONS);
  for (const districts of Object.values(CITY_DISTRICTS)) {
    for (const d of districts) {
      set.add(d);
      const base = d.replace(/(특별시|광역시|시|군|구)$/u, '');
      if (base.length >= 2) set.add(base);
    }
  }
  // 긴 토큰 우선 매칭(부천시 > 부천)을 위해 길이 내림차순 정렬
  return [...set].sort((a, b) => b.length - a.length);
})();

// 공간/공사/주제 키워드 — 본문에 등장하면 태그로 승격. 검색·추천 기반 데이터.
const KEYWORD_TOKENS = [
  '인테리어', '리모델링', '도배', '장판', '타일', '욕실', '주방', '샷시', '창호',
  '조명', '전기', '페인트', '필름', '마루', '바닥', '철거', '확장', '단열', '방수',
  '누수', '셀프', '수리', '시공', '견적', '후기',
  '아파트', '빌라', '주택', '오피스텔', '원룸', '투룸', '상가', '카페', '사무실',
  '신혼집', '혼수', '입주', '이사', '반려동물', '맛집', '여행',
];

// 카테고리 라벨에서 이모지/기호 제거 → 순수 한글/영문 태그
const cleanLabel = (label) =>
  String(label ?? '')
    .replace(/[^가-힣a-zA-Z0-9·]/g, '')
    .trim();

const regionBase = (region) => {
  const last = String(region ?? '').trim().split(/\s+/).pop() ?? '';
  const base = last.replace(/(특별시|광역시|시|군|구)$/u, '');
  return base.length >= 2 ? base : last;
};

/**
 * 글에서 자동 태그를 도출한다. (저장 없음 · 표시/검색용)
 * 순서: 지역 → 키워드 → 카테고리. 중복 제거 후 max개로 제한.
 * @returns {string[]} '#' 없는 순수 토큰 배열
 */
export function extractLoungeTags(post, { max = 6 } = {}) {
  if (!post) return [];
  const text = `${post.title ?? ''} ${post.content ?? ''}`;
  const tags = [];
  const push = (t) => { if (t && !tags.includes(t)) tags.push(t); };

  // 1) 명시적 지역 필드 우선
  if (post.region) push(regionBase(post.region));

  // 2) 본문 내 지역 토큰 (최대 2개)
  let regionHits = 0;
  for (const r of REGION_TOKENS) {
    if (regionHits >= 2) break;
    if (text.includes(r)) { push(r); regionHits++; }
  }

  // 3) 공간/공사/주제 키워드
  for (const k of KEYWORD_TOKENS) {
    if (tags.length >= max) break;
    if (text.includes(k)) push(k);
  }

  // 4) 카테고리 라벨 (마지막 보강)
  const cat = cleanLabel(CATEGORY_LABEL[post.category]);
  if (cat) push(cat);

  return tags.slice(0, max);
}

/**
 * 인기 점수 — 조회·좋아요·댓글 참여도 + 최신성 가중.
 * engagement = 조회 + 좋아요*3 + 댓글*5
 * recency    = 30일에 걸쳐 선형 감쇠(0~1), 최근 글일수록 가산
 * score      = engagement * (1 + recency)  → 참여도 높은 글은 유지, 신선한 글은 부양
 */
export function loungePopularityScore(post) {
  if (!post) return 0;
  const views    = Number(post.view_count) || 0;
  const likes    = Number(post.like_count) || 0;
  const comments = Number(post.comment_count) || 0;
  const engagement = views + likes * 3 + comments * 5;

  const created = post.created_at ? new Date(post.created_at).getTime() : Date.now();
  const ageDays = Math.max(0, (Date.now() - created) / 86400000);
  const recency = Math.max(0, 1 - ageDays / 30);

  return engagement * (1 + recency);
}

/**
 * 검색 매칭 — 제목·내용·닉네임·지역·업체명·자동 태그를 통합 대상으로 한다.
 * @returns {boolean}
 */
export function matchesLoungeSearch(post, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!post || !q) return false;
  const hay = [
    post.title,
    post.content,
    post.anonymous_nickname,
    post.region,
    post.expert_company_name,
    ...extractLoungeTags(post),
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}
