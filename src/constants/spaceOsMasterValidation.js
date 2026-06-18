// ─────────────────────────────────────────────────────
// Space OS Master Validation (SPACE-OS-MASTER-VALIDATION-v1.0)
//
// 3개 Master(Digital Twin · Project Metadata · Project Type)를 실제 UI/DB에
// 연결하기 전, Master 데이터의 정합성을 확인하는 "준비용 검증 유틸"입니다.
//
//   · 기존 Master를 수정하지 않습니다(import만 합니다).
//   · UI / API 에서 호출하지 않습니다. 향후 통합 PR·UI 연결 전 점검 용도.
//   · 순수 함수 — 입력 데이터를 변형하지 않고 결과 리포트만 반환합니다.
//
// 공통 반환 형식:
//   { isValid: boolean, errors: string[], warnings: string[] }
// ─────────────────────────────────────────────────────

import {
  PROPERTY_TYPES,
  ROOM_TYPES_BY_PROPERTY,
  WORK_TYPES,
} from './digitalTwinMaster.js';

import {
  PROJECT_STATUS_META,
  TIMELINE_TYPES,
  EVIDENCE_TYPES,
  WARRANTY_PERIODS,
  createEmptyProjectMetadata,
} from './projectMetadataMaster.js';

import { PROJECT_TYPES } from './projectTypeMaster.js';

// 검증 결과 표준 형태 생성
const makeResult = () => ({ isValid: true, errors: [], warnings: [] });

// 한 결과(child)를 누적 결과(acc)에 합칩니다.
const mergeResult = (acc, child) => {
  acc.errors.push(...child.errors);
  acc.warnings.push(...child.warnings);
  if (!child.isValid) acc.isValid = false;
  return acc;
};

// 검증 대상 "key 배열 Master" 목록 — { name, items } 형태로 정규화.
// (ROOM_TYPES_BY_PROPERTY 는 property별 하위 배열이라 별도로 펼쳐서 추가)
const collectKeyArrayMasters = () => {
  const masters = [
    { name: 'PROPERTY_TYPES', items: PROPERTY_TYPES },
    { name: 'WORK_TYPES', items: WORK_TYPES },
    { name: 'PROJECT_TYPES', items: PROJECT_TYPES },
    { name: 'TIMELINE_TYPES', items: TIMELINE_TYPES },
    { name: 'EVIDENCE_TYPES', items: EVIDENCE_TYPES },
    { name: 'WARRANTY_PERIODS', items: WARRANTY_PERIODS },
    // PROJECT_STATUS_META 는 객체(map) 형태 — key/sortOrder/label 보유하도록 정규화
    {
      name: 'PROJECT_STATUS_META',
      items: Object.entries(PROJECT_STATUS_META).map(([key, v]) => ({ key, ...v })),
    },
  ];
  Object.entries(ROOM_TYPES_BY_PROPERTY).forEach(([prop, rooms]) => {
    masters.push({ name: `ROOM_TYPES_BY_PROPERTY.${prop}`, items: rooms });
  });
  return masters;
};

// 1) key 중복 검사 — 각 Master 배열의 key 가 유일한지 확인
export const validateUniqueKeys = () => {
  const result = makeResult();
  collectKeyArrayMasters().forEach(({ name, items }) => {
    const seen = new Set();
    items.forEach((item) => {
      const key = item && item.key;
      if (key === undefined || key === null) {
        result.errors.push(`${name}: key 누락 항목 발견`);
        result.isValid = false;
        return;
      }
      if (seen.has(key)) {
        result.errors.push(`${name}: key 중복 "${key}"`);
        result.isValid = false;
      }
      seen.add(key);
    });
  });
  return result;
};

// 2) 필수 필드 검사 — key/label/isActive/sortOrder 존재 여부
// (PROJECT_STATUS_META 는 isActive 개념이 없으므로 label/sortOrder 만 필수로 처리)
export const validateRequiredFields = () => {
  const result = makeResult();
  collectKeyArrayMasters().forEach(({ name, items }) => {
    const statusMeta = name === 'PROJECT_STATUS_META';
    const required = statusMeta
      ? ['key', 'label', 'sortOrder']
      : ['key', 'label', 'isActive', 'sortOrder'];
    items.forEach((item, idx) => {
      required.forEach((field) => {
        if (!item || !(field in item)) {
          result.errors.push(`${name}[${idx}]: 필수 필드 "${field}" 누락`);
          result.isValid = false;
        }
      });
    });
  });
  return result;
};

