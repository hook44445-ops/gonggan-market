// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { C, R, S, REGIONS } from '../constants';
import { LOUNGE_CATEGORIES } from '../constants/lounge';
import { getAnonymousNickname } from '../utils/anonymousNickname';
import { IS_SUPABASE_READY, createLoungePost, updateLoungePost, uploadLoungeImage, enqueueLoungePostPush } from '../lib/supabase';

const WRITABLE_CATS = LOUNGE_CATEGORIES.filter(c => c.group !== null);
const MAX_IMAGES    = 5;
const MAX_SIZE_MB   = 5;

// ─────────────────────────────────────────────────────
// 글쓰기 안내 가이드 (LOUNGE-WRITE-GUIDE-v1.0)
//  · 카테고리별 작성 양식 = textarea placeholder. 입력 시작 시 자동 소멸, 본문으로 저장되지 않음.
//  · 카테고리 변경 시 placeholder만 교체 — 사용자가 입력한 본문(content)은 그대로 유지.
//  · 안내 문구는 helper text/placeholder로만 동작. SEO·검색·키워드 등 용어는 화면에 노출하지 않음.
// ─────────────────────────────────────────────────────

// ── 카테고리별 작성 가이드(Map) ──────────────────────────
// 카테고리 선택 시 categoryGuide[selectedCategory]만 읽어 화면을 갱신한다.
//  · placeholder      = 제목 입력 placeholder
//  · titleExamples    = 추천 제목(예시 카드) 5개
//  · contentHint      = 내용 입력창 위 부드러운 안내
//  · contentExample   = 내용 입력 placeholder(작성 양식)
// 표시 전용 데이터 — 저장/등록/유효성/디자인에는 일절 영향 없음.
const CATEGORY_GUIDE = {
  interior: {
    placeholder: '부천 욕실 리모델링 업체 추천해주세요',
    titleExamples: ['부천 24평 아파트 인테리어 고민', '욕실 리모델링 업체 추천해주세요', '주방 리모델링 견적 봐주세요', '셀프 인테리어 어디부터 시작할까요?', '확장 공사 경험 있으신가요?'],
    contentHint: '공간 정보와 고민을 적어주시면 더 정확한 답변을 받을 수 있어요.',
    contentExample: `공간 유형 :\n평수 :\n예산 :\n궁금한 점 :\n\n예)\n24평 아파트입니다.\n욕실 리모델링을 고민 중인데\n적정 비용이 어느 정도인지 궁금합니다.`,
  },
  review: {
    placeholder: '30평 아파트 리모델링 후기',
    titleExamples: ['강서구 도배 시공 후기', '30평 아파트 리모델링 후기', '욕실 공사 전후 비교', '주방 시공 솔직 후기', '셀프 시공 도전기'],
    contentHint: '지역과 공사 내용을 함께 적으면 같은 고민을 가진 분들에게 도움이 돼요.',
    contentExample: `지역 :\n공사 종류 :\n공사 범위 :\n좋았던 점 / 아쉬웠던 점 :\n\n예)\n부천 24평 아파트 전체 도배를 진행했습니다.\n마감은 깔끔했는데\n일정이 조금 늦어진 점이 아쉬웠어요.`,
  },
  quote_worry: {
    placeholder: '이 견적 적당한가요?',
    titleExamples: ['32평 욕실 리모델링 견적이 궁금합니다', '이 견적 적당한가요?', '도배 장판 견적 봐주세요', '주방 공사 비용 어느 정도일까요?', '견적서 항목이 적정한지 봐주세요'],
    contentHint: '지역, 평수, 공사 종류를 적어주시면 업체가 더 정확하게 안내할 수 있어요.',
    contentExample: `지역 :\n평수 :\n공사 종류 :\n예상 예산 :\n\n예)\n부천 32평 아파트 욕실 2개를\n리모델링하려고 합니다.\n받은 견적이 적정한지 궁금합니다.`,
  },
  room_deco: {
    placeholder: '원룸 꾸미기 추천 부탁드립니다',
    titleExamples: ['원룸 꾸미기 추천 부탁드립니다', '거실 분위기 바꾸고 싶어요', '셀프 인테리어 소품 추천', '침실 무드등 추천해주세요', '벽 꾸미기 아이디어 있을까요?'],
    contentHint: '원하는 분위기와 현재 사진이 있으면 더 많은 아이디어를 받을 수 있어요.',
    contentExample: `공간 :\n원하는 분위기 :\n현재 고민 :\n참고하고 싶은 스타일 :\n\n예)\n6평 원룸입니다.\n아늑한 분위기로 꾸미고 싶은데\n가구 배치가 고민이에요.`,
  },
  move_in: {
    placeholder: '부천 포장이사 업체 추천',
    titleExamples: ['부천 포장이사 업체 추천', '신축 입주 전 확인할 것', '이사 청소 어디에 맡기셨나요?', '입주 청소 비용 궁금합니다', '이사 체크리스트 공유해요'],
    contentHint: '지역과 이사/입주 일정을 적으면 더 현실적인 도움을 받을 수 있어요.',
    contentExample: `지역 :\n입주/이사 예정일 :\n준비 중인 것 :\n고민되는 부분 :\n\n예)\n다음 달 부천으로 이사 예정입니다.\n포장이사 업체를 알아보고 있는데\n추천 부탁드립니다.`,
  },
  realestate: {
    placeholder: '부천 신축 아파트 어디가 좋을까요?',
    titleExamples: ['구축 아파트 매매 전 확인할 점', '부천 신축 아파트 어디가 좋을까요?', '전세 계약 시 주의할 점', '월세 vs 전세 고민됩니다', '투자용 매물 봐주세요'],
    contentHint: '지역과 매매/전세/월세, 고민을 적으면 더 현실적인 의견을 받을 수 있어요.',
    contentExample: `지역 :\n매매/전세/월세 :\n실거주/투자 :\n고민되는 부분 :\n\n예)\n부천 신축 아파트 매매를 고민 중입니다.\n실거주 목적인데\n지금 들어가도 괜찮을지 궁금합니다.`,
  },
  marriage: {
    placeholder: '예식장 추천 부탁드립니다',
    titleExamples: ['예식장 추천 부탁드립니다', '스드메 어디서 하셨나요?', '신혼집 인테리어 견적 봐주세요', '혼수 가전 추천해주세요', '결혼 준비 순서 알려주세요'],
    contentHint: '준비 중인 항목과 예산, 고민을 적으면 더 구체적인 도움을 받을 수 있어요.',
    contentExample: `준비 단계 :\n지역 :\n예산 :\n고민되는 부분 :\n\n예)\n내년 봄 결혼 예정입니다.\n부천 근처 예식장을 알아보고 있는데\n추천 부탁드립니다.`,
  },
  dating: {
    placeholder: '소개팅 애프터 어떻게 해야 할까요?',
    titleExamples: ['소개팅 애프터 어떻게 해야 할까요?', '연애 고민 들어주세요', '데이트 코스 추천 부탁드려요', '첫 데이트 장소 추천', '썸 타는 중인데 조언 구해요'],
    contentHint: '상황과 고민을 편하게 적어주시면 다양한 의견을 들을 수 있어요.',
    contentExample: `현재 상황 :\n고민되는 부분 :\n듣고 싶은 조언 :\n\n예)\n소개팅 후 애프터를 신청하고 싶은데\n어떻게 연락하면 자연스러울지\n고민이에요.`,
  },
  health: {
    placeholder: '허리 통증 운동 추천해주세요',
    titleExamples: ['허리 통증 운동 추천해주세요', '수면 습관 어떻게 바꾸면 좋을까요?', '건강검진 어디서 받으세요?', '목 디스크 관리법 궁금해요', '영양제 추천 부탁드립니다'],
    contentHint: '현재 고민과 생활 습관을 함께 적으면 더 공감되는 답변을 받을 수 있어요.',
    contentExample: `현재 고민 :\n생활 습관 :\n궁금한 점 :\n\n예)\n앉아서 일하는 시간이 길어\n허리가 자주 아픕니다.\n집에서 할 수 있는 운동이 궁금합니다.`,
  },
  stock: {
    placeholder: '삼성전자 지금 매수해도 될까요?',
    titleExamples: ['삼성전자 지금 사도 될까요?', '장기투자 종목 추천 부탁드립니다', 'ETF 처음인데 뭐부터 살까요?', '배당주 추천해주세요', '미국주식 입문 질문입니다'],
    contentHint: '관심 종목과 투자 고민을 적어보세요.',
    contentExample: `관심 종목 :\n투자 기간 :\n궁금한 점 :\n\n예)\n삼성전자 매수를 고민 중입니다.\n장기 투자 목적으로 보고 있는데\n지금 들어가도 괜찮을까요?`,
  },
  ai: {
    placeholder: 'ChatGPT 어떻게 활용하세요?',
    titleExamples: ['ChatGPT 업무 활용법 질문', '노션 AI 써보신 분 계신가요?', 'AI 이미지 생성 툴 추천', '엑셀 자동화 도움받고 싶어요', '코딩 입문 어떻게 시작할까요?'],
    contentHint: '사용 중인 도구나 궁금한 기능을 적으면 더 정확한 답변을 받을 수 있어요.',
    contentExample: `사용 중인 도구 :\n궁금한 기능 :\n활용하고 싶은 부분 :\n\n예)\nChatGPT를 업무에 활용하고 싶은데\n보고서 작성에 어떻게 쓰면 좋을지\n궁금합니다.`,
  },
  jobs: {
    placeholder: '면접 준비 어떻게 하셨나요?',
    titleExamples: ['면접 준비 어떻게 하셨나요?', '자소서 봐주실 분 계신가요?', '이직 타이밍 고민됩니다', '신입 포트폴리오 조언 구해요', '연봉 협상 어떻게 하나요?'],
    contentHint: '직무, 현재 상황, 고민을 적으면 경험자들이 답하기 쉬워요.',
    contentExample: `직무/분야 :\n현재 상황 :\n고민되는 부분 :\n\n예)\n마케팅 직무로 취업 준비 중입니다.\n면접을 앞두고 있는데\n어떻게 준비하면 좋을지 궁금합니다.`,
  },
  pet: {
    placeholder: '강아지 산책 코스 추천해주세요',
    titleExamples: ['강아지 산책 코스 추천해주세요', '고양이 사료 추천 부탁드려요', '반려동물 동반 카페 있을까요?', '강아지 분리불안 어떻게 하셨나요?', '동물병원 추천해주세요'],
    contentHint: '반려동물 종류와 현재 고민을 적으면 더 공감되는 답변을 받을 수 있어요.',
    contentExample: `반려동물 종류 :\n현재 고민 :\n생활 환경 :\n\n예)\n3살 강아지를 키우고 있습니다.\n혼자 있을 때 분리불안이 심한데\n어떻게 도와줄 수 있을까요?`,
  },
  exercise: {
    placeholder: '헬스 루틴 추천해주세요',
    titleExamples: ['헬스 루틴 추천해주세요', 'PT 받아볼까요?', '다이어트 식단 추천', '러닝화 추천 부탁드립니다', '운동 루틴 봐주세요'],
    contentHint: '운동 목표와 현재 상태를 적어보세요.',
    contentExample: `운동 목적 :\n운동 경력 :\n현재 상태 :\n궁금한 점 :\n\n예)\n다이어트를 시작하려고 합니다.\n주 3회 운동이 가능한데\n초보자 루틴 추천 부탁드립니다.`,
  },
  startup: {
    placeholder: '소자본 창업 아이템 추천',
    titleExamples: ['소자본 창업 아이템 추천', '카페 창업 준비 순서 궁금해요', '상가 자리 봐주실 분 계신가요?', '온라인 쇼핑몰 시작 조언 구해요', '창업 초기 비용 어느 정도일까요?'],
    contentHint: '업종과 현재 단계, 고민을 적으면 경험자들의 조언을 받을 수 있어요.',
    contentExample: `업종/아이템 :\n현재 단계 :\n예산 :\n고민되는 부분 :\n\n예)\n소자본으로 카페 창업을 준비 중입니다.\n아이템은 정했는데\n입지 선정이 고민이에요.`,
  },
  travel: {
    placeholder: '부산 여행 코스 추천',
    titleExamples: ['부산 여행 코스 추천', '제주 2박3일 일정 봐주세요', '가족 여행지 추천 부탁드려요', '혼자 여행 어디가 좋을까요?', '가성비 숙소 추천해주세요'],
    contentHint: '여행지와 일정, 예산을 적으면 더 구체적인 추천을 받을 수 있어요.',
    contentExample: `여행지 :\n일정 :\n예산 :\n궁금한 점 :\n\n예)\n부산으로 2박 3일 여행 예정입니다.\n맛집과 야경 위주로\n코스를 짜고 싶은데 추천 부탁드립니다.`,
  },
  restaurant: {
    placeholder: '송도 맛집 추천해주세요',
    titleExamples: ['송도 맛집 추천해주세요', '분위기 좋은 카페 추천', '가성비 식당 있을까요?', '가족모임 식당 추천', '혼밥 맛집 추천'],
    contentHint: '지역과 원하는 분위기를 적어보세요.',
    contentExample: `지역 :\n인원 :\n예산 :\n원하는 분위기 :\n\n예)\n송도에서\n2명이 갈 만한\n가성비 좋은 맛집 추천 부탁드립니다.`,
  },
  daily: {
    placeholder: '전기세 절약 방법 있을까요?',
    titleExamples: ['전기세 절약 방법 있을까요?', '자취 꿀팁 공유해요', '분리수거 이렇게 하는 거 맞나요?', '생활용품 추천 부탁드려요', '청소 노하우 알려주세요'],
    contentHint: '어떤 상황인지 조금만 자세히 적어주시면 더 좋은 답변을 받을 수 있어요.',
    contentExample: `상황 :\n궁금한 점 :\n듣고 싶은 의견 :\n\n예)\n혼자 자취를 시작했습니다.\n전기세가 많이 나와서\n절약 방법이 궁금합니다.`,
  },
  local: {
    placeholder: '부천 살기 어떤가요?',
    titleExamples: ['부천 살기 어떤가요?', '우리 동네 추천 장소 있어요', '근처 병원 추천 부탁드려요', '동네 모임 구해요', '새로 이사 왔는데 정보 구해요'],
    contentHint: '동네와 궁금한 점을 적으면 이웃들의 생생한 답변을 받을 수 있어요.',
    contentExample: `동네 :\n궁금한 점 :\n듣고 싶은 정보 :\n\n예)\n부천으로 이사를 고민 중입니다.\n주거 환경과 편의시설이\n어떤지 궁금합니다.`,
  },
  humor: {
    placeholder: '오늘 있었던 웃긴 일',
    titleExamples: ['오늘 있었던 웃긴 일', '이거 나만 웃긴가요?', '웃픈 일상 공유', '오늘의 짤 투척', '빵 터진 순간 공유해요'],
    contentHint: '편하게 오늘의 이야기를 나눠보세요.',
    contentExample: `무슨 일이 있었나요?\n\n예)\n오늘 출근길에 있었던\n웃긴 일을 공유합니다.`,
  },
  free: {
    placeholder: '편하게 이야기 나눠요',
    titleExamples: ['편하게 이야기 나눠요', '다들 오늘 하루 어땠나요?', '잡담 환영합니다', '고민 들어주실 분', '소소한 이야기 나눠요'],
    contentHint: '무슨 이야기든 편하게 적어보세요.',
    contentExample: `무슨 이야기를 나눠볼까요?\n\n예)\n오늘 있었던 일 :\n궁금한 점 :\n다른 분들 의견을 듣고 싶은 부분 :`,
  },
};

