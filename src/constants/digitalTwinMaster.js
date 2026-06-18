// ─────────────────────────────────────────────────────
// Digital Twin Ready Master (DIGITAL-TWIN-READY-MASTER-v1.0)
//
// 공간 데이터의 "언어"를 통일하기 위한 Master 뼈대입니다.
// 이번 버전은 디지털 트윈 기능 구현이 아니라, 향후 아래 데이터들이
// 같은 기준(공간 유형 · 공간 위치 · 공사 종류)을 쓰도록 준비하는 단계입니다.
//   견적 요청 · 업체 입찰 · 계약 · 포트폴리오 · 사진 · GPS 증빙 · 리뷰
//   · 관리자 시딩 · 향후 AI 공간 분석 · 향후 디지털 트윈
//
// 확장 흐름:
//   Property Type → Room Type → Work Type → Project
//                 → Photo / GPS / Material / Timeline → Digital Twin
//
// ⚠️ 라운지 카테고리(커뮤니티/SEO용, src/constants/lounge.js)와는
//    절대 섞지 않습니다. 이 파일은 "공간/공사 데이터"용 Master입니다.
//    라운지 카테고리를 이 Master로 옮기지 않습니다.
//
// 구현 방식: 1차는 상수(설정)로만 구현합니다. DB Master Table·Migration 없음.
//    단, 향후 DB 전환이 쉽도록 { key, label, description, isActive, sortOrder }
//    형태로 구조화합니다(각 행이 곧 DB row가 되도록).
//
// 사용자 UI는 단순하게 유지합니다(노출 3단계):
//   1) 어떤 공간인가요?  → Property Type
//   2) 어디를 고치나요?  → Room Type
//   3) 어떤 공사인가요?  → Work Type
// ─────────────────────────────────────────────────────

// ── Master 1: Property Type (공간 유형) ──────────────────────────────────────
export const PROPERTY_TYPES = [
  { key: 'residential',      label: '주거',      description: '아파트·빌라·주택 등 주거 공간', isActive: true, sortOrder: 1 },
  { key: 'office',           label: '사무실',    description: '오피스·업무 공간',              isActive: true, sortOrder: 2 },
  { key: 'commercial',       label: '상업공간',  description: '매장·상가 등 상업 공간',         isActive: true, sortOrder: 3 },
  { key: 'cafe',             label: '카페',      description: '카페·디저트 매장',              isActive: true, sortOrder: 4 },
  { key: 'restaurant',       label: '음식점',    description: '식당·주점 등 외식 공간',         isActive: true, sortOrder: 5 },
  { key: 'medical',          label: '병원',      description: '의원·병원·치과 등 의료 공간',    isActive: true, sortOrder: 6 },
  { key: 'education',        label: '교육시설',  description: '학원·교실 등 교육 공간',         isActive: true, sortOrder: 7 },
  { key: 'lodging',          label: '숙박시설',  description: '호텔·모텔·펜션 등 숙박 공간',     isActive: true, sortOrder: 8 },
  { key: 'factory_warehouse',label: '공장/창고', description: '공장·물류·창고 등 산업 공간',    isActive: true, sortOrder: 9 },
  { key: 'other',            label: '기타',      description: '위 분류에 속하지 않는 공간',     isActive: true, sortOrder: 99 },
];