// 3) sortOrder 검사 — 누락 또는 중복 여부
// 중복은 정렬 안정성에 영향 줄 수 있으나 치명적이지 않으므로 warning 처리.
export const validateSortOrder = () => {
  const result = makeResult();
  collectKeyArrayMasters().forEach(({ name, items }) => {
    const seen = new Set();
    items.forEach((item, idx) => {
      const so = item ? item.sortOrder : undefined;
      if (typeof so !== 'number' || Number.isNaN(so)) {
        result.errors.push(`${name}[${idx}]: sortOrder 누락 또는 숫자 아님`);
        result.isValid = false;
        return;
      }
      if (seen.has(so)) {
        result.warnings.push(`${name}: sortOrder 중복 "${so}"`);
      }
      seen.add(so);
    });
  });
  return result;
};

// 4) ROOM_TYPES_BY_PROPERTY 의 property key 가 PROPERTY_TYPES 에 존재하는지 검사
// 또한 모든 PROPERTY_TYPES 가 room 목록을 갖는지 함께 확인(누락은 warning).
export const validateRoomTypePropertyKeys = () => {
  const result = makeResult();
  const propertyKeys = new Set(PROPERTY_TYPES.map((p) => p.key));
  Object.keys(ROOM_TYPES_BY_PROPERTY).forEach((propKey) => {
    if (!propertyKeys.has(propKey)) {
      result.errors.push(`ROOM_TYPES_BY_PROPERTY: PROPERTY_TYPES 에 없는 property key "${propKey}"`);
      result.isValid = false;
    }
  });
  PROPERTY_TYPES.forEach((p) => {
    if (!(p.key in ROOM_TYPES_BY_PROPERTY)) {
      result.warnings.push(`PROPERTY_TYPES "${p.key}": 대응하는 ROOM_TYPES 목록 없음`);
    }
  });
  return result;
};

// 5) createEmptyProjectMetadata 결과가 기본 구조를 갖는지 검사
export const validateProjectMetadataDefaults = () => {
  const result = makeResult();
  let meta;
  try {
    meta = createEmptyProjectMetadata();
  } catch (e) {
    result.errors.push(`createEmptyProjectMetadata 호출 실패: ${e && e.message}`);
    result.isValid = false;
    return result;
  }

  const requireKeys = (obj, keys, path) => {
    if (!obj || typeof obj !== 'object') {
      result.errors.push(`${path}: 객체가 아님`);
      result.isValid = false;
      return;
    }
    keys.forEach((k) => {
      if (!(k in obj)) {
        result.errors.push(`${path}.${k}: 누락`);
        result.isValid = false;
      }
    });
  };

  requireKeys(meta, ['space', 'project', 'warranty', 'timeline', 'evidence'], 'metadata');
  if (meta && meta.space) requireKeys(meta.space, ['propertyType', 'roomType', 'workTypes'], 'metadata.space');
  if (meta && meta.project) requireKeys(meta.project, ['status', 'budget', 'area', 'startDate', 'completionDate'], 'metadata.project');
  if (meta && meta.warranty) requireKeys(meta.warranty, ['enabled', 'provider', 'period', 'scope', 'memo'], 'metadata.warranty');

  if (meta && !Array.isArray(meta.timeline)) {
    result.errors.push('metadata.timeline: 배열이 아님');
    result.isValid = false;
  }
  if (meta && !Array.isArray(meta.evidence)) {
    result.errors.push('metadata.evidence: 배열이 아님');
    result.isValid = false;
  }
  // 고정 1년 A/S 제거 원칙 — 기본 warranty 는 비활성이어야 함(회귀 감지용 warning)
  if (meta && meta.warranty && meta.warranty.enabled !== false) {
    result.warnings.push('metadata.warranty.enabled: 기본값이 false 가 아님(고정 A/S 회귀 의심)');
  }
  return result;
};

// 6) 전체 검증 통합 실행
export const validateSpaceOsMasters = () => {
  const result = makeResult();
  [
    validateUniqueKeys(),
    validateRequiredFields(),
    validateSortOrder(),
    validateRoomTypePropertyKeys(),
    validateProjectMetadataDefaults(),
  ].forEach((child) => mergeResult(result, child));
  return result;
};
