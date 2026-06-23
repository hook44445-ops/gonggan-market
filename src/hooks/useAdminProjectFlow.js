import { useState, useEffect } from "react";
import { getAdminProjectFlow, getTestAccounts } from "../lib/supabase";
import { buildTestAccountSet } from "../lib/testAccounts";

// ── 관리자 대시보드 공용 데이터 로더 ──────────────────────────────────────────
// 여러 관리자 대시보드(재무·거래·GPS신뢰·증빙타임라인·프로젝트증빙)가 동일하게 반복하던
//   "테스트계정 집합 로드 → admin_project_flow_list 조회 → rows/loading/errMsg 세팅"
// 보일러플레이트를 단일 소스로 통합한다. 신규 DB/RPC/Migration 없음 — 기존 호출 그대로.
//
// 동작 보존(기존과 100% 동일):
//   · adminUserId 변경 시 1회 자동 로드, reload() 로 수동 갱신(기존 load 버튼과 동치).
//   · 테스트계정 조회 실패해도 본 조회는 계속(제외 0건으로 동작) — 기존 try/catch 동일.
//   · getAdminProjectFlow 실패 시 errMsg 세팅 + rows 비움 — 기존 분기 동일.
// 주의: 각 컴포넌트의 테스트 필터(excludeTest/testFilter)·집계·다운스트림 렌더는
//       그대로 호출부에 둔다(컴포넌트마다 의미가 달라 통합 대상 아님).
export function useAdminProjectFlow(adminUserId, { limit = 1000 } = {}) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);
  const [testSet, setTestSet] = useState(null);

  const reload = async () => {
    setLoading(true); setErrMsg(null);
    // 테스트 계정 목록 — 실패해도 조회는 계속(제외 0건으로 동작).
    try {
      const { data: ta } = await getTestAccounts(adminUserId);
      setTestSet(buildTestAccountSet(Array.isArray(ta) ? ta : []));
    } catch { setTestSet(buildTestAccountSet([])); }

    const { data, error } = await getAdminProjectFlow(adminUserId, { limit });
    if (error) { setErrMsg(error.message || "조회 실패"); setRows([]); }
    else { setRows(Array.isArray(data) ? data : []); }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [adminUserId]);

  return { rows, loading, errMsg, testSet, reload };
}