// ── Master 2: Room Type (공간 위치) — Property Type별 선택지 ──────────────────
// key는 Property Type 내에서만 유일하면 됩니다(예: residential.kitchen, cafe.kitchen).
// '전체(all)'는 모든 Property Type 공통의 첫 항목으로 둡니다.
export const ROOM_TYPES_BY_PROPERTY = {
  residential: [
    { key: 'all',          label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'living_room',  label: '거실',      isActive: true, sortOrder: 2 },
    { key: 'kitchen',      label: '주방',      isActive: true, sortOrder: 3 },
    { key: 'bathroom',     label: '욕실',      isActive: true, sortOrder: 4 },
    { key: 'room',         label: '방',        isActive: true, sortOrder: 5 },
    { key: 'master_room',  label: '안방',      isActive: true, sortOrder: 6 },
    { key: 'kids_room',    label: '아이방',    isActive: true, sortOrder: 7 },
    { key: 'entrance',     label: '현관',      isActive: true, sortOrder: 8 },
    { key: 'veranda',      label: '베란다',    isActive: true, sortOrder: 9 },
    { key: 'utility_room', label: '다용도실',  isActive: true, sortOrder: 10 },
    { key: 'other',        label: '기타',      isActive: true, sortOrder: 99 },
  ],
  office: [
    { key: 'all',          label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'work_area',    label: '사무공간',  isActive: true, sortOrder: 2 },
    { key: 'meeting_room', label: '회의실',    isActive: true, sortOrder: 3 },
    { key: 'ceo_room',     label: '대표실',    isActive: true, sortOrder: 4 },
    { key: 'lounge',       label: '휴게실',    isActive: true, sortOrder: 5 },
    { key: 'pantry',       label: '탕비실',    isActive: true, sortOrder: 6 },
    { key: 'storage',      label: '창고',      isActive: true, sortOrder: 7 },
    { key: 'restroom',     label: '화장실',    isActive: true, sortOrder: 8 },
    { key: 'other',        label: '기타',      isActive: true, sortOrder: 99 },
  ],
  commercial: [
    { key: 'all',           label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'store',         label: '매장',      isActive: true, sortOrder: 2 },
    { key: 'hall',          label: '홀',        isActive: true, sortOrder: 3 },
    { key: 'counter',       label: '카운터',    isActive: true, sortOrder: 4 },
    { key: 'storage',       label: '창고',      isActive: true, sortOrder: 5 },
    { key: 'restroom',      label: '화장실',    isActive: true, sortOrder: 6 },
    { key: 'outdoor',       label: '외부공간',  isActive: true, sortOrder: 7 },
    { key: 'other',         label: '기타',      isActive: true, sortOrder: 99 },
  ],
  cafe: [
    { key: 'all',       label: '전체',    isActive: true, sortOrder: 1 },
    { key: 'hall',      label: '홀',      isActive: true, sortOrder: 2 },
    { key: 'counter',   label: '카운터',  isActive: true, sortOrder: 3 },
    { key: 'kitchen',   label: '주방',    isActive: true, sortOrder: 4 },
    { key: 'terrace',   label: '테라스',  isActive: true, sortOrder: 5 },
    { key: 'storage',   label: '창고',    isActive: true, sortOrder: 6 },
    { key: 'restroom',  label: '화장실',  isActive: true, sortOrder: 7 },
    { key: 'other',     label: '기타',    isActive: true, sortOrder: 99 },
  ],
  restaurant: [
    { key: 'all',       label: '전체',    isActive: true, sortOrder: 1 },
    { key: 'hall',      label: '홀',      isActive: true, sortOrder: 2 },
    { key: 'kitchen',   label: '주방',    isActive: true, sortOrder: 3 },
    { key: 'counter',   label: '카운터',  isActive: true, sortOrder: 4 },
    { key: 'storage',   label: '창고',    isActive: true, sortOrder: 5 },
    { key: 'restroom',  label: '화장실',  isActive: true, sortOrder: 6 },
    { key: 'other',     label: '기타',    isActive: true, sortOrder: 99 },
  ],
  medical: [
    { key: 'all',             label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'reception',       label: '접수공간',  isActive: true, sortOrder: 2 },
    { key: 'waiting_room',    label: '대기실',    isActive: true, sortOrder: 3 },
    { key: 'exam_room',       label: '진료실',    isActive: true, sortOrder: 4 },
    { key: 'treatment_room',  label: '치료실',    isActive: true, sortOrder: 5 },
    { key: 'consult_room',    label: '상담실',    isActive: true, sortOrder: 6 },
    { key: 'staff_area',      label: '직원공간',  isActive: true, sortOrder: 7 },
    { key: 'restroom',        label: '화장실',    isActive: true, sortOrder: 8 },
    { key: 'other',           label: '기타',      isActive: true, sortOrder: 99 },
  ],
  education: [
    { key: 'all',           label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'lecture_room',  label: '강의실',    isActive: true, sortOrder: 2 },
    { key: 'classroom',     label: '교실',      isActive: true, sortOrder: 3 },
    { key: 'consult_room',  label: '상담실',    isActive: true, sortOrder: 4 },
    { key: 'office',        label: '사무실',    isActive: true, sortOrder: 5 },
    { key: 'lounge',        label: '휴게공간',  isActive: true, sortOrder: 6 },
    { key: 'restroom',      label: '화장실',    isActive: true, sortOrder: 7 },
    { key: 'other',         label: '기타',      isActive: true, sortOrder: 99 },
  ],
  lodging: [
    { key: 'all',          label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'guest_room',   label: '객실',      isActive: true, sortOrder: 2 },
    { key: 'lobby',        label: '로비',      isActive: true, sortOrder: 3 },
    { key: 'corridor',     label: '복도',      isActive: true, sortOrder: 4 },
    { key: 'bathroom',     label: '욕실',      isActive: true, sortOrder: 5 },
    { key: 'common_area',  label: '공용공간',  isActive: true, sortOrder: 6 },
    { key: 'laundry',      label: '세탁실',    isActive: true, sortOrder: 7 },
    { key: 'storage',      label: '창고',      isActive: true, sortOrder: 8 },
    { key: 'other',        label: '기타',      isActive: true, sortOrder: 99 },
  ],
  factory_warehouse: [
    { key: 'all',           label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'workshop',      label: '작업장',    isActive: true, sortOrder: 2 },
    { key: 'storage',       label: '창고',      isActive: true, sortOrder: 3 },
    { key: 'office',        label: '사무공간',  isActive: true, sortOrder: 4 },
    { key: 'entrance',      label: '출입구',    isActive: true, sortOrder: 5 },
    { key: 'loading_area',  label: '적재공간',  isActive: true, sortOrder: 6 },
    { key: 'restroom',      label: '화장실',    isActive: true, sortOrder: 7 },
    { key: 'other',         label: '기타',      isActive: true, sortOrder: 99 },
  ],
  other: [
    { key: 'all',       label: '전체',      isActive: true, sortOrder: 1 },
    { key: 'indoor',    label: '내부공간',  isActive: true, sortOrder: 2 },
    { key: 'outdoor',   label: '외부공간',  isActive: true, sortOrder: 3 },
    { key: 'restroom',  label: '화장실',    isActive: true, sortOrder: 4 },
    { key: 'other',     label: '기타',      isActive: true, sortOrder: 99 },
  ],
};

