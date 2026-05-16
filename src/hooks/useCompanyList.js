import { useState, useEffect } from "react";
import { getCompanies } from "../lib/supabase";
import { COMPANIES as MOCK_COMPANIES } from "../mock/mockCompanies";

export function useCompanyList() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setCompanies(data);
        } else {
          // Fallback to mock companies when DB has no data yet
          setCompanies(MOCK_COMPANIES);
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