// 미선택/미정의 카테고리 기본 가이드
const DEFAULT_GUIDE = {
  placeholder: '검색하기 쉬운 제목을 적어보세요  ·  예) 부천 인테리어 업체 추천',
  titleExamples: ['부천 인테리어 업체 추천 부탁드립니다', '신혼집 인테리어 견적 봐주세요', '셀프도배 비용 얼마나 들까요?', '송도 맛집 추천해주세요', '편하게 이야기 나눠요'],
  contentHint: '어떤 상황인지 조금만 자세히 적어주시면 더 좋은 답변을 받을 수 있어요.',
  contentExample: `무슨 이야기를 나눠볼까요?\n\n예)\n오늘 있었던 일 :\n궁금한 점 :\n다른 분들 의견을 듣고 싶은 부분 :`,
};

const guideFor = (cat) => CATEGORY_GUIDE[cat] ?? DEFAULT_GUIDE;

// 제목 아래 공통 안내 — 간결한 검색 친화 안내 (카테고리별 예시 자동 변경 v1.0)
const TITLE_HELPER = '💡 지역명, 제품명, 브랜드명을 함께 적으면 더 많은 사람들이 쉽게 글을 찾을 수 있어요.';

// 사진 안내 문구 — 견적고민/시공후기/인테리어/집꾸미기에서 특히 노출
const PHOTO_HELPER_CATS = ['quote_worry', 'review', 'interior', 'room_deco'];
const PHOTO_HELPER = '사진을 함께 올리면 상황을 이해하기 쉬워 더 정확한 답변을 받을 수 있어요.';