// ── Master 3: Work Type (공사 종류) ──────────────────────────────────────────
export const WORK_TYPES = [
  { key: 'full',          label: '전체공사',  isActive: true, sortOrder: 1 },
  { key: 'partial',       label: '부분공사',  isActive: true, sortOrder: 2 },
  { key: 'wallpaper',     label: '도배',      isActive: true, sortOrder: 3 },
  { key: 'flooring_sheet',label: '장판',      isActive: true, sortOrder: 4 },
  { key: 'hardwood',      label: '마루',      isActive: true, sortOrder: 5 },
  { key: 'tile',          label: '타일',      isActive: true, sortOrder: 6 },
  { key: 'film',          label: '필름',      isActive: true, sortOrder: 7 },
  { key: 'paint',         label: '페인트',    isActive: true, sortOrder: 8 },
  { key: 'bathroom',      label: '욕실',      isActive: true, sortOrder: 9 },
  { key: 'kitchen',       label: '주방',      isActive: true, sortOrder: 10 },
  { key: 'electric',      label: '전기',      isActive: true, sortOrder: 11 },
  { key: 'lighting',      label: '조명',      isActive: true, sortOrder: 12 },
  { key: 'plumbing',      label: '배관',      isActive: true, sortOrder: 13 },
  { key: 'carpentry',     label: '목공',      isActive: true, sortOrder: 14 },
  { key: 'furniture',     label: '가구',      isActive: true, sortOrder: 15 },
  { key: 'storage',       label: '수납',      isActive: true, sortOrder: 16 },
  { key: 'window_door',   label: '창호',      isActive: true, sortOrder: 17 },
  { key: 'middle_door',   label: '중문',      isActive: true, sortOrder: 18 },
  { key: 'demolition',    label: '철거',      isActive: true, sortOrder: 19 },
  { key: 'waterproof',    label: '방수',      isActive: true, sortOrder: 20 },
  { key: 'facility',      label: '설비',      isActive: true, sortOrder: 21 },
  { key: 'hvac',          label: '냉난방',    isActive: true, sortOrder: 22 },
  { key: 'signage',       label: '간판',      isActive: true, sortOrder: 23 },
  { key: 'exterior',      label: '외벽',      isActive: true, sortOrder: 24 },
  { key: 'cleaning',      label: '청소',      isActive: true, sortOrder: 25 },
  { key: 'defect_repair', label: '하자보수',  isActive: true, sortOrder: 26 },
  { key: 'other',         label: '기타',      isActive: true, sortOrder: 99 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
// 향후 DB 전환 시에도 호출부가 바뀌지 않도록 조회 함수를 함께 제공합니다.

// 활성 Property Type 목록(sortOrder 정렬) — UI 노출용
export const getActivePropertyTypes = () =>
  PROPERTY_TYPES.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

// key로 Property Type 단건 조회
export const getPropertyTypeByKey = (key) =>
  PROPERTY_TYPES.find(p => p.key === key) || null;

// Property Type key에 해당하는 활성 Room Type 목록(sortOrder 정렬)
// 알 수 없는 key면 빈 배열을 반환합니다(호출부 안전).
export const getRoomTypesByProperty = (propertyKey) =>
  (ROOM_TYPES_BY_PROPERTY[propertyKey] || [])
    .filter(r => r.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

// Property Type + Room Type key로 Room Type 단건 조회
export const getRoomTypeByKey = (propertyKey, roomKey) =>
  (ROOM_TYPES_BY_PROPERTY[propertyKey] || []).find(r => r.key === roomKey) || null;

// 활성 Work Type 목록(sortOrder 정렬) — UI 노출용
export const getActiveWorkTypes = () =>
  WORK_TYPES.filter(w => w.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

// key로 Work Type 단건 조회
export const getWorkTypeByKey = (key) =>
  WORK_TYPES.find(w => w.key === key) || null;
