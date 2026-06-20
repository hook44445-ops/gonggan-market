// 개발 전용 로거 — 프로덕션에서는 출력하지 않는다(운영 콘솔 정리 · 내부정보 노출 방지).
//   게이팅 기준은 앱의 기존 디버그 노출 플래그(SHOW_DEBUG_UI)와 동일:
//     production 빌드 → 항상 무출력 / dev → VITE_CLEAN_RELEASE="true" 가 아니면 출력.
//   ⚠️ 동작/로직 변경 없음. console.log 진단 호출을 이 함수로 감싸기만 한다.
import { SHOW_DEBUG_UI } from "../constants/release";

export const dlog = (...args) => { if (SHOW_DEBUG_UI) console.log(...args); };
