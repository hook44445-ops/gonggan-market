import { useState, useEffect } from "react";
import { getCompanies } from "../lib/supabase";
import { COMPANIES as MOCK_COMPANIES } from "../mock/mockCompanies";

const normalizeRow = (row) => ({
  id:             row.id,
  name:           row.name ?? "업체",
  temp:           row.temp ?? 70,
  reviews:        row.reviews ?? 0,
  years:          row.years ?? 0,
  distance:       row.distance ?? "",
  region:         row.region ?? "",
  verified:       row.verified ?? false,
  online:         row.online ?? false,
  responseTime:   row.response_time ?? row.responseTime ?? "응답 가능",
  lastActive:     row.last_active ?? row.lastActive ?? "",
  todayBids:      row.today_bids ?? row.todayBids ?? 0,
  completedJobs:  row.completed_jobs ?? row.completedJobs ?? 0,
  recontractRate: row.recontract_rate ?? row.recontractRate ?? 0,
  asRate:         row.as_rate ?? row.asRate ?? 0,
  insurance:      row.has_insurance ?? row.insurance ?? false,
  bizCert:        !!(row.biz_cert_url ?? row.bizCert),
  platformCert:   row.platform_cert ?? row.platformCert ?? false,
  badge:          row.badge ?? null,
  specialties:    row.specialties ?? [],
  desc:           row.desc ?? "",
  rating:         row.rating ?? 0,
  portfolio:      row.portfolio ?? [],
  reviewList:     row.reviewList ?? [],
  companyStatus:  row.company_status ?? row.companyStatus ?? "PENDING",
});

export function useCompanyList() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setCompanies(data.map(normalizeRow));
        } else {
          // Fallback to mock companies when DB has no data yet
          setCompanies(MOCK_COMPANIES.map(normalizeRow));
        }
      })
      .catch(() => {
        if (!cancelled) setCompanies(MOCK_COMPANIES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { companies, loading };
}
