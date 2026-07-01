// 업체 성장(LV/XP) 단일 소스 훅 — 업체 메인 성장카드 · 대시보드 · 완료탭이
// '동일 데이터(완료 에스크로 건수) · 동일 API(getCompletedEscrowByCompany) ·
//  동일 계산식(computeCompanyXp/levelInfo)'을 쓰도록 통일한다.
//   · 과거엔 메인카드가 currentUser.completedJobs(캐시/0), 대시보드가 서버 집계를 써서
//     같은 사용자가 화면마다 LV 이 달라 보였다(메인 LV.1 vs 대시보드 LV.2).
//   · 표시 전용 — XP/레벨 지급 정책·DB·마이그레이션 무변경(읽기 전용 파생).
import { useState, useEffect } from "react";
import { getCompletedEscrowByCompany } from "../lib/supabase";
import { computeCompanyXp, levelInfo } from "../constants/growth";

// ownerId: 업체 소유자 user.id(대시보드 statsData 와 동일 입력). hasGuarantee: 공간보증 여부.
export function useCompanyGrowth({ ownerId, hasGuarantee = false } = {}) {
  const [completedCount, setCompletedCount] = useState(null); // null = 로딩 전

  useEffect(() => {
    if (!ownerId) { setCompletedCount(null); return; }
    let alive = true;
    getCompletedEscrowByCompany(ownerId)
      .then(({ data }) => { if (alive) setCompletedCount(Array.isArray(data) ? data.length : 0); })
      .catch(() => { if (alive) setCompletedCount(0); });
    return () => { alive = false; };
  }, [ownerId]);

  const count  = completedCount ?? 0;
  const growth = levelInfo(computeCompanyXp({ completedCount: count, hasGuarantee }));
  return { completedCount, growth, loading: completedCount == null };
}
