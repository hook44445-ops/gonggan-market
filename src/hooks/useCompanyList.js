import { useState, useEffect } from "react";
import { getActiveCompanies, getReviewRatingsByCompanies } from "../lib/supabase";
import { reviewStatsByCompany, withReviewStats } from "../lib/reviewStats";

const normalizeRow = (row) => ({
  id:                     row.id,
  ownerId:                row.owner_id ?? row.ownerId ?? null, // 업체 소유자 user.id — 시공 사례 저장 RPC·활동 기록이 쓴다
  name:                   row.name ?? "업체",
  temp:                   row.temp ?? 36.5,
  reviews:                row.reviews ?? 0,
  years:                  row.years ?? 0,
  distance:               row.distance ?? "",
  region:                 row.region ?? "",
  verified:               row.verified ?? false,
  online:                 row.online ?? false,
  responseTime:           row.response_time ?? row.responseTime ?? "응답 가능",
  lastActive:             row.last_active ?? row.lastActive ?? "",
  todayBids:              row.today_bids ?? row.todayBids ?? 0,
  completedJobs:          row.completed_jobs ?? row.completedJobs ?? 0,
  recontractRate:         row.recontract_rate ?? row.recontractRate ?? 0,
  asRate:                 row.as_rate ?? row.asRate ?? 0,
  insurance:              row.has_insurance ?? row.insurance ?? false,
  bizCert:                !!(row.biz_cert_url ?? row.bizCert),
  platformCert:           row.platform_cert ?? row.platformCert ?? false,
  badge:                  row.badge ?? null,
  // 공간보증(068) — 카드의 보증금 엠블럼이 이 값으로 켜진다. 예전엔 여기서 버려져 실제로 예치한 업체도 안 켜졌다.
  guarantee_status:        row.guarantee_status ?? null,
  guarantee_grade:         row.guarantee_grade ?? null,
  guarantee_badge_visible: row.guarantee_badge_visible ?? false,
  specialties:            row.specialties ?? [],
  desc:                   row.description ?? row.desc ?? "",
  rating:                 row.rating ?? 0,
  portfolio:              row.portfolio ?? [],
  reviewList:             row.reviewList ?? [],
  companyStatus:          row.company_status ?? row.companyStatus ?? "PENDING",
  // STEP 17 — KPI fields
  disputeRate:            row.dispute_rate ?? row.disputeRate ?? 0,
  avgResponseHours:       row.avg_response_hours ?? row.avgResponseHours ?? 0,
  totalTransactionVolume: row.total_transaction_volume ?? row.totalTransactionVolume ?? 0,
  lat:                    row.lat ?? null,
  lng:                    row.lng ?? null,
});

export function useCompanyList() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getActiveCompanies()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data)) {
          const list = data.map(normalizeRow);
          setCompanies(list);
          // 평점·후기 수는 reviews 에서 센다(companies 에 평점 칸이 없다 · D16). 못 읽으면 먼저 그린 목록 그대로.
          const ids = list.map((c) => c.id).filter(Boolean);
          if (ids.length) {
            getReviewRatingsByCompanies(ids)
              .then(({ data: rows, error: e }) => {
                if (!cancelled && !e && Array.isArray(rows)) setCompanies(withReviewStats(list, reviewStatsByCompany(rows)));
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        // silent fail — empty list
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { companies, loading };
}
