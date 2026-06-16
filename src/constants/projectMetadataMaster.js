// ─────────────────────────────────────────────────────
// Project Entity Ready Master (PROJECT-ENTITY-READY-v1.0)
//
// 공간마켓의 중심은 "견적"이 아니라 "Project(공간)"입니다.
// 모든 데이터(견적요청·입찰·계약·에스크로·증빙·GPS·사진·AI·Digital Twin)는
// 하나의 Project를 기준으로 연결됩니다. Project는 계약이 끝나도 사라지지 않는
// "공간의 생애주기(Lifecycle)"를 기록하는 기본 단위입니다.
//
// 이번 버전은 DB 변경·기능 구현이 아니라, Project 메타데이터 구조를
// 표준화하는 준비 단계입니다.
//   · DB Master Table / Migration / RLS / API 수정 없음
//   · 향후 DB 전환이 쉽도록 { key, label, ... , sortOrder } 형태로 구조화
//
// 공간 정보(Property/Room/Work Type)는 중복 정의하지 않고
// Digital Twin Master(src/constants/digitalTwinMaster.js)를 단일 출처로 재사용합니다.
// ─────────────────────────────────────────────────────

import {
  PROPERTY_TYPES,
  ROOM_TYPES_BY_PROPERTY,
  WORK_TYPES,
} from './digitalTwinMaster.js';

// ── Project Status (공간 생애주기 상태) ──────────────────────────────────────
// index.js 의 TRANSACTION_STATUS(거래 상태머신)와는 별개의 "Project 단위" 상태입니다.
// 거래 상태가 Project 상태로 점진 매핑될 수 있도록 준비만 합니다(연결은 향후 PR).
export const PROJECT_STATUS = {
  REQUESTED:    'REQUESTED',
  BIDDING:      'BIDDING',
  CONTRACTED:   'CONTRACTED',
  ESCROW:       'ESCROW',
  CONSTRUCTION: 'CONSTRUCTION',
  INSPECTION:   'INSPECTION',
  COMPLETED:    'COMPLETED',
  CLOSED:       'CLOSED',
};

// 표시/정렬용 메타. color/bg 는 기존 톤(index.js)과 일관되게 사용.
export const PROJECT_STATUS_META = {
  REQUESTED:    { label: '견적 요청',  description: '공간 견적이 요청된 단계',        sortOrder: 1, color: '#7A8A7E', bg: '#F0EDE8', icon: '📋' },
  BIDDING:      { label: '입찰 중',    description: '업체들이 입찰하는 단계',          sortOrder: 2, color: '#B08040', bg: '#FBF5E8', icon: '💬' },
  CONTRACTED:   { label: '계약 체결',  description: '업체 선정 후 계약이 체결된 단계',  sortOrder: 3, color: '#1D3D2F', bg: '#E8F0EC', icon: '📝' },
  ESCROW:       { label: '예치 완료',  description: '공간안전결제(에스크로) 예치 단계',  sortOrder: 4, color: '#2E5F4B', bg: '#EAF2EE', icon: '🔒' },
  CONSTRUCTION: { label: '시공 중',    description: '실제 공사가 진행되는 단계',        sortOrder: 5, color: '#1D3D2F', bg: '#E8F0EC', icon: '🏗' },
  INSPECTION:   { label: '점검 중',    description: '중간/완료 점검 단계',             sortOrder: 6, color: '#B08040', bg: '#FBF5E8', icon: '🔍' },
  COMPLETED:    { label: '시공 완료',  description: '공사가 완료된 단계',              sortOrder: 7, color: '#2E5F4B', bg: '#EAF2EE', icon: '🎉' },
  CLOSED:       { label: '종료',       description: '정산·기록 보존 후 종료된 단계',    sortOrder: 8, color: '#7A8A7E', bg: '#F5F1EA', icon: '🗂' },
};

