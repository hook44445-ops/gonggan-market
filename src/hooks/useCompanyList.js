import { useState, useEffect } from "react";
import { getActiveCompanies } from "../lib/supabase";

const normalizeRow = (row) => ({
  id:                     row.id,
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
          setCompanies(data.map(normalizeRow));
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
