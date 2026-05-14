import { useState, useEffect } from "react";
import { getCompanies } from "../lib/supabase";
import { COMPANIES as MOCK_COMPANIES } from "../mock/mockCompanies";

const MIN_COUNT = 10;

export function useCompanyList() {
  const [companies, setCompanies] = useState(MOCK_COMPANIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then(({ data, error }) => {
        if (cancelled) return;
        const dbRows = (!error && Array.isArray(data)) ? data : [];
        // Mock companies not already in DB (deduplicate by name)
        const dbNames = new Set(dbRows.map(c => c.name));
        const mockFill = MOCK_COMPANIES.filter(c => !dbNames.has(c.name));
        // Fill up to MIN_COUNT: DB companies first, then mock to pad
        const needed = Math.max(0, MIN_COUNT - dbRows.length);
        setCompanies([...dbRows, ...mockFill.slice(0, needed)]);
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
