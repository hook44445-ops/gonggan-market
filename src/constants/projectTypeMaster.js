// ─────────────────────────────────────────────────────
// Space OS Project Type Master (SPACE-OS-PROJECT-MASTER-v1.0)
//
// 프로젝트의 "목적·성격"을 표준화하는 Master 입니다.
// Digital Twin Master(공간 유형/위치/공사)와 Project Metadata Master(상태/
// 타임라인/증빙)에 더해, Project Type 이 추가되면 하나의 프로젝트를 동일한
// 언어로 표현할 수 있습니다.
//   예) property_type=residential · room_type=bathroom
//       · work_type=tile · project_type=remodeling
//
// 이번 버전은 UI 연결이 아니라 "공통 언어" 정의입니다.
//   · DB / Migration / RLS / Supabase / API 무수정
//   · UI / Dropdown / Form / 저장 / 조회 연결 없음
//   · 기존 Master(digitalTwinMaster·projectMetadataMaster) 무수정
//   · 향후 DB 전환 대비 { key, label, description, isActive, sortOrder } 구조
// ─────────────────────────────────────────────────────

// ── Master: Project Type (프로젝트 유형) ─────────────────────────────────────
export const PROJECT_TYPES = [
  { key: 'remodeling',   label: '리모델링',   description: '공간 전반을 새로 구성하는 종합 개선', isActive: true, sortOrder: 1 },
  { key: 'interior',     label: '인테리어',   description: '디자인·마감 중심의 실내 공사',         isActive: true, sortOrder: 2 },
  { key: 'partial',      label: '부분공사',   description: '특정 구역·항목만 진행하는 공사',        isActive: true, sortOrder: 3 },
  { key: 'maintenance',  label: '유지보수',   description: '상태 유지를 위한 보수 작업',           isActive: true, sortOrder: 4 },
  { key: 'repair',       label: '하자보수',   description: '하자·결함에 대한 보수',                isActive: true, sortOrder: 5 },
  { key: 'facility',     label: '시설관리',   description: '시설 운영·관리 업무',                  isActive: true, sortOrder: 6 },
  { key: 'inspection',   label: '정기점검',   description: '주기적 점검·진단',                     isActive: true, sortOrder: 7 },
  { key: 'emergency',    label: '긴급출동',   description: '긴급 상황 대응 출동',                  isActive: true, sortOrder: 8 },
  { key: 'demolition',   label: '철거',       description: '구조물·마감 철거',                     isActive: true, sortOrder: 9 },
  { key: 'restoration',  label: '원상복구',   description: '계약 만료·이전 시 원상 복구',          isActive: true, sortOrder: 10 },
  { key: 'installation', label: '설치',       description: '설비·가구·장비 등 설치',               isActive: true, sortOrder: 11 },
  { key: 'other',        label: '기타',       description: '위 분류에 속하지 않는 프로젝트',        isActive: true, sortOrder: 99 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
// 향후 DB 전환 시에도 호출부가 바뀌지 않도록 조회/검증 함수를 제공합니다.

// 활성 Project Type 목록(sortOrder 정렬) — UI 노출용
export const getProjectTypeList = () =>
  PROJECT_TYPES.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

// key로 Project Type 단건 조회 (없으면 null)
export const getProjectTypeByKey = (key) =>
  PROJECT_TYPES.find((p) => p.key === key) || null;

// 유효한(활성) Project Type key 인지 검증
export const isValidProjectType = (key) =>
  PROJECT_TYPES.some((p) => p.key === key && p.isActive);