// 등록 직전 부드러운 안내 기준 — 차단하지 않고 안내만 표시
const SHORT_CONTENT_LEN = 15;
const SHORT_CONTENT_HELPER = '조금만 더 자세히 적어주시면 더 많은 분들이 도움을 드릴 수 있어요.';

const contentGuideFor  = (cat) => guideFor(cat).contentExample;
const titleGuideFor    = (cat) => guideFor(cat).placeholder;
const contentHelperFor = (cat) => guideFor(cat).contentHint;

// editPost: existing post object when editing, null when creating new
export default function LoungeWriteScreen({ user, onBack, onPublish, editPost = null }) {
  const isEdit = !!editPost;

  const [category,   setCategory]   = useState(editPost?.category ?? '');
  const [title,      setTitle]      = useState(editPost?.title ?? '');
  const [content,    setContent]    = useState(editPost?.content ?? '');
  const [region,     setRegion]     = useState(editPost?.region ?? '');
  const [gender,     setGender]     = useState(editPost?.gender ?? '');
  const [ageGroup,   setAgeGroup]   = useState(editPost?.age_group ?? '');
  const [images,     setImages]     = useState(
    (editPost?.image_urls ?? []).map(url => ({ file: null, url, name: '', existing: true }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        setError('이미지 파일만 업로드할 수 있어요');
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하로 올려주세요`);
        continue;
      }
      valid.push({ file: f, url: URL.createObjectURL(f), name: f.name, existing: false });
    }
    setImages(prev => [...prev, ...valid].slice(0, MAX_IMAGES));
    if (valid.length) setError('');
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setImages(prev => {
      const img = prev[idx];
      if (!img.existing) URL.revokeObjectURL(img.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!category) { setError('카테고리를 선택해주세요'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요'); return; }

    setSubmitting(true);
    setError('');

    // Supabase를 사용할 수 있는 조건: URL/키 설정됨 + 로그인 사용자
    const useSupabase = IS_SUPABASE_READY && !user?.isGuest && !!user?.id;

    // 이미지 public URL 변환 (Supabase Storage 업로드)
    const resolveImageUrls = async () => {
      if (!useSupabase) return images.map(img => img.url); // 오프라인: blob URL 그대로
      return Promise.all(images.map(async (img) => {
        if (img.existing || !img.file) return img.url; // 기존 public URL 유지
        const { data: up, error: upErr } = await uploadLoungeImage(img.file, user.id);
        if (upErr) return img.url; // Storage 실패 시 blob URL fallback
        return up.publicUrl;
      }));
    };

    if (isEdit) {
      const imageUrls = await resolveImageUrls();
      const updates = {
        category,
        title:      title.trim() || null,
        content:    content.trim(),
        image_urls: imageUrls,
        gender:     gender || null,
        age_group:  ageGroup || null,
        region:     region || null,
      };
      if (useSupabase) {
        const { data, error: err } = await updateLoungePost(editPost.id, user.id, updates);
        if (import.meta.env.DEV) {
        }
        setSubmitting(false);
        if (err) { setError('수정에 실패했습니다. RLS 정책을 확인하세요 (005_lounge_owner_update.sql 실행 필요)'); return; }
        onPublish?.({ ...editPost, ...updates, ...(data ?? {}) });
      } else {
        try {
          const key = 'lounge_offline_posts';
          const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
          localStorage.setItem(key, JSON.stringify(prev.map(p => p.id === editPost.id ? { ...p, ...updates } : p)));
        } catch {}
        await new Promise(r => setTimeout(r, 300));
        setSubmitting(false);
        onPublish?.({ ...editPost, ...updates });
      }
    } else {
      // UUID 생성 — Supabase lounge_posts.id 는 uuid 타입
      const postId   = crypto.randomUUID();
      const nickname = getAnonymousNickname(user?.id ?? 'guest', postId);
      const imageUrls = await resolveImageUrls();

      const newPost = {
        id:                 postId,
        user_id:            user?.id ?? null,
        anonymous_nickname: nickname,
        category,
        title:              title.trim() || null,
        content:            content.trim(),
        image_urls:         imageUrls,
        gender:             gender || null,
        age_group:          ageGroup || null,
        region:             region || null,
        is_story:           false,
        is_deleted:         false,
        is_hidden:          false,
        view_count:         0,
        like_count:         0,
        comment_count:      0,
        created_at:         new Date().toISOString(),
        has_badge:          !!(user?.badge && user.badge !== 'basic'),
        // 전문가(업체) 글 — 프로필 카드 자동 연결 + 상단 노출 우선
        is_expert:          (user?.role === 'company' || user?.activeRole === 'company'),
        expert_company_name: (user?.role === 'company' || user?.activeRole === 'company') ? (user?.companyName ?? user?.name ?? null) : null,
      };

      if (useSupabase) {
        const { data, error: err } = await createLoungePost(newPost);
        setSubmitting(false);
        if (err) { setError('등록 중 오류가 발생했어요. 다시 시도해주세요.'); return; }
        // 적격 수신자에게 푸시 큐잉(작성자 제외·지역/카테고리 매칭·중복 방지는 RPC 내부 처리) — 실패해도 등록 흐름엔 영향 없음
        if (!isEdit && data?.id) { try { await enqueueLoungePostPush(data.id); } catch {} }
        onPublish?.(data ?? newPost);
      } else {
        try {
          const key = 'lounge_offline_posts';
          const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
          localStorage.setItem(key, JSON.stringify([newPost, ...prev.filter(p => p.id !== newPost.id)]));
        } catch {}
        await new Promise(r => setTimeout(r, 300));
        setSubmitting(false);
        onPublish?.(newPost);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>{isEdit ? '글 수정' : '글쓰기'}</div>
        <button onClick={handleSubmit} disabled={submitting} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '8px 18px', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? (isEdit ? '수정중...' : '등록중...') : (isEdit ? '수정' : '등록')}
        </button>
      </div>

      <div style={{ padding: S.xl }}>
        {!isEdit && (user?.role === 'company' || user?.activeRole === 'company') && (
          <div style={{ background: '#C4A96A14', border: '1px solid #C4A96A', borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#8A6D2A', marginBottom: 4 }}>
              <span style={{ background: '#C4A96A22', border: '1px solid #C4A96A', borderRadius: R.full, padding: '2px 8px', fontSize: 11, marginRight: 6 }}>전문가 글</span>
              이 글은 전문가(업체) 글로 등록돼요
            </div>
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.7 }}>
              시공 전후 이야기, 자재 선택 팁, 견적 실수 방지, 욕실·주방·도배 노하우, 현장 경험처럼
              도움이 되는 콘텐츠일수록 신뢰가 쌓여요. 광고·전화 유도·직거래는 지양해주세요.
            </div>
          </div>
        )}

        {!isEdit && (
          <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
            <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.6 }}>
              🛡 글 작성 시 익명 아이디가 자동 배정됩니다.<br/>
              같은 글의 댓글에서는 동일 익명이 유지됩니다.<br/>
              다른 글에서는 새로운 닉네임이 배정됩니다.
            </div>
          </div>
        )}

        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>카테고리 <span style={{ color: C.red }}>*</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.sm }}>
            {WRITABLE_CATS.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ padding: '6px 14px', borderRadius: R.full, border: 'none', background: category === cat.id ? C.brand : C.bg, color: category === cat.id ? '#fff' : C.text3, fontWeight: category === cat.id ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: S.lg }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>제목 (선택)</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={titleGuideFor(category)} maxLength={100}
            style={{ width: '100%', padding: '14px 16px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 15, outline: 'none', boxSizing: 'border-box', background: C.surface, color: C.text1, fontFamily: 'inherit' }} />
          <div style={{ fontSize: 11.5, color: C.text4, marginTop: 6, lineHeight: 1.5 }}>{TITLE_HELPER}</div>

          {/* 제목 예시 카드 — 연베이지 카드 + 체크. 안내 전용(등록값 영향 없음) */}
          <div style={{ background: C.sand, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px`, marginTop: S.sm }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text3, marginBottom: 8 }}>이런 제목이 좋아요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guideFor(category).titleExamples.map(ex => (
                <div key={ex} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: C.text2, lineHeight: 1.5 }}>
                  <span style={{ color: C.brand, fontWeight: 900, flexShrink: 0 }}>✔</span>
                  <span>{ex}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: S.lg }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>내용 <span style={{ color: C.red }}>*</span></div>
          <div style={{ fontSize: 11.5, color: C.text4, marginBottom: S.xs, lineHeight: 1.5 }}>{contentHelperFor(category)}</div>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={contentGuideFor(category)} rows={8}
            style={{ width: '100%', padding: '14px 16px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: C.surface, color: C.text1, fontFamily: 'inherit', lineHeight: 1.6 }} />
          {content.trim().length > 0 && content.trim().length < SHORT_CONTENT_LEN && (
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 6, lineHeight: 1.5 }}>{SHORT_CONTENT_HELPER}</div>
          )}
        </div>

        {/* 이미지 업로드 */}
        <div style={{ marginBottom: S.lg }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>
            사진 (선택, 최대 {MAX_IMAGES}장)
          </div>
          {PHOTO_HELPER_CATS.includes(category) && (
            <div style={{ fontSize: 11.5, color: C.text4, marginBottom: S.sm, lineHeight: 1.5 }}>{PHOTO_HELPER}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img.url} alt="" style={{ width: 80, height: 80, borderRadius: R.md, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <div onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: R.md, border: `2px dashed ${C.bgWarm}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', background: C.surface }}>
                <span style={{ fontSize: 24, color: C.text4 }}>📷</span>
                <span style={{ fontSize: 10, color: C.text4 }}>추가</span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
          <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>JPG·PNG·GIF · 최대 {MAX_SIZE_MB}MB</div>
        </div>

        <div style={{ display: 'flex', gap: S.sm, marginBottom: S.lg, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.xs }}>지역 (선택)</div>
            <select value={region} onChange={e => setRegion(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 13, background: C.surface, color: region ? C.text1 : C.text3, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">선택 안함</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.xs }}>성별 (선택)</div>
            <select value={gender} onChange={e => setGender(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 13, background: C.surface, color: gender ? C.text1 : C.text3, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">비공개</option>
              <option value="male">남</option>
              <option value="female">여</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.xs }}>나이대 (선택)</div>
            <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 13, background: C.surface, color: ageGroup ? C.text1 : C.text3, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">비공개</option>
              {['20대','30대','40대','50대+'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEF0F0', borderRadius: R.lg, padding: S.md, marginBottom: S.lg }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