// 활성 순서대로 정렬된 Project Status 목록(UI 노출용)
export const getProjectStatusList = () =>
  Object.keys(PROJECT_STATUS_META)
    .map((key) => ({ key, ...PROJECT_STATUS_META[key] }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

export const getProjectStatusMeta = (key) => PROJECT_STATUS_META[key] || null;

// ── Warranty (A/S) — 업체별 정책 ─────────────────────────────────────────────
// ⚠️ 고정 "A/S 1년" 제거 준비. A/S는 업체별 정책으로 관리합니다.
//    공간보증(GUARANTEE, company 예치금 배지)과는 별개의 "프로젝트 단위" A/S 메타입니다.
//
// Warranty 구조(향후 Project/계약에 부착):
//   { enabled, provider, period, scope, memo }
//     · enabled  : 제공 여부(boolean)
//     · provider : 보증 주체(기본 'company' — 업체 제공)
//     · period   : WARRANTY_PERIODS 의 key (custom 시 customPeriod 사용)
//     · scope    : 보증 범위(자유 텍스트 또는 향후 표준화)
//     · memo     : 비고
export const WARRANTY_PROVISION = {
  PROVIDED:     'PROVIDED',     // 제공
  NOT_PROVIDED: 'NOT_PROVIDED', // 미제공
};

export const WARRANTY_PROVISION_META = {
  PROVIDED:     { label: '제공',   sortOrder: 1 },
  NOT_PROVIDED: { label: '미제공', sortOrder: 2 },
};

// 보증 주체 — 1차는 업체(company) 제공. 향후 확장(플랫폼/제조사 등) 대비.
export const WARRANTY_PROVIDERS = [
  { key: 'company', label: '업체 제공', isActive: true, sortOrder: 1 },
];

// 보증 기간 옵션 — 고정 1년 제거. 업체가 선택, custom 은 직접입력.
export const WARRANTY_PERIODS = [
  { key: 'days_7',   label: '7일',     days: 7,   isActive: true, sortOrder: 1 },
  { key: 'days_30',  label: '30일',    days: 30,  isActive: true, sortOrder: 2 },
  { key: 'days_90',  label: '90일',    days: 90,  isActive: true, sortOrder: 3 },
  { key: 'days_180', label: '180일',   days: 180, isActive: true, sortOrder: 4 },
  { key: 'year_1',   label: '1년',     days: 365, isActive: true, sortOrder: 5 },
  { key: 'year_2',   label: '2년',     days: 730, isActive: true, sortOrder: 6 },
  { key: 'custom',   label: '직접입력', days: null, isActive: true, sortOrder: 99 },
];

// 묶음 export(스펙 ⑥의 WARRANTY_OPTIONS) — 한 번에 참조 가능한 옵션 모음.
export const WARRANTY_OPTIONS = {
  provision: WARRANTY_PROVISION,
  provisionMeta: WARRANTY_PROVISION_META,
  providers: WARRANTY_PROVIDERS,
  periods: WARRANTY_PERIODS,
};

// Warranty 기본값(미설정 Project 안전 표시용). 고정 1년 아님 — 기본 비활성.
export const DEFAULT_WARRANTY = {
  enabled: false,
  provider: 'company',
  period: null,       // WARRANTY_PERIODS key. enabled=true 시 업체가 선택.
  customPeriod: null, // period==='custom' 일 때 사용(일수 또는 텍스트)
  scope: null,
  memo: null,
};

export const getWarrantyPeriodByKey = (key) =>
  WARRANTY_PERIODS.find((p) => p.key === key) || null;

// ── Timeline (공간 생애주기 단계) ────────────────────────────────────────────
// Evidence/증빙이 어느 단계에 속하는지 묶는 기준 축.
export const TIMELINE_TYPES = [
  { key: 'request',      label: '견적요청', description: '공간 견적 요청', isActive: true, sortOrder: 1 },
  { key: 'bid',          label: '입찰',     description: '업체 입찰',      isActive: true, sortOrder: 2 },
  { key: 'contract',     label: '계약',     description: '계약 체결',      isActive: true, sortOrder: 3 },
  { key: 'escrow',       label: '에스크로', description: '예치/정산',      isActive: true, sortOrder: 4 },
  { key: 'construction', label: '시공',     description: '공사 진행',      isActive: true, sortOrder: 5 },
  { key: 'completion',   label: '완료',     description: '시공 완료',      isActive: true, sortOrder: 6 },
];

export const getTimelineTypeByKey = (key) =>
  TIMELINE_TYPES.find((t) => t.key === key) || null;

// ── Evidence (증빙 타입) — 향후 연결 대상 ────────────────────────────────────
// 실제 저장/업로드 구현 없음. Project에 어떤 증빙이 붙을 수 있는지 "언어"만 통일.
export const EVIDENCE_TYPES = [
  { key: 'gps',              label: 'GPS',       description: '위치 증빙',        isActive: true, sortOrder: 1 },
  { key: 'photo',            label: '사진',       description: '시공/현장 사진',    isActive: true, sortOrder: 2 },
  { key: 'chat',             label: '채팅',       description: '대화 기록',         isActive: true, sortOrder: 3 },
  { key: 'files',            label: '파일',       description: '도면·문서 등 첨부',  isActive: true, sortOrder: 4 },
  { key: 'approval_history', label: '승인 이력',  description: '단계 승인 기록',     isActive: true, sortOrder: 5 },
];

export const getEvidenceTypeByKey = (key) =>
  EVIDENCE_TYPES.find((e) => e.key === key) || null;

// ── Project Metadata Schema (참조용 청사진) ──────────────────────────────────
// 향후 DB Project Entity / API payload 가 따를 표준 형태를 한곳에 문서화합니다.
// 실제 타입 강제는 하지 않으며, 각 필드가 어떤 Master를 출처로 하는지 명시합니다.
export const PROJECT_METADATA_SCHEMA = {
  // 공간 정보 — Digital Twin Master 단일 출처
  space: {
    propertyType: { source: 'PROPERTY_TYPES',           type: 'key',  required: false },
    roomType:     { source: 'ROOM_TYPES_BY_PROPERTY',   type: 'key',  required: false },
    workTypes:    { source: 'WORK_TYPES',               type: 'key[]', required: false },
  },
  // 프로젝트 정보
  project: {
    status:         { source: 'PROJECT_STATUS', type: 'key',    required: true, default: PROJECT_STATUS.REQUESTED },
    budget:         { type: 'number', unit: 'KRW',  required: false }, // 예산(원)
    area:           { type: 'number', unit: 'm2',   required: false }, // 면적(㎡)
    startDate:      { type: 'date',                 required: false }, // 착공일
    completionDate: { type: 'date',                 required: false }, // 완료일
  },
  // A/S — 업체별 정책(고정 1년 아님)
  warranty: { shape: 'DEFAULT_WARRANTY', source: 'WARRANTY_OPTIONS', required: false },
  // 생애주기 단계
  timeline: { source: 'TIMELINE_TYPES', type: 'key[]', required: false },
  // 증빙(향후 연결)
  evidence: { source: 'EVIDENCE_TYPES', type: 'key[]', required: false },
};

// Project 기본 메타데이터 골격 생성기(빈 Project 안전 초기화용).
// 실제 저장 로직 아님 — 향후 폼/서비스에서 초기값으로 재사용 가능.
export const createEmptyProjectMetadata = () => ({
  space: { propertyType: null, roomType: null, workTypes: [] },
  project: {
    status: PROJECT_STATUS.REQUESTED,
    budget: null,
    area: null,
    startDate: null,
    completionDate: null,
  },
  warranty: { ...DEFAULT_WARRANTY },
  timeline: [],
  evidence: [],
});

// 공간 정보 Master 재노출(편의) — 호출부가 두 파일을 모두 import하지 않도록.
export { PROPERTY_TYPES, ROOM_TYPES_BY_PROPERTY, WORK_TYPES };
